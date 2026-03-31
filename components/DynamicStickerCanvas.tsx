import {
  BlendColor,
  Canvas,
  Group,
  Image as SkiaImage,
  Paint,
  type Transforms3d,
  useImage,
} from '@shopify/react-native-skia';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import type { DebugTiltState } from './StickerPhysicsDebugControls';
import {
  hydrateStickerPlacements,
  type NoteStickerPlacement,
} from '../services/noteStickers';
import type { StickerMotionVariant } from '../services/noteAppearance';
import {
  useStickerPhysics,
  type StickerPhysicsState,
} from '../hooks/useStickerPhysics';
import {
  getStickerDimensions,
  getStickerOutlineOffsets,
  getStickerOutlineSize,
  sortStickerPlacements,
  type StickerCanvasLayout,
} from './stickerCanvasMetrics';

interface DynamicStickerCanvasProps {
  placements: NoteStickerPlacement[];
  style?: StyleProp<ViewStyle>;
  remoteBucket?: string;
  sharedCache?: boolean;
  sizeMultiplier?: number;
  minimumBaseSize?: number;
  isActive?: boolean;
  motionVariant?: StickerMotionVariant;
  debugTiltOverride?: SharedValue<DebugTiltState>;
}

interface StickerSpriteProps {
  placement: NoteStickerPlacement;
  width: number;
  height: number;
  outlineSize: number;
  opacity: number | SharedValue<number>;
  motionTransform: Transforms3d | SharedValue<Transforms3d>;
  jellyTransform: Transforms3d | SharedValue<Transforms3d>;
}

interface StickerLayerProps {
  placements: NoteStickerPlacement[];
  layout: StickerCanvasLayout;
  sizeMultiplier: number;
  minimumBaseSize: number;
  physicsState?: SharedValue<StickerPhysicsState[]>;
}

const STICKER_OUTLINE_COLOR = 'rgba(255,255,255,0.98)';
const PREFER_CONTINUOUS_OUTLINE = Platform.OS === 'android';
const WATER_LAYER_SURFACE_RATIO = 0.56;

function WaterLayer() {
  return (
    <>
      <View pointerEvents="none" testID="dynamic-sticker-water-fill" style={styles.waterFill}>
        <LinearGradient
          colors={[
            'rgba(180, 228, 255, 0)',
            'rgba(180, 228, 255, 0.1)',
            'rgba(126, 196, 255, 0.22)',
            'rgba(101, 177, 242, 0.3)',
          ]}
          locations={[0, 0.18, 0.56, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View pointerEvents="none" style={styles.waterSurfaceGlow} />
    </>
  );
}

function StickerSprite({
  placement,
  width,
  height,
  outlineSize,
  opacity,
  motionTransform,
  jellyTransform,
}: StickerSpriteProps) {
  const image = useImage(placement.asset.localUri);
  const outlineOffsets = getStickerOutlineOffsets(outlineSize, {
    preferContinuous: PREFER_CONTINUOUS_OUTLINE,
  });

  if (!image) {
    return null;
  }

  return (
    <Group opacity={opacity} transform={motionTransform}>
      <Group transform={jellyTransform}>
        {placement.outlineEnabled !== false ? (
          <Group
            opacity={0.94}
            layer={
              <Paint>
                <BlendColor color={STICKER_OUTLINE_COLOR} mode="srcIn" />
              </Paint>
            }
          >
            {outlineOffsets.map((offset, index) => (
              <Group key={`${placement.id}-outline-${index}`}>
                <SkiaImage
                  image={image}
                  fit="contain"
                  x={-width / 2 + offset.x * outlineSize}
                  y={-height / 2 + offset.y * outlineSize}
                  width={width}
                  height={height}
                />
              </Group>
            ))}
          </Group>
        ) : null}
        <SkiaImage
          image={image}
          fit="contain"
          x={-width / 2}
          y={-height / 2}
          width={width}
          height={height}
        />
      </Group>
    </Group>
  );
}

const MemoStickerSprite = memo(StickerSprite);

function PhysicsStickerSprite({
  placement,
  width,
  height,
  outlineSize,
  physicsState,
  layout,
}: {
  placement: NoteStickerPlacement;
  width: number;
  height: number;
  outlineSize: number;
  physicsState: SharedValue<StickerPhysicsState[]>;
  layout: StickerCanvasLayout;
}) {
  const opacity = useDerivedValue(() => {
    const state = physicsState.value.find((candidate) => candidate.id === placement.id);
    return state?.opacity ?? placement.opacity;
  }, [physicsState, placement.id, placement.opacity]);

  const motionTransform = useDerivedValue(() => {
    const state = physicsState.value.find((candidate) => candidate.id === placement.id);

    return [
      { translateX: state?.x ?? placement.x * layout.width },
      { translateY: state?.y ?? placement.y * layout.height },
      { rotate: ((state?.rotation ?? placement.rotation) * Math.PI) / 180 },
    ] as Transforms3d;
  }, [layout.height, layout.width, physicsState, placement.id, placement.rotation, placement.x, placement.y]);

  const jellyTransform = useDerivedValue(() => {
    const state = physicsState.value.find((candidate) => candidate.id === placement.id);

    return [
      { scaleX: state?.jellyScaleX ?? 1 },
      { scaleY: state?.jellyScaleY ?? 1 },
    ] as Transforms3d;
  }, [physicsState, placement.id]);

  return (
    <MemoStickerSprite
      placement={placement}
      width={width}
      height={height}
      outlineSize={outlineSize}
      opacity={opacity}
      motionTransform={motionTransform}
      jellyTransform={jellyTransform}
    />
  );
}

function StickerLayer({
  placements,
  layout,
  sizeMultiplier,
  minimumBaseSize,
  physicsState,
}: StickerLayerProps) {
  return (
    <>
      {placements.map((placement) => {
        const dimensions = getStickerDimensions(placement, layout, sizeMultiplier, minimumBaseSize);
        const outlineSize = getStickerOutlineSize(dimensions.width, dimensions.height);
        const motionTransform = [
          { translateX: placement.x * layout.width },
          { translateY: placement.y * layout.height },
          { rotate: (placement.rotation * Math.PI) / 180 },
        ] as Transforms3d;
        const jellyTransform = [{ scaleX: 1 }, { scaleY: 1 }] as Transforms3d;

        return physicsState ? (
          <PhysicsStickerSprite
            key={placement.id}
            placement={placement}
            width={dimensions.width}
            height={dimensions.height}
            outlineSize={outlineSize}
            physicsState={physicsState}
            layout={layout}
          />
        ) : (
          <MemoStickerSprite
            key={placement.id}
            placement={placement}
            width={dimensions.width}
            height={dimensions.height}
            outlineSize={outlineSize}
            opacity={placement.opacity}
            motionTransform={motionTransform}
            jellyTransform={jellyTransform}
          />
        );
      })}
    </>
  );
}

export default function DynamicStickerCanvas({
  placements,
  style,
  remoteBucket,
  sharedCache = false,
  sizeMultiplier = 1,
  minimumBaseSize = 68,
  isActive = false,
  motionVariant = 'physics',
  debugTiltOverride,
}: DynamicStickerCanvasProps) {
  const [layout, setLayout] = useState<StickerCanvasLayout>({ width: 1, height: 1 });
  const [hydratedPlacements, setHydratedPlacements] = useState(placements);

  useEffect(() => {
    if (!remoteBucket) {
      setHydratedPlacements(placements);
      return;
    }

    let cancelled = false;

    void hydrateStickerPlacements(placements, remoteBucket, { sharedCache }).then((nextPlacements) => {
      if (!cancelled) {
        setHydratedPlacements(nextPlacements);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [placements, remoteBucket, sharedCache]);

  const renderedPlacements = useMemo(
    () => sortStickerPlacements(hydratedPlacements),
    [hydratedPlacements]
  );
  const physicsState = useStickerPhysics({
    placements: renderedPlacements,
    layout,
    isActive,
    motionVariant,
    sizeMultiplier,
    minimumBaseSize,
    debugTiltOverride,
  });

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({
      width: Math.max(width, 1),
      height: Math.max(height, 1),
    });
  };

  return (
    <View style={[styles.canvasWrap, style]} onLayout={handleLayout}>
      {motionVariant === 'water' ? <WaterLayer /> : null}
      <Canvas pointerEvents="none" style={styles.canvas}>
        <StickerLayer
          placements={renderedPlacements}
          layout={layout}
          sizeMultiplier={sizeMultiplier}
          minimumBaseSize={minimumBaseSize}
          physicsState={physicsState}
        />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  canvasWrap: {
    width: '100%',
    height: '100%',
  },
  canvas: {
    width: '100%',
    height: '100%',
  },
  waterFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: `${WATER_LAYER_SURFACE_RATIO * 100 - 4}%`,
    bottom: 0,
  },
  waterSurfaceGlow: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    top: `${WATER_LAYER_SURFACE_RATIO * 100 - 5}%`,
    height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    zIndex: 1,
  },
});

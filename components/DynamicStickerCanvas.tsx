import {
  BlendColor,
  Canvas,
  Group,
  Image as SkiaImage,
  Paint,
  type Transforms3d,
  useImage,
} from '@shopify/react-native-skia';
import { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import type { DebugTiltState } from './StickerPhysicsDebugControls';
import { useStickerPhysics, type StickerPhysicsState } from '../hooks/useStickerPhysics';
import {
  hydrateStickerPlacements,
  type NoteStickerPlacement,
} from '../services/noteStickers';
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
  debugTiltOverride?: SharedValue<DebugTiltState>;
}

interface StickerSpriteProps {
  placement: NoteStickerPlacement;
  width: number;
  height: number;
  outlineSize: number;
  opacity: number | SharedValue<number>;
  transform: Transforms3d | SharedValue<Transforms3d>;
}

interface StickerLayerProps {
  placements: NoteStickerPlacement[];
  layout: StickerCanvasLayout;
  sizeMultiplier: number;
  minimumBaseSize: number;
  isActive: boolean;
  debugTiltOverride?: SharedValue<DebugTiltState>;
}

interface PhysicsStickerSpriteProps {
  placement: NoteStickerPlacement;
  index: number;
  physicsState: SharedValue<StickerPhysicsState[]>;
  layout: StickerCanvasLayout;
  sizeMultiplier: number;
  minimumBaseSize: number;
}

const STICKER_OUTLINE_COLOR = 'rgba(255,255,255,0.98)';
function StickerSprite({
  placement,
  width,
  height,
  outlineSize,
  opacity,
  transform,
}: StickerSpriteProps) {
  const image = useImage(placement.asset.localUri);
  const outlineOffsets = getStickerOutlineOffsets(outlineSize);

  if (!image) {
    return null;
  }

  return (
    <Group opacity={opacity} transform={transform}>
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
  );
}

const MemoStickerSprite = memo(StickerSprite);

function PhysicsStickerSprite({
  placement,
  index,
  physicsState,
  layout,
  sizeMultiplier,
  minimumBaseSize,
}: PhysicsStickerSpriteProps) {
  const dimensions = getStickerDimensions(placement, layout, sizeMultiplier, minimumBaseSize);
  const outlineSize = getStickerOutlineSize(dimensions.width, dimensions.height);
  const transform = useDerivedValue<Transforms3d>(() => {
    const state = physicsState.value[index];
    if (!state) {
      return [
        { translateX: placement.x * layout.width },
        { translateY: placement.y * layout.height },
        { rotate: (placement.rotation * Math.PI) / 180 },
      ] as Transforms3d;
    }

    return [
      { translateX: state.x },
      { translateY: state.y },
      { rotate: (state.rotation * Math.PI) / 180 },
    ] as Transforms3d;
  }, [index, layout.height, layout.width, placement.rotation, placement.x, placement.y]);
  const opacity = useDerivedValue(() => physicsState.value[index]?.opacity ?? placement.opacity, [
    index,
    placement.opacity,
  ]);

  return (
    <MemoStickerSprite
      placement={placement}
      width={dimensions.width}
      height={dimensions.height}
      outlineSize={outlineSize}
      opacity={opacity}
      transform={transform}
    />
  );
}

function StickerLayer({
  placements,
  layout,
  sizeMultiplier,
  minimumBaseSize,
  isActive,
  debugTiltOverride,
}: StickerLayerProps) {
  const physicsState = useStickerPhysics({
    placements,
    layout,
    isActive,
    sizeMultiplier,
    minimumBaseSize,
    debugTiltOverride,
  });

  return (
    <>
      {placements.map((placement, index) => {
        return (
          <PhysicsStickerSprite
            key={placement.id}
            placement={placement}
            index={index}
            physicsState={physicsState}
            layout={layout}
            sizeMultiplier={sizeMultiplier}
            minimumBaseSize={minimumBaseSize}
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

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({
      width: Math.max(width, 1),
      height: Math.max(height, 1),
    });
  };

  return (
    <View style={[styles.canvasWrap, style]} onLayout={handleLayout}>
      <Canvas pointerEvents="none" style={styles.canvas}>
        <StickerLayer
          placements={renderedPlacements}
          layout={layout}
          sizeMultiplier={sizeMultiplier}
          minimumBaseSize={minimumBaseSize}
          isActive={isActive}
          debugTiltOverride={debugTiltOverride}
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
});

import {
  BlendColor,
  Canvas,
  Group,
  Image as SkiaImage,
  Paint,
  Path,
  type Transforms3d,
  useImage,
} from '@shopify/react-native-skia';
import { memo, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import type { DebugTiltState } from './StickerPhysicsDebugControls';
import {
  hydrateStickerPlacements,
  type NoteStickerPlacement,
} from '../../services/noteStickers';
import {
  type StickerMotionVariant,
} from '../../services/noteAppearance';
import {
  useStickerPhysics,
  type StickerPhysicsState,
} from '../../hooks/useStickerPhysics';
import {
  getStickerDimensions,
  getStickerOutlineOffsets,
  getStickerOutlineSize,
  sortStickerPlacements,
  type StickerCanvasLayout,
} from './stickerCanvasMetrics';
import {
  createStampFramePath,
  getStampFrameMetrics,
  STAMP_OUTLINE_COLOR,
  STAMP_PAPER_BORDER_COLOR,
} from './stampFrameMetrics';

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
  const stampMetrics =
    placement.renderMode === 'stamp'
      ? getStampFrameMetrics(width, height, placement.stampStyle ?? 'classic')
      : null;
  const stampPath = useMemo(
    () => (stampMetrics ? createStampFramePath(stampMetrics) : null),
    [stampMetrics]
  );
  const outlineOffsets = getStickerOutlineOffsets(outlineSize, {
    preferContinuous: PREFER_CONTINUOUS_OUTLINE,
  });
  const stampOutlineWidth = stampMetrics ? Math.max(2.4, stampMetrics.perforationRadius * 0.66) : 0;
  const stampBorderWidth = stampMetrics ? Math.max(1, stampMetrics.perforationRadius * 0.18) : 0;

  if (!image) {
    return null;
  }

  return (
    <Group opacity={opacity} transform={motionTransform}>
      <Group transform={jellyTransform}>
        {placement.renderMode !== 'stamp' && placement.outlineEnabled !== false ? (
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
        {stampMetrics && stampPath ? (
          <Group>
            <Group
              clip={stampPath}
              transform={[
                { translateX: -stampMetrics.outerWidth / 2 },
                { translateY: -stampMetrics.outerHeight / 2 },
              ]}
            >
              <SkiaImage
                image={image}
                fit="cover"
                x={0}
                y={0}
                width={stampMetrics.outerWidth}
                height={stampMetrics.outerHeight}
              />
            </Group>
            <Path
              path={stampPath}
              color={STAMP_OUTLINE_COLOR}
              style="stroke"
              strokeWidth={stampOutlineWidth}
              transform={[
                { translateX: -stampMetrics.outerWidth / 2 },
                { translateY: -stampMetrics.outerHeight / 2 },
              ]}
            />
            <Path
              path={stampPath}
              color={STAMP_PAPER_BORDER_COLOR}
              style="stroke"
              strokeWidth={stampBorderWidth}
              transform={[
                { translateX: -stampMetrics.outerWidth / 2 },
                { translateY: -stampMetrics.outerHeight / 2 },
              ]}
            />
          </Group>
        ) : (
          <SkiaImage
            image={image}
            fit="contain"
            x={-width / 2}
            y={-height / 2}
            width={width}
            height={height}
          />
        )}
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
  const stickerState = useDerivedValue(
    () => physicsState.value.find((candidate) => candidate.id === placement.id) ?? null,
    [physicsState, placement.id]
  );

  const opacity = useDerivedValue(() => {
    return stickerState.value?.opacity ?? placement.opacity;
  }, [placement.opacity, stickerState]);

  const motionTransform = useDerivedValue(() => {
    const state = stickerState.value;

    return [
      { translateX: state?.x ?? placement.x * layout.width },
      { translateY: state?.y ?? placement.y * layout.height },
      { rotate: ((state?.rotation ?? placement.rotation) * Math.PI) / 180 },
    ] as Transforms3d;
  }, [layout.height, layout.width, placement.rotation, placement.x, placement.y, stickerState]);

  const jellyTransform = useDerivedValue(() => {
    const state = stickerState.value;

    return [
      { scaleX: state?.jellyScaleX ?? 1 },
      { scaleY: state?.jellyScaleY ?? 1 },
    ] as Transforms3d;
  }, [stickerState]);

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
  const unlockedPlacements = useMemo(
    () => renderedPlacements.filter((placement) => placement.motionLocked !== true),
    [renderedPlacements]
  );
  const lockedPlacements = useMemo(
    () => renderedPlacements.filter((placement) => placement.motionLocked === true),
    [renderedPlacements]
  );
  const physicsState = useStickerPhysics({
    placements: unlockedPlacements,
    layout,
    isActive: isActive && unlockedPlacements.length > 0,
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
      <Canvas pointerEvents="none" style={styles.canvas}>
        <StickerLayer
          placements={lockedPlacements}
          layout={layout}
          sizeMultiplier={sizeMultiplier}
          minimumBaseSize={minimumBaseSize}
        />
        <StickerLayer
          placements={unlockedPlacements}
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
});

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
import type { SharedValue } from 'react-native-reanimated';
import type { DebugTiltState } from './StickerPhysicsDebugControls';
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
  motionTransform: Transforms3d | SharedValue<Transforms3d>;
  jellyTransform: Transforms3d | SharedValue<Transforms3d>;
}

interface StickerLayerProps {
  placements: NoteStickerPlacement[];
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
  motionTransform,
  jellyTransform,
}: StickerSpriteProps) {
  const image = useImage(placement.asset.localUri);
  const outlineOffsets = getStickerOutlineOffsets(outlineSize);

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

function StickerLayer({
  placements,
  layout,
  sizeMultiplier,
  minimumBaseSize,
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

        return (
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

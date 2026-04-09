import {
  Canvas,
  Group,
  Image as SkiaImage,
  Path,
  useImage,
} from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  createStampFramePath,
  getStampFrameMetrics,
  STAMP_DROP_SHADOW_COLOR,
  STAMP_OUTLINE_COLOR,
  STAMP_PAPER_BORDER_COLOR,
  type StampFrameMetrics,
} from './stampFrameMetrics';

interface StampStickerArtworkProps {
  localUri: string;
  width: number;
  height: number;
  metrics?: StampFrameMetrics | null;
  shadowEnabled?: boolean;
  artworkTestID?: string;
  paperTestID?: string;
}

function StampStickerArtwork({
  localUri,
  width,
  height,
  metrics = null,
  shadowEnabled = true,
  artworkTestID,
  paperTestID,
}: StampStickerArtworkProps) {
  const stampMetrics = useMemo(
    () => metrics ?? getStampFrameMetrics(width, height),
    [height, metrics, width]
  );
  const stampPath = useMemo(
    () => createStampFramePath(stampMetrics),
    [stampMetrics]
  );
  const stampImage = useImage(localUri);
  const stampOutlineWidth = Math.max(2.4, stampMetrics.perforationRadius * 0.66);
  const stampBorderWidth = Math.max(1, stampMetrics.perforationRadius * 0.18);

  return (
    <View
      pointerEvents="none"
      testID={paperTestID}
      style={[
        styles.stampPaper,
        shadowEnabled ? styles.stampPaperShadow : null,
        {
          width: stampMetrics.outerWidth,
          height: stampMetrics.outerHeight,
          shadowColor: shadowEnabled ? STAMP_DROP_SHADOW_COLOR : 'transparent',
        },
      ]}
    >
      <Canvas testID={artworkTestID} style={styles.stampArtwork}>
        {stampImage ? (
          <Group clip={stampPath}>
            <SkiaImage
              image={stampImage}
              fit="cover"
              x={0}
              y={0}
              width={stampMetrics.outerWidth}
              height={stampMetrics.outerHeight}
            />
          </Group>
        ) : null}
        <Path
          path={stampPath}
          color={STAMP_OUTLINE_COLOR}
          style="stroke"
          strokeWidth={stampOutlineWidth}
        />
        <Path
          path={stampPath}
          color={STAMP_PAPER_BORDER_COLOR}
          style="stroke"
          strokeWidth={stampBorderWidth}
        />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  stampPaper: {
    overflow: 'visible',
  },
  stampPaperShadow: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  stampArtwork: {
    width: '100%',
    height: '100%',
  },
});

export default memo(StampStickerArtwork);

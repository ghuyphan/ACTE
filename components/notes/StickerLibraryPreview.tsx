import { Image as ExpoImage } from 'expo-image';
import { View, StyleSheet } from 'react-native';
import { CaptureChrome } from '../../constants/theme';
import type {
  StickerAsset,
  StickerRenderMode,
  StickerStampStyle,
} from '../../services/noteStickers';
import StampStickerArtwork from './StampStickerArtwork';
import {
  getStickerOutlineOffsets,
  getStickerOutlineSize,
} from './stickerCanvasMetrics';

export interface StickerLibraryPreviewItem {
  id: string;
  asset: StickerAsset;
  renderMode: StickerRenderMode;
  stampStyle?: StickerStampStyle;
}

export default function StickerLibraryPreview({
  item,
  previewWidth,
  previewHeight,
  outlineTintColor = CaptureChrome.shutterContent,
  outlineScale = 1,
  stampShadowEnabled = false,
}: {
  item: StickerLibraryPreviewItem;
  previewWidth: number;
  previewHeight: number;
  outlineTintColor?: string;
  outlineScale?: number;
  stampShadowEnabled?: boolean;
}) {
  if (item.renderMode === 'stamp') {
    return (
      <StampStickerArtwork
        localUri={item.asset.localUri}
        width={previewWidth}
        height={previewHeight}
        style={item.stampStyle ?? 'classic'}
        shadowEnabled={stampShadowEnabled}
      />
    );
  }

  const outlineSize = getStickerOutlineSize(previewWidth, previewHeight) * outlineScale;
  const outlineOffsets = getStickerOutlineOffsets(outlineSize);

  return (
    <View style={[styles.stickerPreviewCanvas, { width: previewWidth, height: previewHeight }]}>
      {outlineOffsets.map((offset, index) => (
        <ExpoImage
          key={`${item.id}-outline-${index}`}
          source={{ uri: item.asset.localUri }}
          style={[
            styles.stickerPreviewImage,
            styles.stickerPreviewOutline,
            {
              tintColor: outlineTintColor,
              transform: [
                { translateX: offset.x * outlineSize },
                { translateY: offset.y * outlineSize },
              ],
            },
          ]}
          contentFit="contain"
          transition={0}
        />
      ))}
      <ExpoImage
        source={{ uri: item.asset.localUri }}
        style={styles.stickerPreviewImage}
        contentFit="contain"
        transition={120}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stickerPreviewCanvas: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  stickerPreviewImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  stickerPreviewOutline: {
    opacity: 0.98,
  },
});

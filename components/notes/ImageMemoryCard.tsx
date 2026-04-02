import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { STICKER_ARTBOARD_FRAME } from '../../constants/doodleLayout';
import { Layout, Shadows } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { parseNoteDoodleStrokes } from '../../services/noteDoodles';
import { parseNoteStickerPlacements } from '../../services/noteStickers';
import DynamicStickerCanvas from './DynamicStickerCanvas';
import NoteDoodleCanvas from './NoteDoodleCanvas';
import PhotoMediaView from './PhotoMediaView';
import type { DebugTiltState } from './StickerPhysicsDebugControls';
import type { SharedValue } from 'react-native-reanimated';

interface ImageMemoryCardProps {
  imageUrl: string;
  isLivePhoto?: boolean;
  pairedVideoUri?: string | null;
  showLiveBadge?: boolean;
  doodleStrokesJson?: string | null;
  stickerPlacementsJson?: string | null;
  remoteBucket?: string;
  isActive?: boolean;
  debugTiltOverride?: SharedValue<DebugTiltState>;
}

function ImageMemoryCard({
  imageUrl,
  isLivePhoto = false,
  pairedVideoUri = null,
  showLiveBadge = true,
  doodleStrokesJson = null,
  stickerPlacementsJson = null,
  remoteBucket,
  isActive = false,
  debugTiltOverride,
}: ImageMemoryCardProps) {
  const { colors } = useTheme();
  const doodleStrokes = useMemo(
    () => parseNoteDoodleStrokes(doodleStrokesJson),
    [doodleStrokesJson]
  );
  const stickerPlacements = useMemo(
    () => parseNoteStickerPlacements(stickerPlacementsJson),
    [stickerPlacementsJson]
  );

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <PhotoMediaView
        imageUrl={imageUrl}
        isLivePhoto={isLivePhoto}
        pairedVideoUri={pairedVideoUri}
        showLiveBadge={showLiveBadge}
        style={styles.image}
        imageStyle={styles.image}
        enablePlayback
      />
      {stickerPlacements.length > 0 ? (
        <View
          pointerEvents={__DEV__ && isActive ? 'box-none' : 'none'}
          style={styles.stickerOverlay}
        >
          <DynamicStickerCanvas
            placements={stickerPlacements}
            remoteBucket={remoteBucket}
            isActive={isActive}
            debugTiltOverride={debugTiltOverride}
          />
        </View>
      ) : null}
      {doodleStrokes.length > 0 ? (
        <View pointerEvents="none" style={styles.doodleOverlay}>
          <NoteDoodleCanvas strokes={doodleStrokes} />
        </View>
      ) : null}
    </View>
  );
}

export default memo(ImageMemoryCard);

const styles = StyleSheet.create({
  card: {
    borderRadius: Layout.cardRadius,
    borderCurve: 'continuous',
    overflow: 'hidden',
    ...Shadows.card,
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  doodleOverlay: {
    position: 'absolute',
    ...STICKER_ARTBOARD_FRAME,
    opacity: 0.82,
  },
  stickerOverlay: {
    position: 'absolute',
    ...STICKER_ARTBOARD_FRAME,
    opacity: 0.82,
  },
});

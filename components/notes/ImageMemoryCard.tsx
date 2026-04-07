import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
  caption?: string | null;
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
  caption = null,
  isLivePhoto = false,
  pairedVideoUri = null,
  showLiveBadge = true,
  doodleStrokesJson = null,
  stickerPlacementsJson = null,
  remoteBucket,
  isActive = false,
  debugTiltOverride,
}: ImageMemoryCardProps) {
  const { colors, isDark } = useTheme();
  const doodleStrokes = useMemo(
    () => parseNoteDoodleStrokes(doodleStrokesJson),
    [doodleStrokesJson]
  );
  const stickerPlacements = useMemo(
    () => parseNoteStickerPlacements(stickerPlacementsJson),
    [stickerPlacementsJson]
  );
  const normalizedCaption = caption?.trim() ?? '';

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
      {normalizedCaption.length > 0 ? (
        <View
          pointerEvents="none"
          style={styles.captionOverlay}
        >
          <View
            style={[
              styles.captionField,
              {
                backgroundColor: isDark ? 'rgba(20,20,20,0.5)' : 'rgba(255,255,255,0.72)',
                borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.42)',
              },
            ]}
          >
            <Text style={[styles.captionText, { color: colors.text }]} numberOfLines={1}>
              {normalizedCaption}
            </Text>
          </View>
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
  captionOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 14,
    alignItems: 'center',
  },
  captionField: {
    maxWidth: '72%',
    minHeight: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  captionText: {
    flexShrink: 1,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '600',
  },
});

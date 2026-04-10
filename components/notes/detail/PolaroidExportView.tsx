import { LinearGradient } from 'expo-linear-gradient';
import React, { forwardRef, memo, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { STICKER_ARTBOARD_FRAME, DOODLE_ARTBOARD_FRAME } from '../../../constants/doodleLayout';
import i18n from '../../../constants/i18n';
import { Fonts, Layout, Typography } from '../../../constants/theme';
import type { Note } from '../../../services/database';
import { getTextNoteCardGradient } from '../../../services/noteAppearance';
import { parseNoteDoodleStrokes } from '../../../services/noteDoodles';
import { parseNoteStickerPlacements } from '../../../services/noteStickers';
import { formatNoteTextWithEmoji } from '../../../services/noteTextPresentation';
import { getNotePairedVideoUri } from '../../../services/livePhotoStorage';
import { getNotePhotoUri } from '../../../services/photoStorage';
import NoteDoodleCanvas from '../NoteDoodleCanvas';
import NoteStickerCanvas from '../NoteStickerCanvas';
import { getNoteCardTextSizeStyle, noteCardTextStyles } from '../noteCardTextStyles';
import PhotoCaptionChip from '../PhotoCaptionChip';
import PhotoMediaView from '../PhotoMediaView';
import PremiumNoteFinishOverlay from '../../ui/PremiumNoteFinishOverlay';

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1350;
const POLAROID_WIDTH = 876;
const POLAROID_CARD_SIZE = 820;
const POLAROID_TOP_PADDING = 28;
const POLAROID_SIDE_PADDING = 28;
const POLAROID_BOTTOM_PADDING = 164;

type PolaroidExportViewProps = {
  note: Note;
  fallbackLocationLabel: string;
  onReady?: () => void;
};

function formatPolaroidDate(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function PolaroidExportViewInner(
  { note, fallbackLocationLabel, onReady }: PolaroidExportViewProps,
  ref: React.ForwardedRef<View>
) {
  const [layoutReady, setLayoutReady] = useState(false);
  const [mediaReady, setMediaReady] = useState(note.type === 'text');
  const [readyToken, setReadyToken] = useState(note.id);

  useEffect(() => {
    setLayoutReady(false);
    setMediaReady(note.type === 'text');
    setReadyToken(note.id);
  }, [note.id, note.type]);

  useEffect(() => {
    if (!layoutReady || !mediaReady || readyToken !== note.id) {
      return;
    }

    onReady?.();
  }, [layoutReady, mediaReady, note.id, onReady, readyToken]);

  const gradient = useMemo(
    () =>
      getTextNoteCardGradient({
        text: note.content,
        noteId: note.id,
        emoji: note.moodEmoji,
        noteColor: note.noteColor,
      }),
    [note.content, note.id, note.moodEmoji, note.noteColor]
  );
  const doodleStrokes = useMemo(
    () => parseNoteDoodleStrokes(note.doodleStrokesJson),
    [note.doodleStrokesJson]
  );
  const stickerPlacements = useMemo(
    () => parseNoteStickerPlacements(note.stickerPlacementsJson),
    [note.stickerPlacementsJson]
  );
  const displayedText = useMemo(
    () => formatNoteTextWithEmoji(note.content, note.moodEmoji),
    [note.content, note.moodEmoji]
  );
  const locationLabel = note.locationName?.trim() || fallbackLocationLabel;
  const dateLabel = formatPolaroidDate(note.createdAt);

  return (
    <View
      ref={ref}
      collapsable={false}
      onLayout={() => setLayoutReady(true)}
      style={styles.captureCanvas}
    >
      <View style={[styles.backdropBlob, styles.backdropBlobTop]} />
      <View style={[styles.backdropBlob, styles.backdropBlobBottom]} />
      <View style={styles.polaroidShadow} />
      <View collapsable={false} style={styles.polaroidFrame}>
        <View style={styles.noteCardSlot}>
          {note.type === 'photo' ? (
            <View style={styles.photoCard}>
              <PhotoMediaView
                imageUrl={getNotePhotoUri(note)}
                isLivePhoto={note.isLivePhoto}
                pairedVideoUri={getNotePairedVideoUri(note)}
                showLiveBadge={Boolean(note.isLivePhoto)}
                enablePlayback={false}
                onImageReady={() => setMediaReady(true)}
                style={styles.photoMedia}
                imageStyle={styles.photoMedia}
              />
              {stickerPlacements.length > 0 ? (
                <View
                  pointerEvents="none"
                  testID="polaroid-export-sticker-overlay"
                  style={styles.stickerOverlay}
                >
                  <NoteStickerCanvas
                    placements={stickerPlacements}
                    editable={false}
                    stampShadowEnabled={false}
                  />
                </View>
              ) : null}
              {doodleStrokes.length > 0 ? (
                <View
                  pointerEvents="none"
                  testID="polaroid-export-doodle-overlay"
                  style={styles.doodleOverlay}
                >
                  <NoteDoodleCanvas strokes={doodleStrokes} strokeWidth={11} />
                </View>
              ) : null}
              <PhotoCaptionChip
                caption={note.caption ?? ''}
                color="#2C241E"
                isDark={false}
                numberOfLines={2}
                overlayStyle={styles.photoCaptionOverlay}
                fieldStyle={styles.exportCaptionField}
                textStyle={styles.exportCaptionText}
              />
            </View>
          ) : (
            <LinearGradient
              colors={gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.textCard}
            >
              <PremiumNoteFinishOverlay
                noteColor={note.noteColor}
                animated={false}
                interactive={false}
                previewMode="saved"
              />
              {stickerPlacements.length > 0 ? (
                <View
                  pointerEvents="none"
                  testID="polaroid-export-sticker-overlay"
                  style={styles.stickerOverlay}
                >
                  <NoteStickerCanvas
                    placements={stickerPlacements}
                    editable={false}
                    stampShadowEnabled={false}
                  />
                </View>
              ) : null}
              {doodleStrokes.length > 0 ? (
                <View
                  pointerEvents="none"
                  testID="polaroid-export-doodle-overlay"
                  style={styles.doodleOverlay}
                >
                  <NoteDoodleCanvas strokes={doodleStrokes} strokeWidth={11} />
                </View>
              ) : null}
              <View testID="polaroid-export-text-content" style={styles.textContent}>
                <Text
                  numberOfLines={8}
                  style={[
                    noteCardTextStyles.memoryText,
                    getNoteCardTextSizeStyle(displayedText),
                    styles.exportText,
                    displayedText.length > 100 ? styles.exportTextMedium : null,
                    displayedText.length > 200 ? styles.exportTextSmall : null,
                  ]}
                >
                  {displayedText}
                </Text>
              </View>
            </LinearGradient>
          )}
        </View>
        <View style={styles.strip}>
          <Text numberOfLines={1} style={styles.locationLabel}>
            {locationLabel}
          </Text>
          <Text numberOfLines={1} style={styles.dateLabel}>
            {dateLabel}
          </Text>
          <Text style={styles.watermarkLabel}>ノート</Text>
        </View>
      </View>
    </View>
  );
}

const PolaroidExportView = forwardRef<View, PolaroidExportViewProps>(PolaroidExportViewInner);

export default memo(PolaroidExportView);

const styles = StyleSheet.create({
  captureCanvas: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: '#E5D5C2',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  backdropBlob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.5,
  },
  backdropBlobTop: {
    width: 640,
    height: 640,
    top: -170,
    right: -120,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  backdropBlobBottom: {
    width: 720,
    height: 720,
    bottom: -280,
    left: -190,
    backgroundColor: 'rgba(184,138,102,0.16)',
  },
  polaroidShadow: {
    position: 'absolute',
    width: POLAROID_WIDTH,
    height: POLAROID_CARD_SIZE + POLAROID_TOP_PADDING + POLAROID_BOTTOM_PADDING,
    borderRadius: 42,
    backgroundColor: 'rgba(83, 55, 34, 0.14)',
    transform: [{ translateY: 22 }, { rotate: '-2deg' }],
    shadowColor: '#3B2416',
    shadowOffset: { width: 0, height: 26 },
    shadowOpacity: 0.18,
    shadowRadius: 42,
  },
  polaroidFrame: {
    width: POLAROID_WIDTH,
    paddingTop: POLAROID_TOP_PADDING,
    paddingHorizontal: POLAROID_SIDE_PADDING,
    paddingBottom: 36,
    borderRadius: 38,
    backgroundColor: '#FBF8F2',
  },
  noteCardSlot: {
    width: POLAROID_CARD_SIZE,
    height: POLAROID_CARD_SIZE,
    overflow: 'hidden',
    borderRadius: Layout.cardRadius,
    backgroundColor: '#D9C3AF',
  },
  photoCard: {
    width: '100%',
    height: '100%',
    borderRadius: Layout.cardRadius,
    overflow: 'hidden',
  },
  photoMedia: {
    width: '100%',
    height: '100%',
  },
  textCard: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 64,
  },
  textContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 1,
  },
  exportText: {
    fontSize: 56,
    lineHeight: 72,
    letterSpacing: -1.2,
    textShadowRadius: 8,
    position: 'relative',
    zIndex: 1,
  },
  exportTextMedium: {
    fontSize: 42,
    lineHeight: 56,
  },
  exportTextSmall: {
    fontSize: 34,
    lineHeight: 46,
  },
  stickerOverlay: {
    position: 'absolute',
    ...STICKER_ARTBOARD_FRAME,
    zIndex: 0,
  },
  doodleOverlay: {
    position: 'absolute',
    ...DOODLE_ARTBOARD_FRAME,
    zIndex: 0,
  },
  photoCaptionOverlay: {
    zIndex: 1,
  },
  exportCaptionField: {
    maxWidth: '82%',
    minHeight: 58,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderColor: 'rgba(255,255,255,0.6)',
  },
  exportCaptionText: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    fontFamily: Typography.body.fontFamily,
  },
  strip: {
    minHeight: POLAROID_BOTTOM_PADDING,
    paddingTop: 28,
    paddingHorizontal: 8,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  locationLabel: {
    color: '#5B4336',
    fontSize: 38,
    lineHeight: 44,
    fontFamily: Fonts.serif,
    fontWeight: '600',
    marginBottom: 10,
  },
  dateLabel: {
    color: '#8B6F5C',
    fontSize: 21,
    lineHeight: 28,
    fontFamily: Typography.body.fontFamily,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  watermarkLabel: {
    position: 'absolute',
    right: 14,
    bottom: 6,
    color: 'rgba(91, 67, 54, 0.4)',
    fontSize: 22,
    letterSpacing: 0.6,
    fontWeight: '700',
    fontFamily: Fonts.sans,
  },
});

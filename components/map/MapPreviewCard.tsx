import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../ui/GlassView';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { MapPointGroup, NearbyNoteItem } from '../../hooks/map/mapDomain';
import { useTheme } from '../../hooks/useTheme';
import type { Note } from '../../services/database';
import { getTextNoteCardGradient } from '../../services/noteAppearance';
import { getNotePhotoUri } from '../../services/photoStorage';
import { formatNoteTextWithEmoji } from '../../services/noteTextPresentation';
import { isOlderIOS } from '../../utils/platform';
import MapPreviewSheet from './MapPreviewSheet';
import { getOverlayBorderColor, getOverlayFallbackColor, mapOverlayTokens } from './overlayTokens';

const PREVIEW_HORIZONTAL_INSET = 14;

type PreviewMode = 'group' | 'nearby';

interface MapPreviewCardProps {
  previewMode: PreviewMode;
  visible: boolean;
  selectedGroup: MapPointGroup | null;
  selectedNoteIndex: number;
  nearbyItems: NearbyNoteItem[];
  activeNearbyNoteId: string | null;
  bottomOffset: number;
  onOpenNote: (noteId: string) => void;
  onDismiss: () => void;
  onFocusNearbyNote: (noteId: string) => void;
  onFocusGroupNote: (noteId: string) => void;
  onInteraction?: () => void;
  reduceMotionEnabled: boolean;
}

interface PreviewRailItem {
  note: Note;
  distanceMeters: number | null;
}

function formatDistanceLabel(distanceMeters: number) {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)}m`;
  }

  const km = distanceMeters / 1000;
  return `${km.toFixed(km >= 10 ? 0 : 1)}km`;
}

function getPreviewText(note: Note, photoLabel: string, noContentLabel: string) {
  if (note.type === 'photo') {
    return photoLabel;
  }

  const normalized = note.content.trim();
  if (!normalized) {
    return noContentLabel;
  }

  const displayText = formatNoteTextWithEmoji(normalized, note.moodEmoji);
  return displayText.substring(0, 120) + (displayText.length > 120 ? '…' : '');
}

export default function MapPreviewCard({
  previewMode,
  visible,
  selectedGroup,
  selectedNoteIndex,
  nearbyItems,
  activeNearbyNoteId,
  bottomOffset,
  onOpenNote,
  onDismiss,
  onFocusNearbyNote,
  onFocusGroupNote,
  onInteraction,
  reduceMotionEnabled,
}: MapPreviewCardProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const hasAlignedInitialPreviewRef = useRef(false);
  const previewListRef = useRef<any>(null);
  const previewDraggingRef = useRef(false);
  const prevPreviewModeRef = useRef(previewMode);
  const lastVisiblePreviewStateRef = useRef<{
    previewMode: PreviewMode;
    selectedGroup: MapPointGroup | null;
    selectedNoteIndex: number;
  } | null>(null);

  const [isMounted, setIsMounted] = useState(visible);

  useEffect(() => {
    if (!visible) {
      return;
    }

    lastVisiblePreviewStateRef.current = {
      previewMode,
      selectedGroup,
      selectedNoteIndex,
    };
  }, [previewMode, selectedGroup, selectedNoteIndex, visible]);

  const renderPreviewMode = visible
    ? previewMode
    : lastVisiblePreviewStateRef.current?.previewMode ?? previewMode;
  const renderSelectedGroup = visible
    ? selectedGroup
    : lastVisiblePreviewStateRef.current?.selectedGroup ?? selectedGroup;
  const renderSelectedNoteIndex = visible
    ? selectedNoteIndex
    : lastVisiblePreviewStateRef.current?.selectedNoteIndex ?? selectedNoteIndex;

  useEffect(() => {
    if (visible && !isMounted) {
      setIsMounted(true);
    }
  }, [visible, isMounted]);

  const handleFullyClosed = useCallback(() => {
    setIsMounted(false);
  }, []);

  const nearbyPageWidth = useMemo(
    () => Math.max(0, windowWidth - PREVIEW_HORIZONTAL_INSET * 2 - mapOverlayTokens.overlayPadding * 2),
    [windowWidth]
  );

  const isGroupMode = renderPreviewMode === 'group' && Boolean(renderSelectedGroup);

  const previewItems = useMemo<PreviewRailItem[]>(
    () =>
      isGroupMode && renderSelectedGroup
        ? renderSelectedGroup.notes.map((note) => ({
            note,
            distanceMeters: null,
          }))
        : nearbyItems.map((item) => ({
            note: item.note,
            distanceMeters: item.distanceMeters,
          })),
    [isGroupMode, nearbyItems, renderSelectedGroup]
  );

  const activeNearbyIndex = useMemo(
    () => nearbyItems.findIndex((item) => item.note.id === activeNearbyNoteId),
    [activeNearbyNoteId, nearbyItems]
  );

  const activeIndex = useMemo(() => {
    if (previewItems.length === 0) {
      return -1;
    }

    if (isGroupMode) {
      return Math.max(0, Math.min(renderSelectedNoteIndex, previewItems.length - 1));
    }

    return activeNearbyIndex >= 0 ? activeNearbyIndex : 0;
  }, [activeNearbyIndex, isGroupMode, previewItems.length, renderSelectedNoteIndex]);

  const activePreviewItem = useMemo(() => {
    if (previewItems.length === 0) {
      return null;
    }

    return activeIndex >= 0 ? previewItems[activeIndex] ?? previewItems[0] : previewItems[0];
  }, [activeIndex, previewItems]);

  // Survive parent state clearing the items while we animate out
  const lastValidDataRef = useRef<{
    previewItems: PreviewRailItem[];
    activeIndex: number;
    activePreviewItem: PreviewRailItem;
  } | null>(null);

  if (activePreviewItem && previewItems.length > 0) {
    lastValidDataRef.current = {
      previewItems,
      activeIndex,
      activePreviewItem,
    };
  }

  const renderData = (activePreviewItem && previewItems.length > 0)
    ? { previewItems, activeIndex, activePreviewItem }
    : lastValidDataRef.current;

  useEffect(() => {
    const modeChanged = prevPreviewModeRef.current !== renderPreviewMode;
    prevPreviewModeRef.current = renderPreviewMode;

    if (!previewListRef.current || activeIndex < 0) {
      return;
    }

    previewListRef.current.scrollToOffset({
      offset: activeIndex * nearbyPageWidth,
      animated: hasAlignedInitialPreviewRef.current && !reduceMotionEnabled,
    });
    hasAlignedInitialPreviewRef.current = true;

    if (modeChanged) {
      previewDraggingRef.current = false;
    }
  }, [activeIndex, nearbyPageWidth, renderPreviewMode, reduceMotionEnabled]);

  const handlePreviewMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!previewDraggingRef.current) {
        return;
      }
      previewDraggingRef.current = false;

      const xOffset = event.nativeEvent.contentOffset.x;
      const nextIndex = Math.round(xOffset / nearbyPageWidth);
      const boundedIndex = Math.max(0, Math.min(nextIndex, previewItems.length - 1));
      const item = previewItems[boundedIndex];
      if (!item) {
        return;
      }

      if (isGroupMode) {
        onFocusGroupNote(item.note.id);
        return;
      }

      onFocusNearbyNote(item.note.id);
    },
    [isGroupMode, nearbyPageWidth, onFocusGroupNote, onFocusNearbyNote, previewItems]
  );

  if (!isMounted && !visible) {
    return null;
  }

  if (!renderData) {
    return null;
  }

  const {
    previewItems: renderItems,
    activeIndex: renderIndex,
    activePreviewItem: renderItem,
  } = renderData;

  const previewCountLabel = `${Math.max(renderIndex, 0) + 1}/${renderItems.length}`;
  const pointerEvents = 'auto';
  // Use a stable key so re-renders from state don't break the animation sheet container
  const sheetInstanceKey = isGroupMode && renderSelectedGroup ? `group:${renderSelectedGroup.id}` : 'nearby';

  return (
    <MapPreviewSheet
      key={sheetInstanceKey}
      isVisible={visible}
      onFullyClosed={handleFullyClosed}
      shellTestID="map-preview-shell"
      dismissTestID="map-preview-dismiss"
      bottomOffset={bottomOffset}
      handleColor={isDark ? 'rgba(255,255,255,0.34)' : 'rgba(60,60,67,0.22)'}
      onDismiss={onDismiss}
      reduceMotionEnabled={reduceMotionEnabled}
    >
      <View
        style={[
          styles.inner,
          { borderColor: getOverlayBorderColor(isDark) },
        ]}
        pointerEvents={pointerEvents}
      >
        <GlassView
          pointerEvents="none"
          glassEffectStyle="regular"
          colorScheme={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        {isOlderIOS ? (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: getOverlayFallbackColor(isDark),
                borderRadius: mapOverlayTokens.overlayRadius,
              },
            ]}
          />
        ) : null}

        {isGroupMode ? (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.modeHighlight,
              { backgroundColor: `${colors.primary}14` },
            ]}
          />
        ) : null}

        <View style={styles.cardContent}>
          <FlashList
            ref={previewListRef}
            testID="map-preview-list"
            horizontal
            data={renderItems}
            keyExtractor={(item) => item.note.id}
            drawDistance={nearbyPageWidth * 2}
            renderItem={({ item }) => {
              const cardPreview = getPreviewText(
                item.note,
                t('map.photoNote', 'Photo Note'),
                t('map.noContent', 'No note content')
              );
              const photoUri = item.note.type === 'photo' ? getNotePhotoUri(item.note) : '';
              const textTileGradient = getTextNoteCardGradient({
                text: item.note.content,
                noteId: item.note.id,
                emoji: item.note.moodEmoji,
                noteColor: item.note.noteColor,
              });
              const metaLabel = isGroupMode
                ? t('map.singleNote', 'Pinned note')
                : formatDistanceLabel(item.distanceMeters ?? 0);

              return (
                <Pressable
                  testID={`map-preview-item-${item.note.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: item.note.id === renderItem.note.id }}
                  style={[styles.previewPage, { width: nearbyPageWidth }]}
                  onPress={() => {
                    previewDraggingRef.current = false;
                    onInteraction?.();

                    const isCurrentlyCentered = item.note.id === renderItem.note.id;

                    if (isGroupMode) {
                      onFocusGroupNote(item.note.id);
                    } else {
                      onFocusNearbyNote(item.note.id);
                    }

                    if (isCurrentlyCentered) {
                      onOpenNote(item.note.id);
                    } else {
                      setTimeout(() => {
                        onOpenNote(item.note.id);
                      }, 350);
                    }
                  }}
                >
                  <View style={styles.previewPageInner}>
                    {photoUri ? (
                      <View>
                        <Image
                          testID={`map-preview-image-${item.note.id}`}
                          source={{ uri: photoUri }}
                          style={[
                            styles.photoThumb,
                            {
                              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                            },
                          ]}
                          contentFit="cover"
                          transition={0}
                        />
                      </View>
                    ) : (
                      <LinearGradient
                        colors={textTileGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.textThumb}
                      >
                        <View style={styles.textThumbPaper}>
                          <View style={[styles.textThumbLine, styles.textThumbLineLong]} />
                          <View style={[styles.textThumbLine, styles.textThumbLineMedium]} />
                          <View style={[styles.textThumbLine, styles.textThumbLineShort]} />
                        </View>
                      </LinearGradient>
                    )}
                    <View style={styles.copyWrap}>
                      <View style={styles.titleRow}>
                        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                          {item.note.locationName || t('map.unknownLocation', 'Unknown')}
                        </Text>
                      </View>
                      <Text style={[styles.content, { color: colors.secondaryText }]} numberOfLines={1}>
                        {cardPreview}
                      </Text>
                      <View style={styles.metaRow}>
                        <Ionicons
                          name={isGroupMode ? 'pin' : 'navigate'}
                          size={12}
                          color={colors.secondaryText}
                        />
                        <Text style={[styles.metaText, { color: colors.secondaryText }]}>{metaLabel}</Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            }}
            style={styles.previewList}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.previewListContent}
            snapToInterval={nearbyPageWidth > 0 ? nearbyPageWidth : undefined}
            decelerationRate="fast"
            snapToAlignment="start"
            disableIntervalMomentum
            bounces={false}
            scrollEnabled={renderItems.length > 1}
            onScrollBeginDrag={() => {
              previewDraggingRef.current = true;
            }}
            onMomentumScrollEnd={handlePreviewMomentumEnd}
          />

          <View style={styles.footer}>
            <View style={styles.indexLabelWrap}>
              <Text style={[styles.indexText, { color: colors.secondaryText }]} testID="map-preview-index">
                {previewCountLabel}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </MapPreviewSheet>
  );
}

const styles = StyleSheet.create({
  inner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: mapOverlayTokens.overlayRadius,
    ...mapOverlayTokens.overlayShadow,
    overflow: 'hidden',
  },
  cardContent: {
    paddingHorizontal: mapOverlayTokens.overlayPadding,
    paddingTop: mapOverlayTokens.overlayPadding + 14,
    paddingBottom: mapOverlayTokens.overlayPadding,
  },
  modeHighlight: {
    borderRadius: mapOverlayTokens.overlayRadius,
  },
  previewList: {
    marginBottom: 6,
  },
  previewListContent: {
    gap: 0,
  },
  previewPage: {
    minHeight: 64,
  },
  previewPageInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: mapOverlayTokens.overlayGap,
    minHeight: 64,
  },
  copyWrap: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  photoThumb: {
    width: 54,
    height: 54,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  textThumb: {
    width: 54,
    height: 54,
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  textThumbPaper: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,252,246,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
    paddingHorizontal: 8,
    paddingVertical: 9,
    justifyContent: 'space-between',
  },
  textThumbLine: {
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(92,74,58,0.34)',
  },
  textThumbLineLong: {
    width: '100%',
  },
  textThumbLineMedium: {
    width: '78%',
  },
  textThumbLineShort: {
    width: '62%',
  },
  metaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'System',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 3,
    fontFamily: 'System',
  },
  content: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: 'System',
  },
  footer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  indexLabelWrap: {
    minWidth: 34,
  },
  indexText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'System',
  },
});

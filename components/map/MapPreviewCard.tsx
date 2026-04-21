import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { GlassView } from '../ui/GlassView';
import type { MapPointGroup, NearbyNoteItem } from '../../hooks/map/mapDomain';
import { useTheme } from '../../hooks/useTheme';
import type { Note } from '../../services/database';
import { getTextNoteCardGradient } from '../../services/noteAppearance';
import { getNotePhotoUri } from '../../services/photoStorage';
import { getNotePreviewText } from '../../services/noteTextPresentation';
import { isOlderIOS } from '../../utils/platform';
import { MapPreviewPositionPill, mapPreviewFooterStyles } from './MapPreviewFooterControls';
import MapPreviewSheet from './MapPreviewSheet';
import {
  getOverlayBorderColor,
  getOverlayFallbackColor,
  getOverlayScrimColor,
  mapOverlayTokens,
} from './overlayTokens';

const PREVIEW_HORIZONTAL_INSET = 14;
const PREVIEW_MEDIA_SIZE = 58;
const PREVIEW_ROW_GAP = 10;

type PreviewMode = 'group' | 'nearby';

interface MapPreviewCardProps {
  previewMode: PreviewMode;
  visible: boolean;
  selectedGroup: MapPointGroup | null;
  selectedNoteIndex: number;
  nearbyItems: NearbyNoteItem[];
  activeNearbyNoteId: string | null;
  activeNoteReadyToOpen: boolean;
  bottomOffset: number;
  onFocusPreviewNote: (noteId: string) => void;
  onOpenPreviewNote: (noteId: string) => void;
  onPrimaryAction: () => void;
  onDismiss: () => void;
  onInteraction?: () => void;
  reduceMotionEnabled: boolean;
  externalExpansionProgress?: SharedValue<number>;
}

interface PreviewRailItem {
  note: Note;
}

function getPreviewText(note: Note, photoLabel: string, noContentLabel: string) {
  return getNotePreviewText(note, {
    photoLabel,
    emptyLabel: noContentLabel,
    maxLength: 120,
  });
}

export default function MapPreviewCard({
  previewMode,
  visible,
  selectedGroup,
  selectedNoteIndex,
  nearbyItems,
  activeNearbyNoteId,
  activeNoteReadyToOpen,
  bottomOffset,
  onFocusPreviewNote,
  onOpenPreviewNote,
  onPrimaryAction,
  onDismiss,
  onInteraction,
  reduceMotionEnabled,
  externalExpansionProgress,
}: MapPreviewCardProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const previewListRef = useRef<any>(null);
  const previewDraggingRef = useRef(false);
  const lastAlignedIndexRef = useRef<number | null>(null);
  const lastVisiblePreviewStateRef = useRef<{
    previewMode: PreviewMode;
    selectedGroup: MapPointGroup | null;
    selectedNoteIndex: number;
  } | null>(null);
  const previewDataCacheRef = useRef<{
    previewItems: PreviewRailItem[];
    activeIndex: number;
    activePreviewItem: PreviewRailItem;
  } | null>(null);

  const [isMounted, setIsMounted] = useState(visible);
  const fullSurfaceWidth = Math.max(0, windowWidth - PREVIEW_HORIZONTAL_INSET * 2);
  const nearbyPageWidth = Math.max(0, fullSurfaceWidth - mapOverlayTokens.overlayPadding * 2);

  useEffect(() => {
    if (visible && !isMounted) {
      setIsMounted(true);
    }
  }, [visible, isMounted]);

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

  useEffect(() => {
    if (externalExpansionProgress) {
      externalExpansionProgress.value = 0;
    }
  }, [externalExpansionProgress, visible]);

  const handleFullyClosed = useCallback(() => {
    setIsMounted(false);
  }, []);

  const shouldUseCurrentPreviewState = visible;
  const renderPreviewMode = shouldUseCurrentPreviewState
    ? previewMode
    : lastVisiblePreviewStateRef.current?.previewMode ?? previewMode;
  const renderSelectedGroup = shouldUseCurrentPreviewState
    ? selectedGroup
    : lastVisiblePreviewStateRef.current?.selectedGroup ?? selectedGroup;
  const renderSelectedNoteIndex = shouldUseCurrentPreviewState
    ? selectedNoteIndex
    : lastVisiblePreviewStateRef.current?.selectedNoteIndex ?? selectedNoteIndex;
  const isGroupMode = renderPreviewMode === 'group' && Boolean(renderSelectedGroup);

  const previewItems = useMemo<PreviewRailItem[]>(
    () =>
      isGroupMode && renderSelectedGroup
        ? renderSelectedGroup.notes.map((note) => ({ note }))
        : nearbyItems.map((item) => ({
            note: item.note,
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

  if (activePreviewItem && previewItems.length > 0) {
    previewDataCacheRef.current = {
      previewItems,
      activeIndex,
      activePreviewItem,
    };
  }

  const renderData =
    activePreviewItem && previewItems.length > 0
      ? { previewItems, activeIndex, activePreviewItem }
      : previewDataCacheRef.current;

  useEffect(() => {
    if (!visible || !previewListRef.current || activeIndex < 0) {
      return;
    }

    if (lastAlignedIndexRef.current === activeIndex) {
      return;
    }

    previewListRef.current.scrollToOffset({
      offset: activeIndex * nearbyPageWidth,
      animated: lastAlignedIndexRef.current !== null && !reduceMotionEnabled,
    });
    lastAlignedIndexRef.current = activeIndex;
  }, [activeIndex, nearbyPageWidth, reduceMotionEnabled, visible]);

  const commitNearbyFocus = useCallback(
    (nextIndex: number) => {
      const boundedIndex = Math.max(0, Math.min(nextIndex, previewItems.length - 1));
      const item = previewItems[boundedIndex];
      if (!item) {
        return;
      }

      onFocusPreviewNote(item.note.id);
    },
    [onFocusPreviewNote, previewItems]
  );

  const handlePreviewMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!previewDraggingRef.current) {
        return;
      }
      previewDraggingRef.current = false;

      const xOffset = event.nativeEvent.contentOffset.x;
      const nextIndex = Math.round(xOffset / nearbyPageWidth);
      commitNearbyFocus(nextIndex);
    },
    [commitNearbyFocus, nearbyPageWidth]
  );

  const activeRenderPreviewNoteId = renderData?.activePreviewItem.note.id ?? null;

  const handlePreviewItemPress = useCallback(
    (noteId: string) => {
      previewDraggingRef.current = false;
      onInteraction?.();
      if (activeRenderPreviewNoteId === noteId) {
        onOpenPreviewNote(noteId);
        return;
      }

      onFocusPreviewNote(noteId);
    },
    [activeRenderPreviewNoteId, onFocusPreviewNote, onInteraction, onOpenPreviewNote]
  );

  const previewActionLabel = activeNoteReadyToOpen
    ? t('map.openNoteAction', 'Open note')
    : t('map.centerOnMapAction', 'View on map');
  const previewActionIcon = activeNoteReadyToOpen ? 'arrow-forward-circle' : 'locate';
  const showPreviewCount = Boolean(renderData && renderData.previewItems.length > 1);
  const previewPosition = renderData ? Math.max(renderData.activeIndex, 0) + 1 : 0;
  const previewTotal = renderData?.previewItems.length ?? 0;

  if ((!isMounted && !visible) || !renderData) {
    return null;
  }

  return (
    <MapPreviewSheet
      isVisible={visible}
      onFullyClosed={handleFullyClosed}
      shellTestID="map-preview-shell"
      dismissTestID="map-preview-dismiss"
      bottomOffset={bottomOffset}
      onDismiss={onDismiss}
      reduceMotionEnabled={reduceMotionEnabled}
      allowHandlePress={false}
      allowDismiss
      allowDragDismiss
      allowExpand={false}
      handleVisible
    >
      <View style={[styles.surfaceHost, { width: fullSurfaceWidth }]} pointerEvents="box-none">
        <View
          style={[
            styles.surface,
            {
              borderColor: getOverlayBorderColor(isDark),
              backgroundColor: getOverlayFallbackColor(isDark),
            },
          ]}
        >
          <GlassView
            pointerEvents="none"
            glassEffectStyle="regular"
            colorScheme={isDark ? 'dark' : 'light'}
            fallbackColor="transparent"
            style={StyleSheet.absoluteFill}
          />
          {Platform.OS === 'android' ? (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: getOverlayScrimColor(isDark),
                },
              ]}
            />
          ) : null}
          {isOlderIOS ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: getOverlayFallbackColor(isDark),
                },
              ]}
            />
          ) : null}

          <View style={styles.cardContent}>
            <FlashList
              ref={previewListRef}
              testID="map-preview-list"
              horizontal
              data={renderData.previewItems}
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
                  fallbackGradient: colors.captureGradient,
                });
                const isActive = item.note.id === renderData.activePreviewItem.note.id;

                return (
                  <Pressable
                    testID={`map-preview-item-${item.note.id}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    style={({ pressed }) => [
                      styles.previewPage,
                      { width: nearbyPageWidth, opacity: pressed ? 0.88 : 1 },
                    ]}
                    onPress={() => handlePreviewItemPress(item.note.id)}
                  >
                    <View style={styles.previewPageInner}>
                      <View style={styles.mediaWrap}>
                        {photoUri ? (
                          <Image
                            testID={`map-preview-image-${item.note.id}`}
                            source={{ uri: photoUri }}
                            style={[
                              styles.photoThumb,
                              {
                                backgroundColor: isDark
                                  ? 'rgba(255,255,255,0.06)'
                                  : 'rgba(0,0,0,0.04)',
                              },
                            ]}
                            contentFit="cover"
                            transition={0}
                          />
                        ) : (
                          <LinearGradient
                            colors={textTileGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.textThumb}
                          >
                            <View
                              style={[
                                styles.textThumbPaper,
                                {
                                  backgroundColor: isDark
                                    ? 'rgba(28,28,30,0.76)'
                                    : 'rgba(255,255,255,0.78)',
                                  borderColor: isDark
                                    ? 'rgba(255,255,255,0.12)'
                                    : 'rgba(255,255,255,0.44)',
                                },
                              ]}
                            >
                              <View
                                style={[
                                  styles.textThumbLine,
                                  styles.textThumbLineLong,
                                  {
                                    backgroundColor: isDark
                                      ? 'rgba(255,247,232,0.22)'
                                      : 'rgba(92,74,58,0.22)',
                                  },
                                ]}
                              />
                              <View
                                style={[
                                  styles.textThumbLine,
                                  styles.textThumbLineMedium,
                                  {
                                    backgroundColor: isDark
                                      ? 'rgba(255,247,232,0.22)'
                                      : 'rgba(92,74,58,0.22)',
                                  },
                                ]}
                              />
                              <View
                                style={[
                                  styles.textThumbLine,
                                  styles.textThumbLineShort,
                                  {
                                    backgroundColor: isDark
                                      ? 'rgba(255,247,232,0.22)'
                                      : 'rgba(92,74,58,0.22)',
                                  },
                                ]}
                              />
                            </View>
                          </LinearGradient>
                        )}
                      </View>

                      <View style={styles.copyWrap}>
                        <Text
                          style={[styles.eyebrow, { color: isActive ? colors.primary : colors.secondaryText }]}
                          numberOfLines={1}
                        >
                          {item.note.type === 'photo'
                            ? t('map.photoNote', 'Photo Note')
                            : t('map.noteAtPlace', 'Saved here')}
                        </Text>
                        <Text
                          style={[styles.title, { color: isActive ? colors.primary : colors.text }]}
                          numberOfLines={1}
                        >
                          {item.note.locationName || t('map.unknownLocation', 'Unknown')}
                        </Text>
                        <Text
                          style={[styles.content, { color: colors.secondaryText }]}
                          numberOfLines={2}
                        >
                          {cardPreview}
                        </Text>
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
              scrollEnabled={renderData.previewItems.length > 1}
              onScrollBeginDrag={() => {
                previewDraggingRef.current = true;
              }}
              onScrollEndDrag={(event) => {
                const velocityX = event.nativeEvent.velocity?.x ?? 0;
                if (Math.abs(velocityX) > 0.05) {
                  return;
                }

                handlePreviewMomentumEnd(event);
              }}
              onMomentumScrollEnd={handlePreviewMomentumEnd}
            />

            <View style={mapPreviewFooterStyles.footer}>
              {showPreviewCount ? (
                <MapPreviewPositionPill
                  current={previewPosition}
                  total={previewTotal}
                  testID="map-preview-index"
                />
              ) : (
                <View />
              )}

              <Pressable
                testID="map-preview-primary-action"
                accessibilityRole="button"
                accessibilityLabel={previewActionLabel}
                onPress={() => {
                  onInteraction?.();
                  onPrimaryAction();
                }}
                style={({ pressed }) => [
                  styles.actionButton,
                  { backgroundColor: `${colors.primary}14`, opacity: pressed ? 0.72 : 1 },
                ]}
                hitSlop={8}
              >
                <Ionicons
                  name={previewActionIcon}
                  size={14}
                  color={activeNoteReadyToOpen ? colors.primary : colors.secondaryText}
                />
                <Text
                  testID="map-preview-action"
                  style={[
                    styles.actionText,
                    { color: activeNoteReadyToOpen ? colors.primary : colors.secondaryText },
                  ]}
                  numberOfLines={1}
                >
                  {previewActionLabel}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </MapPreviewSheet>
  );
}

const styles = StyleSheet.create({
  surfaceHost: {
    alignSelf: 'center',
  },
  surface: {
    borderWidth: Platform.OS === 'android' ? 1 : StyleSheet.hairlineWidth,
    borderRadius: mapOverlayTokens.overlayRadius,
    overflow: 'hidden',
  },
  cardContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  previewList: {
    marginBottom: 8,
  },
  previewListContent: {
    gap: 0,
  },
  previewPage: {
    minHeight: 70,
  },
  previewPageInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PREVIEW_ROW_GAP,
    minHeight: 70,
  },
  mediaWrap: {
    width: PREVIEW_MEDIA_SIZE,
    height: PREVIEW_MEDIA_SIZE,
    borderRadius: 16,
    overflow: 'hidden',
    flexShrink: 0,
  },
  copyWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  textThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  textThumbPaper: {
    width: 40,
    height: 40,
    borderRadius: 11,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: 7,
    justifyContent: 'center',
    gap: 3,
  },
  textThumbLine: {
    height: 2.5,
    borderRadius: 999,
  },
  textThumbLineLong: {
    width: '100%',
  },
  textThumbLineMedium: {
    width: '72%',
  },
  textThumbLineShort: {
    width: '46%',
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.24,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
    marginBottom: 3,
    fontFamily: 'Noto Sans',
  },
  content: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Noto Sans',
  },
  actionButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
    flexShrink: 1,
  },
});

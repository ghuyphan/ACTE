import { Ionicons } from '@expo/vector-icons';
import { GlassView } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Reanimated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { MapPointGroup, NearbyNoteItem } from '../../hooks/map/mapDomain';
import { useTheme } from '../../hooks/useTheme';
import type { Note } from '../../services/database';
import { getNotePhotoUri } from '../../services/photoStorage';
import { isOlderIOS } from '../../utils/platform';
import {
  getMapCardEnter,
  getMapCardExit,
  getMapLayoutTransition,
  mapMotionDurations,
  mapMotionEasing,
} from './mapMotion';
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
  onOpen: () => void;
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

  return normalized.substring(0, 120) + (normalized.length > 120 ? '…' : '');
}

export default function MapPreviewCard({
  previewMode,
  visible,
  selectedGroup,
  selectedNoteIndex,
  nearbyItems,
  activeNearbyNoteId,
  bottomOffset,
  onOpen,
  onFocusNearbyNote,
  onFocusGroupNote,
  onInteraction,
  reduceMotionEnabled,
}: MapPreviewCardProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const railOffsetY = useSharedValue(0);
  const visibilityProgress = useSharedValue(visible ? 1 : 0);
  const modeProgress = useSharedValue(previewMode === 'group' ? 1 : 0);
  const contentOpacity = useSharedValue(1);
  const prevBottomOffsetRef = useRef(bottomOffset);
  const skippedInitialBottomShiftRef = useRef(false);
  const hasAlignedInitialPreviewRef = useRef(false);
  const previewListRef = useRef<FlatList<PreviewRailItem>>(null);
  const previewDraggingRef = useRef(false);
  const prevPreviewModeRef = useRef(previewMode);

  const nearbyPageWidth = useMemo(
    () => Math.max(0, windowWidth - PREVIEW_HORIZONTAL_INSET * 2 - mapOverlayTokens.overlayPadding * 2),
    [windowWidth]
  );

  const isGroupMode = previewMode === 'group' && Boolean(selectedGroup);

  const previewItems = useMemo<PreviewRailItem[]>(
    () =>
      isGroupMode && selectedGroup
        ? selectedGroup.notes.map((note) => ({
            note,
            distanceMeters: null,
          }))
        : nearbyItems.map((item) => ({
            note: item.note,
            distanceMeters: item.distanceMeters,
          })),
    [isGroupMode, nearbyItems, selectedGroup]
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
      return Math.max(0, Math.min(selectedNoteIndex, previewItems.length - 1));
    }

    return activeNearbyIndex >= 0 ? activeNearbyIndex : 0;
  }, [activeNearbyIndex, isGroupMode, previewItems.length, selectedNoteIndex]);

  const activePreviewItem = useMemo(() => {
    if (previewItems.length === 0) {
      return null;
    }

    return activeIndex >= 0 ? previewItems[activeIndex] ?? previewItems[0] : previewItems[0];
  }, [activeIndex, previewItems]);

  useEffect(() => {
    visibilityProgress.value = reduceMotionEnabled
      ? withTiming(visible ? 1 : 0, { duration: mapMotionDurations.fast })
      : withTiming(visible ? 1 : 0, { duration: mapMotionDurations.standard });
  }, [reduceMotionEnabled, visibilityProgress, visible]);

  useEffect(() => {
    modeProgress.value = reduceMotionEnabled
      ? withTiming(previewMode === 'group' ? 1 : 0, { duration: mapMotionDurations.fast })
      : withTiming(previewMode === 'group' ? 1 : 0, {
          duration: mapMotionDurations.standard,
          easing: mapMotionEasing.emphasis,
        });

    contentOpacity.value = 0.68;
    contentOpacity.value = reduceMotionEnabled
      ? withTiming(1, { duration: mapMotionDurations.fast })
      : withTiming(1, { duration: mapMotionDurations.slow });
  }, [contentOpacity, modeProgress, previewMode, reduceMotionEnabled]);

  useEffect(() => {
    const prevBottom = prevBottomOffsetRef.current;
    const delta = prevBottom - bottomOffset;
    prevBottomOffsetRef.current = bottomOffset;

    if (delta === 0) {
      return;
    }

    if (!skippedInitialBottomShiftRef.current) {
      skippedInitialBottomShiftRef.current = true;
      railOffsetY.value = 0;
      return;
    }

    railOffsetY.value = delta;
    railOffsetY.value = reduceMotionEnabled
      ? withTiming(0, { duration: mapMotionDurations.fast })
      : withTiming(0, {
          duration: mapMotionDurations.standard,
          easing: mapMotionEasing.standard,
        });
  }, [bottomOffset, railOffsetY, reduceMotionEnabled]);

  useEffect(() => {
    const modeChanged = prevPreviewModeRef.current !== previewMode;
    prevPreviewModeRef.current = previewMode;

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
  }, [activeIndex, nearbyPageWidth, previewMode, reduceMotionEnabled]);

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

  const wrapperAnimatedStyle = useAnimatedStyle(() => {
    const liftedOffset = interpolate(modeProgress.value, [0, 1], [0, -8]);
    const hiddenOffset = interpolate(visibilityProgress.value, [0, 1], [20, 0]);
    return {
      transform: [
        {
          translateY: railOffsetY.value + liftedOffset + hiddenOffset,
        },
        {
          scale: interpolate(visibilityProgress.value, [0, 1], [0.98, 1]),
        },
      ],
    };
  });

  const highlightAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(modeProgress.value, [0, 1], [0.02, 0.09]),
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [
      {
        translateY: interpolate(contentOpacity.value, [0.68, 1], [6, 0]),
      },
    ],
  }));

  if (!visible || !activePreviewItem) {
    return null;
  }

  const previewCountLabel = activePreviewItem ? `${Math.max(activeIndex, 0) + 1}/${previewItems.length}` : '';
  const pointerEvents = visible && activePreviewItem ? 'auto' : 'none';

  return (
    <Reanimated.View
      testID="map-preview-shell"
      style={[
        styles.wrapper,
        {
          bottom: bottomOffset,
        },
        wrapperAnimatedStyle,
      ]}
      pointerEvents={pointerEvents}
      layout={getMapLayoutTransition(reduceMotionEnabled)}
    >
      <View
        style={[
          styles.inner,
          {
            borderColor: getOverlayBorderColor(isDark),
          },
        ]}
      >
        <GlassView
          pointerEvents="none"
          glassEffectStyle="regular"
          colorScheme={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFillObject}
        />
        {isOlderIOS ? (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: getOverlayFallbackColor(isDark),
                borderRadius: mapOverlayTokens.overlayRadius,
              },
            ]}
          />
        ) : null}

        <Reanimated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            styles.modeHighlight,
            { backgroundColor: `${colors.primary}14` },
            highlightAnimatedStyle,
          ]}
        />

        <Reanimated.View layout={getMapLayoutTransition(reduceMotionEnabled)} style={[styles.cardContent, contentAnimatedStyle]}>
          {activePreviewItem ? (
            <>
              <FlatList
                ref={previewListRef}
                testID="map-preview-list"
                horizontal
                data={previewItems}
                keyExtractor={(item) => item.note.id}
                renderItem={({ item }) => {
                  const cardPreview = getPreviewText(
                    item.note,
                    t('map.photoNote', 'Photo Note'),
                    t('map.noContent', 'No note content')
                  );
                  const photoUri = item.note.type === 'photo' ? getNotePhotoUri(item.note) : '';
                  const metaLabel = isGroupMode
                    ? t('map.singleNote', 'Pinned note')
                    : formatDistanceLabel(item.distanceMeters ?? 0);

                  return (
                    <Pressable
                      testID={`map-preview-item-${item.note.id}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: item.note.id === activePreviewItem.note.id }}
                      style={[styles.previewPage, { width: nearbyPageWidth }]}
                      onPress={() => {
                        previewDraggingRef.current = false;
                        onInteraction?.();

                        if (isGroupMode) {
                          onFocusGroupNote(item.note.id);
                          return;
                        }

                        onFocusNearbyNote(item.note.id);

                        const itemIndex = previewItems.findIndex((previewItem) => previewItem.note.id === item.note.id);
                        if (itemIndex >= 0) {
                          previewListRef.current?.scrollToOffset({
                            offset: itemIndex * nearbyPageWidth,
                            animated: !reduceMotionEnabled,
                          });
                        }
                      }}
                    >
                      <Reanimated.View layout={getMapLayoutTransition(reduceMotionEnabled)} style={styles.previewPageInner}>
                        {photoUri ? (
                          <Reanimated.View layout={getMapLayoutTransition(reduceMotionEnabled)}>
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
                              transition={reduceMotionEnabled ? 0 : 120}
                            />
                          </Reanimated.View>
                        ) : null}
                        <View style={styles.copyWrap}>
                          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                            {item.note.locationName || t('map.unknownLocation', 'Unknown')}
                          </Text>
                          <Text style={[styles.content, { color: colors.secondaryText }]} numberOfLines={2}>
                            {cardPreview}
                          </Text>
                          <View style={styles.metaRow}>
                            <Ionicons
                              name={isGroupMode ? 'pin' : 'navigate'}
                              size={12}
                              color={colors.secondaryText}
                            />
                            <Reanimated.Text
                              key={`${previewMode}-${item.note.id}-${metaLabel}`}
                              entering={getMapCardEnter(reduceMotionEnabled)}
                              exiting={getMapCardExit(reduceMotionEnabled)}
                              style={[styles.metaText, { color: colors.secondaryText }]}
                            >
                              {metaLabel}
                            </Reanimated.Text>
                          </View>
                        </View>
                      </Reanimated.View>
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
                scrollEnabled={previewItems.length > 1}
                onScrollBeginDrag={() => {
                  previewDraggingRef.current = true;
                }}
                onMomentumScrollEnd={handlePreviewMomentumEnd}
                onScrollToIndexFailed={() => undefined}
              />

              <Reanimated.View layout={getMapLayoutTransition(reduceMotionEnabled)} style={styles.footer}>
                <View style={styles.indexLabelWrap}>
                  <Reanimated.Text
                    key={previewCountLabel}
                    style={[styles.indexText, { color: colors.secondaryText }]}
                    testID="map-preview-index"
                    entering={getMapCardEnter(reduceMotionEnabled)}
                    exiting={getMapCardExit(reduceMotionEnabled)}
                  >
                    {previewCountLabel}
                  </Reanimated.Text>
                </View>

                <Pressable
                  testID="map-preview-open"
                  style={[
                    styles.actionButton,
                    { backgroundColor: `${colors.primary}1F`, borderColor: `${colors.primary}36` },
                  ]}
                  onPress={() => {
                    onInteraction?.();
                    onOpen();
                  }}
                >
                  <Text style={[styles.actionText, { color: colors.primary }]}>
                    {t('map.openNote', 'Open note')}
                  </Text>
                </Pressable>
              </Reanimated.View>
            </>
          ) : null}
        </Reanimated.View>
      </View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: PREVIEW_HORIZONTAL_INSET,
    right: PREVIEW_HORIZONTAL_INSET,
    zIndex: 12,
  },
  inner: {
    borderWidth: 1,
    borderRadius: mapOverlayTokens.overlayRadius,
    ...mapOverlayTokens.overlayShadow,
    overflow: 'hidden',
  },
  cardContent: {
    paddingHorizontal: mapOverlayTokens.overlayPadding,
    paddingTop: mapOverlayTokens.overlayPadding,
    paddingBottom: mapOverlayTokens.overlayPadding,
  },
  modeHighlight: {
    borderRadius: mapOverlayTokens.overlayRadius,
  },
  previewList: {
    marginBottom: 8,
  },
  previewListContent: {
    gap: 0,
  },
  previewPage: {
    minHeight: 68,
  },
  previewPageInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: mapOverlayTokens.overlayGap,
    minHeight: 68,
  },
  copyWrap: {
    flex: 1,
    minWidth: 0,
  },
  photoThumb: {
    width: 60,
    height: 60,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  metaRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'System',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
    fontFamily: 'System',
  },
  content: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'System',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  indexLabelWrap: {
    minWidth: 34,
  },
  indexText: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'System',
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'System',
  },
});

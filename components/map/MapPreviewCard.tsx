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
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { MapPointGroup, NearbyNoteItem } from '../../hooks/map/mapDomain';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTheme } from '../../hooks/useTheme';
import type { Note } from '../../services/database';
import { isOlderIOS } from '../../utils/platform';
import { getOverlayBorderColor, getOverlayFallbackColor, mapOverlayTokens } from './overlayTokens';

const PREVIEW_HORIZONTAL_INSET = 14;

interface MapPreviewCardProps {
  selectedGroup: MapPointGroup | null;
  selectedNoteIndex: number;
  nearbyItems: NearbyNoteItem[];
  activeNearbyNoteId: string | null;
  bottomOffset: number;
  onOpen: () => void;
  onFocusNearbyNote: (noteId: string) => void;
  onFocusGroupNote: (noteId: string) => void;
  onInteraction?: () => void;
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
  selectedGroup,
  selectedNoteIndex,
  nearbyItems,
  activeNearbyNoteId,
  bottomOffset,
  onOpen,
  onFocusNearbyNote,
  onFocusGroupNote,
  onInteraction,
}: MapPreviewCardProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const reduceMotionEnabled = useReducedMotion();
  const { width: windowWidth } = useWindowDimensions();
  const railOffsetY = useSharedValue(0);
  const prevBottomOffsetRef = useRef(bottomOffset);
  const skippedInitialBottomShiftRef = useRef(false);
  const hasEnteredScreenRef = useRef(false);
  const hasAlignedInitialPreviewRef = useRef(false);
  const previewListRef = useRef<FlatList<PreviewRailItem>>(null);
  const previewDraggingRef = useRef(false);

  const isGroupMode = Boolean(selectedGroup);
  const previewMode = isGroupMode ? 'group' : 'nearby';
  const prevPreviewModeRef = useRef(previewMode);

  const nearbyPageWidth = useMemo(
    () => Math.max(0, windowWidth - PREVIEW_HORIZONTAL_INSET * 2 - mapOverlayTokens.overlayPadding * 2),
    [windowWidth]
  );

  const activeNearbyIndex = useMemo(
    () => nearbyItems.findIndex((item) => item.note.id === activeNearbyNoteId),
    [activeNearbyNoteId, nearbyItems]
  );

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

    if (activeIndex >= 0) {
      return previewItems[activeIndex] ?? previewItems[0];
    }

    return previewItems[0];
  }, [activeIndex, previewItems]);

  useEffect(() => {
    hasEnteredScreenRef.current = true;
  }, []);

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
    if (reduceMotionEnabled) {
      railOffsetY.value = withTiming(0, { duration: 80 });
    } else {
      railOffsetY.value = withSpring(0, {
        stiffness: 300,
        damping: 30,
        mass: 0.8,
      });
    }
  }, [bottomOffset, railOffsetY, reduceMotionEnabled]);

  useEffect(() => {
    const modeChanged = prevPreviewModeRef.current !== previewMode;
    prevPreviewModeRef.current = previewMode;

    if (!previewListRef.current || activeIndex < 0) {
      return;
    }

    previewListRef.current.scrollToOffset({
      offset: activeIndex * nearbyPageWidth,
      animated: hasAlignedInitialPreviewRef.current && !modeChanged && !reduceMotionEnabled,
    });
    hasAlignedInitialPreviewRef.current = true;
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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: railOffsetY.value }],
  }));

  const layoutTransition = hasEnteredScreenRef.current
    ? reduceMotionEnabled
      ? LinearTransition.duration(100)
      : LinearTransition.springify().damping(20).stiffness(180)
    : undefined;

  if (!activePreviewItem) {
    return null;
  }

  return (
    <Reanimated.View
      style={[
        styles.wrapper,
        {
          bottom: bottomOffset,
        },
        animatedStyle,
      ]}
      pointerEvents="box-none"
    >
      <GlassView
        glassEffectStyle="regular"
        colorScheme={isDark ? 'dark' : 'light'}
        style={[
          styles.inner,
          {
            borderColor: getOverlayBorderColor(isDark),
          },
        ]}
      >
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

        <Reanimated.View layout={layoutTransition}>
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
              const photoUri = item.note.type === 'photo' ? item.note.content.trim() : '';
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
                  {photoUri ? (
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
                      transition={hasEnteredScreenRef.current ? 120 : 0}
                    />
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
                      <Text style={[styles.metaText, { color: colors.secondaryText }]}>
                        {metaLabel}
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
            scrollEnabled={previewItems.length > 1}
            onScrollBeginDrag={() => {
              previewDraggingRef.current = true;
            }}
            onMomentumScrollEnd={handlePreviewMomentumEnd}
            onScrollToIndexFailed={() => undefined}
          />

          <View style={styles.footer}>
            <Text
              style={[styles.indexText, { color: colors.secondaryText }]}
              testID="map-preview-index"
            >
              {`${Math.max(activeIndex, 0) + 1}/${previewItems.length}`}
            </Text>

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
          </View>
        </Reanimated.View>
      </GlassView>
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
    paddingHorizontal: mapOverlayTokens.overlayPadding,
    paddingTop: mapOverlayTokens.overlayPadding,
    paddingBottom: mapOverlayTokens.overlayPadding,
    ...mapOverlayTokens.overlayShadow,
    overflow: 'hidden',
  },
  previewList: {
    marginBottom: 8,
  },
  previewListContent: {
    gap: 0,
  },
  previewPage: {
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

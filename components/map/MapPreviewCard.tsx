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
  selectedNote: Note | null;
  selectedNoteIndex: number;
  nearbyItems: NearbyNoteItem[];
  activeNearbyNoteId: string | null;
  bottomOffset: number;
  onPrev: () => void;
  onNext: () => void;
  onOpen: () => void;
  onFocusNearbyNote: (noteId: string) => void;
  onInteraction?: () => void;
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
  selectedNote,
  selectedNoteIndex,
  nearbyItems,
  activeNearbyNoteId,
  bottomOffset,
  onPrev,
  onNext,
  onOpen,
  onFocusNearbyNote,
  onInteraction,
}: MapPreviewCardProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const reduceMotionEnabled = useReducedMotion();
  const { width: windowWidth } = useWindowDimensions();
  const railOffsetY = useSharedValue(0);
  const prevBottomOffsetRef = useRef(bottomOffset);
  const nearbyListRef = useRef<FlatList<NearbyNoteItem>>(null);
  const nearbyDraggingRef = useRef(false);

  const isGroupMode = Boolean(selectedGroup && selectedNote);

  const nearbyPageWidth = useMemo(
    () => Math.max(0, windowWidth - PREVIEW_HORIZONTAL_INSET * 2 - mapOverlayTokens.overlayPadding * 2),
    [windowWidth]
  );

  const activeNearbyIndex = useMemo(
    () => nearbyItems.findIndex((item) => item.note.id === activeNearbyNoteId),
    [activeNearbyNoteId, nearbyItems]
  );

  const activeNearbyItem = useMemo(() => {
    if (nearbyItems.length === 0) {
      return null;
    }

    if (activeNearbyIndex >= 0) {
      return nearbyItems[activeNearbyIndex];
    }

    return nearbyItems[0];
  }, [activeNearbyIndex, nearbyItems]);

  const displayedNote = isGroupMode ? selectedNote : activeNearbyItem?.note ?? null;

  const preview = useMemo(() => {
    if (!displayedNote) {
      return '';
    }

    return getPreviewText(
      displayedNote,
      t('map.photoNote', 'Photo Note'),
      t('map.noContent', 'No note content')
    );
  }, [displayedNote, t]);

  const displayedPhotoUri = useMemo(() => {
    if (!displayedNote || displayedNote.type !== 'photo') {
      return null;
    }

    const normalizedUri = displayedNote.content.trim();
    return normalizedUri.length > 0 ? normalizedUri : null;
  }, [displayedNote]);

  useEffect(() => {
    const prevBottom = prevBottomOffsetRef.current;
    const delta = prevBottom - bottomOffset;
    prevBottomOffsetRef.current = bottomOffset;

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
    if (isGroupMode || !nearbyListRef.current || activeNearbyIndex < 0) {
      return;
    }

    nearbyListRef.current.scrollToOffset({
      offset: activeNearbyIndex * nearbyPageWidth,
      animated: !reduceMotionEnabled,
    });
  }, [activeNearbyIndex, isGroupMode, nearbyPageWidth, reduceMotionEnabled]);

  const handleNearbyMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!nearbyDraggingRef.current) {
        return;
      }
      nearbyDraggingRef.current = false;

      const xOffset = event.nativeEvent.contentOffset.x;
      const nextIndex = Math.round(xOffset / nearbyPageWidth);
      const boundedIndex = Math.max(0, Math.min(nextIndex, nearbyItems.length - 1));
      const item = nearbyItems[boundedIndex];
      if (!item) {
        return;
      }

      onFocusNearbyNote(item.note.id);
    },
    [nearbyItems, nearbyPageWidth, onFocusNearbyNote]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: railOffsetY.value }],
  }));

  if (!displayedNote) {
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

        {isGroupMode ? (
          <View style={[styles.body, displayedPhotoUri ? styles.bodyWithPhoto : null]}>
            {displayedPhotoUri ? (
              <Image
                testID="map-preview-image"
                source={{ uri: displayedPhotoUri }}
                style={[
                  styles.photoThumb,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  },
                ]}
                contentFit="cover"
                transition={150}
              />
            ) : null}

            <View style={styles.copyWrap}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {displayedNote.locationName || t('map.unknownLocation', 'Unknown')}
              </Text>
              <Text style={[styles.content, { color: colors.secondaryText }]} numberOfLines={2}>
                {preview}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.nearbyBody}>
            <FlatList
              ref={nearbyListRef}
              testID="map-preview-nearby-list"
              horizontal
              data={nearbyItems}
              keyExtractor={(item) => item.note.id}
              renderItem={({ item }) => {
                const nearbyCardPreview = getPreviewText(
                  item.note,
                  t('map.photoNote', 'Photo Note'),
                  t('map.noContent', 'No note content')
                );
                const nearbyCardPhotoUri = item.note.type === 'photo' ? item.note.content.trim() : '';

                return (
                  <Pressable
                    testID={`map-preview-nearby-${item.note.id}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: item.note.id === activeNearbyItem?.note.id }}
                    style={[styles.nearbyPage, { width: nearbyPageWidth }]}
                    onPress={() => {
                      nearbyDraggingRef.current = false;
                      onInteraction?.();
                      onFocusNearbyNote(item.note.id);
                      const itemIndex = nearbyItems.findIndex((nearbyItem) => nearbyItem.note.id === item.note.id);
                      if (itemIndex >= 0) {
                        nearbyListRef.current?.scrollToOffset({
                          offset: itemIndex * nearbyPageWidth,
                          animated: !reduceMotionEnabled,
                        });
                      }
                    }}
                  >
                    {nearbyCardPhotoUri ? (
                      <Image
                        testID={`map-preview-nearby-image-${item.note.id}`}
                        source={{ uri: nearbyCardPhotoUri }}
                        style={styles.photoThumb}
                        contentFit="cover"
                        transition={120}
                      />
                    ) : null}
                    <View style={styles.copyWrap}>
                      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                        {item.note.locationName || t('map.unknownLocation', 'Unknown')}
                      </Text>
                      <Text style={[styles.content, { color: colors.secondaryText }]} numberOfLines={2}>
                        {nearbyCardPreview}
                      </Text>
                      <View style={styles.nearbyDistanceRow}>
                        <Ionicons name="navigate" size={12} color={colors.secondaryText} />
                        <Text style={[styles.nearbyMetaText, { color: colors.secondaryText }]}>
                          {formatDistanceLabel(item.distanceMeters)}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              }}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.nearbyListContent}
              snapToInterval={nearbyPageWidth}
              decelerationRate="fast"
              snapToAlignment="start"
              disableIntervalMomentum
              bounces={false}
              scrollEnabled={nearbyItems.length > 1}
              onScrollBeginDrag={() => {
                nearbyDraggingRef.current = true;
              }}
              onMomentumScrollEnd={handleNearbyMomentumEnd}
              onScrollToIndexFailed={() => undefined}
            />
          </View>
        )}

        <View style={styles.footer}>
          {isGroupMode && selectedGroup && selectedGroup.notes.length > 1 ? (
            <View style={styles.pager}>
              <Pressable
                testID="map-preview-prev"
                style={styles.pagerButton}
                onPress={() => {
                  onInteraction?.();
                  onPrev();
                }}
              >
                <Ionicons name="chevron-back" size={14} color={colors.text} />
              </Pressable>
              <Text style={[styles.pagerText, { color: colors.secondaryText }]}>
                {selectedNoteIndex + 1}/{selectedGroup.notes.length}
              </Text>
              <Pressable
                testID="map-preview-next"
                style={styles.pagerButton}
                onPress={() => {
                  onInteraction?.();
                  onNext();
                }}
              >
                <Ionicons name="chevron-forward" size={14} color={colors.text} />
              </Pressable>
            </View>
          ) : (
            <Text
              style={[styles.groupText, { color: colors.secondaryText }]}
              testID={isGroupMode ? 'map-preview-single-note' : 'map-preview-nearby-index'}
            >
              {isGroupMode
                ? t('map.singleNote', 'Pinned note')
                : `${Math.max(activeNearbyIndex, 0) + 1}/${nearbyItems.length}`}
            </Text>
          )}

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
  body: {
    marginBottom: 8,
  },
  bodyWithPhoto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: mapOverlayTokens.overlayGap,
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
  nearbyBody: {
    marginBottom: 8,
  },
  nearbyListContent: {
    gap: 0,
  },
  nearbyPage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: mapOverlayTokens.overlayGap,
    minHeight: 68,
  },
  nearbyDistanceRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nearbyMetaText: {
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
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pagerButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  pagerText: {
    fontSize: 13,
    fontWeight: '600',
    minWidth: 38,
    textAlign: 'center',
    fontFamily: 'System',
  },
  groupText: {
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

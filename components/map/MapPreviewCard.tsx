import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
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
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { GlassView } from '../ui/GlassView';
import type { MapPointGroup, NearbyNoteItem } from '../../hooks/map/mapDomain';
import { useTheme } from '../../hooks/useTheme';
import type { Note } from '../../services/database';
import { getTextNoteCardGradient } from '../../services/noteAppearance';
import { getNotePhotoUri } from '../../services/photoStorage';
import { formatNoteTextWithEmoji } from '../../services/noteTextPresentation';
import { isOlderIOS } from '../../utils/platform';
import {
  getMapLayoutTransition,
  mapMotionDurations,
  mapMotionEasing,
} from './mapMotion';
import MapPreviewSheet from './MapPreviewSheet';
import {
  getOverlayBorderColor,
  getOverlayFallbackColor,
  mapOverlayTokens,
} from './overlayTokens';

const PREVIEW_HORIZONTAL_INSET = 14;

type PreviewMode = 'group' | 'nearby';
type BottomOverlayMode = 'preview' | 'status';

interface MapPreviewCardProps {
  mode: BottomOverlayMode;
  previewMode: PreviewMode;
  visible: boolean;
  selectedGroup: MapPointGroup | null;
  selectedNoteIndex: number;
  nearbyItems: NearbyNoteItem[];
  activeNearbyNoteId: string | null;
  activeNoteReadyToOpen: boolean;
  bottomOffset: number;
  statusActionLabel?: string;
  statusActionTestID?: string;
  onStatusAction?: () => void;
  onFocusPreviewNote: (noteId: string) => void;
  onActivatePreviewNote: (noteId: string) => void;
  onPrimaryAction: () => void;
  onDismiss: () => void;
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

function areGroupsEquivalent(left: MapPointGroup | null, right: MapPointGroup | null) {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  if (left.id !== right.id || left.notes.length !== right.notes.length) {
    return false;
  }

  return left.notes.every((note, index) => right.notes[index]?.id === note.id);
}

export default function MapPreviewCard({
  mode,
  previewMode,
  visible,
  selectedGroup,
  selectedNoteIndex,
  nearbyItems,
  activeNearbyNoteId,
  activeNoteReadyToOpen,
  bottomOffset,
  statusActionLabel,
  statusActionTestID,
  onStatusAction,
  onFocusPreviewNote,
  onActivatePreviewNote,
  onPrimaryAction,
  onDismiss,
  onInteraction,
  reduceMotionEnabled,
}: MapPreviewCardProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const hasAlignedInitialPreviewRef = useRef(false);
  const previewListRef = useRef<any>(null);
  const previewDraggingRef = useRef(false);
  const lastAlignedIndexRef = useRef<number | null>(null);
  const prevPreviewModeRef = useRef(previewMode);
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
  const [cachedStatusAction, setCachedStatusAction] = useState<{
    label: string;
    testID?: string;
  } | null>(statusActionLabel ? { label: statusActionLabel, testID: statusActionTestID } : null);
  const modeSettleProgress = useSharedValue(reduceMotionEnabled ? 1 : 0);

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (mode === 'preview') {
      lastVisiblePreviewStateRef.current = {
        previewMode,
        selectedGroup,
        selectedNoteIndex,
      };
    }

    if (statusActionLabel) {
      setCachedStatusAction({
        label: statusActionLabel,
        testID: statusActionTestID,
      });
    }
  }, [mode, previewMode, selectedGroup, selectedNoteIndex, statusActionLabel, statusActionTestID, visible]);

  useEffect(() => {
    if (visible && !isMounted) {
      setIsMounted(true);
    }
  }, [visible, isMounted]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (reduceMotionEnabled) {
      modeSettleProgress.value = 1;
      return;
    }

    modeSettleProgress.value = 0;
    modeSettleProgress.value = withTiming(1, {
      duration: mapMotionDurations.standard,
      easing: mapMotionEasing.standard,
    });
  }, [mode, modeSettleProgress, reduceMotionEnabled, visible]);

  const handleFullyClosed = useCallback(() => {
    setIsMounted(false);
  }, []);

  const nearbyPageWidth = useMemo(
    () =>
      Math.max(0, windowWidth - PREVIEW_HORIZONTAL_INSET * 2 - mapOverlayTokens.overlayPadding * 2),
    [windowWidth]
  );

  const shouldUseCurrentPreviewState = visible && mode === 'preview';
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
    const modeChanged = prevPreviewModeRef.current !== renderPreviewMode;
    prevPreviewModeRef.current = renderPreviewMode;

    if (mode !== 'preview' || !previewListRef.current || activeIndex < 0) {
      return;
    }

    if (
      !modeChanged &&
      hasAlignedInitialPreviewRef.current &&
      lastAlignedIndexRef.current === activeIndex &&
      areGroupsEquivalent(renderSelectedGroup, lastVisiblePreviewStateRef.current?.selectedGroup ?? null)
    ) {
      return;
    }

    previewListRef.current.scrollToOffset({
      offset: activeIndex * nearbyPageWidth,
      animated: hasAlignedInitialPreviewRef.current && !reduceMotionEnabled,
    });
    hasAlignedInitialPreviewRef.current = true;
    lastAlignedIndexRef.current = activeIndex;

    if (modeChanged) {
      previewDraggingRef.current = false;
    }
  }, [
    activeIndex,
    mode,
    nearbyPageWidth,
    renderPreviewMode,
    renderSelectedGroup,
    reduceMotionEnabled,
  ]);

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

  const handlePreviewItemPress = useCallback(
    (noteId: string) => {
      previewDraggingRef.current = false;
      onInteraction?.();
      onActivatePreviewNote(noteId);
    },
    [onActivatePreviewNote, onInteraction]
  );

  const animatedSurfaceStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(modeSettleProgress.value, [0, 1], [10, 0]) },
      { scale: interpolate(modeSettleProgress.value, [0, 1], [0.985, 1]) },
    ],
  }));

  if (!isMounted && !visible) {
    return null;
  }

  const previewActionLabel = activeNoteReadyToOpen
    ? t('map.openNoteAction', 'Open note')
    : t('map.centerOnMapAction', 'Center on map');
  const previewActionIcon = activeNoteReadyToOpen ? 'arrow-forward-circle' : 'locate';
  const showPreviewMode = mode === 'preview' && renderData;
  const showPreviewCount = showPreviewMode ? renderData.previewItems.length > 1 : false;
  const showActionLabel = showPreviewMode ? isGroupMode : false;
  const previewCountLabel = showPreviewMode
    ? `${Math.max(renderData.activeIndex, 0) + 1}/${renderData.previewItems.length}`
    : '';
  const statusAction = cachedStatusAction;

  if (mode === 'status' && !statusAction) {
    return null;
  }

  return (
    <MapPreviewSheet
      isVisible={visible}
      onFullyClosed={handleFullyClosed}
      shellTestID="map-preview-shell"
      dismissTestID="map-preview-dismiss"
      bottomOffset={bottomOffset}
      handleColor={isDark ? 'rgba(255,255,255,0.34)' : 'rgba(60,60,67,0.22)'}
      onDismiss={onDismiss}
      reduceMotionEnabled={reduceMotionEnabled}
      allowDragDismiss={mode === 'preview'}
      showHandle={mode === 'preview'}
    >
      <Animated.View
        layout={getMapLayoutTransition(reduceMotionEnabled)}
        style={[
          animatedSurfaceStyle,
          mode === 'status' ? styles.compactSurface : styles.expandedSurface,
        ]}
      >
        <View
          style={[
            styles.inner,
            mode === 'status' ? styles.innerCompact : null,
            {
              borderColor: getOverlayBorderColor(isDark),
              backgroundColor: getOverlayFallbackColor(isDark),
            },
          ]}
          pointerEvents="auto"
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

          {mode === 'status' && statusAction ? (
            <Animated.View
              layout={getMapLayoutTransition(reduceMotionEnabled)}
              style={styles.statusContent}
            >
              <Pressable
                testID={statusAction.testID}
                accessibilityRole="button"
                onPress={() => {
                  onInteraction?.();
                  onStatusAction?.();
                }}
                style={({ pressed }) => [
                  styles.statusActionButton,
                  {
                    opacity: pressed ? 0.94 : 1,
                    backgroundColor: `${colors.primary}14`,
                  },
                ]}
              >
                <Ionicons name="albums-outline" size={15} color={colors.primary} />
                <Text style={[styles.statusActionText, { color: colors.primary }]}>
                  {statusAction.label}
                </Text>
              </Pressable>
            </Animated.View>
          ) : showPreviewMode ? (
            <Animated.View
              layout={getMapLayoutTransition(reduceMotionEnabled)}
              style={styles.cardContent}
            >
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
                  });
                  const metaLabel = isGroupMode
                    ? t('map.noteAtPlace', 'Saved here')
                    : formatDistanceLabel(item.distanceMeters ?? 0);

                  return (
                    <Pressable
                      testID={`map-preview-item-${item.note.id}`}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: item.note.id === renderData.activePreviewItem.note.id,
                      }}
                      style={[styles.previewPage, { width: nearbyPageWidth }]}
                      onPress={() => handlePreviewItemPress(item.note.id)}
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
                                  backgroundColor: isDark
                                    ? 'rgba(255,255,255,0.06)'
                                    : 'rgba(0,0,0,0.04)',
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
                          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                            {item.note.locationName || t('map.unknownLocation', 'Unknown')}
                          </Text>
                          <Text
                            style={[styles.content, { color: colors.secondaryText }]}
                            numberOfLines={1}
                          >
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

              <View style={styles.footer}>
                <View
                  style={[
                    styles.actionPill,
                    !showActionLabel ? styles.actionPillIconOnly : null,
                    {
                      backgroundColor: activeNoteReadyToOpen
                        ? `${colors.primary}18`
                        : isDark
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(28,28,30,0.06)',
                      borderColor: activeNoteReadyToOpen
                        ? `${colors.primary}40`
                        : getOverlayBorderColor(isDark),
                    },
                  ]}
                >
                  <Pressable
                    testID="map-preview-primary-action"
                    accessibilityRole="button"
                    accessibilityLabel={previewActionLabel}
                    onPress={() => {
                      onInteraction?.();
                      onPrimaryAction();
                    }}
                    style={[styles.actionButton, !showActionLabel ? styles.actionButtonIconOnly : null]}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={previewActionIcon}
                      size={showActionLabel ? 13 : 16}
                      color={activeNoteReadyToOpen ? colors.primary : colors.secondaryText}
                    />
                    {showActionLabel ? (
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
                    ) : null}
                  </Pressable>
                </View>
                {showPreviewCount ? (
                  <View style={styles.indexLabelWrap}>
                    <Text
                      style={[styles.indexText, { color: colors.secondaryText }]}
                      testID="map-preview-index"
                    >
                      {previewCountLabel}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Animated.View>
          ) : null}
        </View>
      </Animated.View>
    </MapPreviewSheet>
  );
}

const styles = StyleSheet.create({
  expandedSurface: {
    width: '100%',
  },
  compactSurface: {
    alignSelf: 'center',
    maxWidth: '100%',
  },
  inner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: mapOverlayTokens.overlayRadius,
    overflow: 'hidden',
    ...mapOverlayTokens.overlayShadow,
  },
  innerCompact: {
    borderRadius: 22,
  },
  statusContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  statusActionButton: {
    minHeight: 42,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusActionText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  cardContent: {
    paddingHorizontal: mapOverlayTokens.overlayPadding,
    paddingTop: mapOverlayTokens.overlayPadding + 14,
    paddingBottom: mapOverlayTokens.overlayPadding,
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
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 3,
    fontFamily: 'Noto Sans',
  },
  content: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: 'Noto Sans',
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
    fontFamily: 'Noto Sans',
  },
  footer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionPill: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 1,
    maxWidth: '38%',
  },
  actionPillIconOnly: {
    maxWidth: undefined,
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionButtonIconOnly: {
    width: 34,
    height: 34,
    paddingHorizontal: 0,
    paddingVertical: 0,
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  indexLabelWrap: {
    marginLeft: 'auto',
    minWidth: 34,
    alignItems: 'flex-end',
  },
  indexText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Noto Sans',
  },
});

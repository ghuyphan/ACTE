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
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { GlassView } from '../ui/GlassView';
import type { MapPointGroup, NearbyNoteItem } from '../../hooks/map/mapDomain';
import { useTheme } from '../../hooks/useTheme';
import type { Note } from '../../services/database';
import { getDistanceMeters } from '../../hooks/map/mapDomain';
import { getTextNoteCardGradient } from '../../services/noteAppearance';
import { getNotePhotoUri } from '../../services/photoStorage';
import { formatNoteTextWithEmoji } from '../../services/noteTextPresentation';
import { isOlderIOS } from '../../utils/platform';
import MapPreviewSheet from './MapPreviewSheet';
import {
  getOverlayBorderColor,
  getOverlayFallbackColor,
  getOverlayScrimColor,
  mapOverlayTokens,
} from './overlayTokens';

const PREVIEW_HORIZONTAL_INSET = 14;
const STATUS_HEIGHT = 76;
const PREVIEW_HEIGHT = 168;
const PREVIEW_MEDIA_SIZE = 56;
const PREVIEW_ROW_GAP = 12;
const PREVIEW_FOOTER_OFFSET = PREVIEW_MEDIA_SIZE + PREVIEW_ROW_GAP;
const PREVIEW_MORPH_SPRING = {
  damping: 26,
  stiffness: 240,
  mass: 0.88,
} as const;

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
  distanceAnchor?: { latitude: number; longitude: number } | null;
  bottomOffset: number;
  statusTitle?: string;
  statusSubtitle?: string;
  statusIcon?: keyof typeof Ionicons.glyphMap;
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
    const caption = note.caption?.trim();
    if (!caption) {
      return photoLabel;
    }

    return caption.substring(0, 120) + (caption.length > 120 ? '…' : '');
  }

  const normalized = note.content.trim();
  if (!normalized) {
    return noContentLabel;
  }

  const displayText = formatNoteTextWithEmoji(normalized, note.moodEmoji);
  return displayText.substring(0, 120) + (displayText.length > 120 ? '…' : '');
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
  distanceAnchor = null,
  bottomOffset,
  statusTitle,
  statusSubtitle,
  statusIcon = 'albums-outline',
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
  const [cachedStatusAction, setCachedStatusAction] = useState<{
    label: string;
    testID?: string;
  } | null>(statusActionLabel ? { label: statusActionLabel, testID: statusActionTestID } : null);

  const previewProgress = useSharedValue(mode === 'preview' ? 1 : 0);
  const fullSurfaceWidth = Math.max(0, windowWidth - PREVIEW_HORIZONTAL_INSET * 2);
  const nearbyPageWidth = Math.max(0, fullSurfaceWidth - mapOverlayTokens.overlayPadding * 2);
  const hasStatusCopy = Boolean(statusTitle || statusSubtitle);
  const hasStatusSubtitle = Boolean(statusSubtitle);
  const isPassiveStatusPill = mode === 'status' && Boolean(statusTitle) && !statusSubtitle && !statusActionLabel;
  const isActionOnlyStatus = mode === 'status' && !hasStatusCopy && Boolean(statusActionLabel);

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

    if (mode === 'status') {
      if (statusActionLabel) {
        setCachedStatusAction({
          label: statusActionLabel,
          testID: statusActionTestID,
        });
      } else {
        setCachedStatusAction(null);
      }
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

    const nextValue = mode === 'preview' ? 1 : 0;
    if (reduceMotionEnabled) {
      previewProgress.value = nextValue;
      return;
    }

    previewProgress.value = withSpring(nextValue, PREVIEW_MORPH_SPRING);
  }, [mode, previewProgress, reduceMotionEnabled, visible]);

  const handleFullyClosed = useCallback(() => {
    setIsMounted(false);
  }, []);

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
            distanceMeters:
              distanceAnchor
                ? getDistanceMeters(distanceAnchor, {
                    latitude: note.latitude,
                    longitude: note.longitude,
                  })
                : nearbyItems.find((item) => item.note.id === note.id)?.distanceMeters ?? null,
          }))
        : nearbyItems.map((item) => ({
            note: item.note,
            distanceMeters: item.distanceMeters,
          })),
    [distanceAnchor, isGroupMode, nearbyItems, renderSelectedGroup]
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
    if (mode !== 'preview' || !previewListRef.current || activeIndex < 0) {
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
  }, [activeIndex, mode, nearbyPageWidth, reduceMotionEnabled]);

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

  const previewActionLabel = activeNoteReadyToOpen
    ? t('map.openNoteAction', 'Open note')
    : t('map.centerOnMapAction', 'Center on map');
  const previewActionIcon = activeNoteReadyToOpen ? 'arrow-forward-circle' : 'locate';
  const showPreviewMode = mode === 'preview' && renderData;
  const showPreviewCount = showPreviewMode ? renderData.previewItems.length > 1 : false;
  const previewCountLabel = showPreviewMode
    ? `${Math.max(renderData.activeIndex, 0) + 1}/${renderData.previewItems.length}`
    : '';
  const statusAction = cachedStatusAction;
  const shouldShowStatusLayer = mode === 'status' && (hasStatusCopy || Boolean(statusAction));
  const statusHeight = isPassiveStatusPill
    ? 48
    : isActionOnlyStatus
      ? 72
      : statusAction
        ? hasStatusSubtitle
          ? 116
          : 94
        : hasStatusSubtitle
          ? 88
          : STATUS_HEIGHT;
  const compactWidth = isPassiveStatusPill ? Math.min(fullSurfaceWidth, 168) : fullSurfaceWidth;

  const animatedShellStyle = useAnimatedStyle(() => ({
    width: interpolate(previewProgress.value, [0, 1], [compactWidth, fullSurfaceWidth]),
    height: interpolate(
      previewProgress.value,
      [0, 1],
      [statusHeight, PREVIEW_HEIGHT]
    ),
    borderRadius: interpolate(
      previewProgress.value,
      [0, 1],
      [mapOverlayTokens.overlayCompactRadius + 2, mapOverlayTokens.overlayRadius]
    ),
  }), [compactWidth, fullSurfaceWidth, statusHeight]);

  const animatedCompactContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(previewProgress.value, [0, 0.24, 0.42], [1, 0.96, 0]),
    transform: [{ translateY: interpolate(previewProgress.value, [0, 1], [0, 6]) }],
  }));

  const animatedPreviewContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(previewProgress.value, [0, 0.2, 0.44, 1], [0, 0, 0.86, 1]),
    transform: [{ translateY: interpolate(previewProgress.value, [0, 1], [10, 0]) }],
  }));

  const showPlaceMeta = isGroupMode && renderData ? renderData.previewItems.length > 1 : false;

  if (!isMounted && !visible) {
    return null;
  }

  if (mode === 'status' && !shouldShowStatusLayer) {
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
      handleVisible={mode === 'preview'}
    >
      <View
        style={[styles.surfaceHost, { width: fullSurfaceWidth, height: PREVIEW_HEIGHT }]}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.surfaceShadow,
            isPassiveStatusPill ? styles.surfacePill : null,
            animatedShellStyle,
          ]}
          pointerEvents="auto"
        >
          <Animated.View
            style={[
              styles.surface,
              animatedShellStyle,
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

            {shouldShowStatusLayer ? (
              <Animated.View
                style={[
                  styles.compactLayer,
                  isPassiveStatusPill ? styles.compactLayerPill : null,
                  isActionOnlyStatus ? styles.compactLayerActionOnly : null,
                  animatedCompactContentStyle,
                ]}
                pointerEvents={mode === 'status' && statusAction ? 'auto' : 'none'}
              >
                {isPassiveStatusPill && statusTitle ? (
                  <View style={styles.statusPillRow}>
                    <View style={[styles.statusPillDot, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.statusPillLabel, { color: colors.text }]} numberOfLines={1}>
                      {statusTitle}
                    </Text>
                  </View>
                ) : hasStatusCopy ? (
                  <View style={styles.statusContent}>
                    <View style={styles.statusHeaderRow}>
                      <View style={[styles.statusActionIconWrap, { backgroundColor: `${colors.primary}18` }]}>
                        <Ionicons name={statusIcon} size={15} color={colors.primary} />
                      </View>
                      <View style={styles.statusCopyWrap}>
                        {statusTitle ? (
                          <Text style={[styles.statusTitle, { color: colors.text }]} numberOfLines={2}>
                            {statusTitle}
                          </Text>
                        ) : null}
                        {statusSubtitle ? (
                          <Text
                            style={[styles.statusSubtitle, { color: colors.secondaryText }]}
                            numberOfLines={2}
                          >
                            {statusSubtitle}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    {statusAction ? (
                      <Pressable
                        testID={statusAction.testID}
                        accessibilityRole="button"
                        onPress={() => {
                          onInteraction?.();
                          onStatusAction?.();
                        }}
                        style={({ pressed }) => [
                          styles.statusLinkButton,
                          {
                            opacity: pressed ? 0.72 : 1,
                          },
                        ]}
                      >
                        <Text style={[styles.statusActionText, { color: colors.primary }]} numberOfLines={1}>
                          {statusAction.label}
                        </Text>
                        <Ionicons name="arrow-forward" size={13} color={colors.primary} />
                      </Pressable>
                    ) : null}
                  </View>
                ) : statusAction ? (
                  <Pressable
                    testID={statusAction.testID}
                    accessibilityRole="button"
                    onPress={() => {
                      onInteraction?.();
                      onStatusAction?.();
                    }}
                    style={({ pressed }) => [
                      styles.statusInlineRow,
                      {
                        opacity: pressed ? 0.72 : 1,
                      },
                    ]}
                  >
                    <View style={styles.statusActionIconWrap}>
                      <Ionicons name={statusIcon} size={15} color={colors.primary} />
                    </View>
                    <Text style={[styles.statusActionText, { color: colors.primary }]} numberOfLines={1}>
                      {statusAction.label}
                    </Text>
                    <Ionicons name="chevron-up" size={14} color={colors.primary} />
                  </Pressable>
                ) : null}
              </Animated.View>
            ) : null}

            {renderData ? (
              <Animated.View
                style={[styles.previewLayer, animatedPreviewContentStyle]}
                pointerEvents={mode === 'preview' ? 'auto' : 'none'}
              >
                <View style={[styles.previewViewport, { width: fullSurfaceWidth }]}>
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
                        });
                        const metaLabel =
                          showPlaceMeta || item.distanceMeters == null
                            ? t('map.noteAtPlace', 'Saved here')
                            : formatDistanceLabel(item.distanceMeters);
                        const isActive = item.note.id === renderData.activePreviewItem.note.id;

                        return (
                          <Pressable
                            testID={`map-preview-item-${item.note.id}`}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isActive }}
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
                                <View style={styles.metaRow}>
                                  <Ionicons
                                    name={showPlaceMeta || item.distanceMeters == null ? 'pin' : 'navigate'}
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
                      <Pressable
                        testID="map-preview-primary-action"
                        accessibilityRole="button"
                        accessibilityLabel={previewActionLabel}
                        onPress={() => {
                          onInteraction?.();
                          onPrimaryAction();
                        }}
                        style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.72 : 1 }]}
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
                  </View>
                </View>
              </Animated.View>
            ) : null}
          </Animated.View>
        </Animated.View>
      </View>
    </MapPreviewSheet>
  );
}

const styles = StyleSheet.create({
  surfaceHost: {
    alignSelf: 'center',
  },
  surfaceShadow: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    ...mapOverlayTokens.overlayShadow,
  },
  surface: {
    borderWidth: Platform.OS === 'android' ? 1 : StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  surfacePill: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  compactLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: mapOverlayTokens.overlayPadding,
    paddingTop: 18,
    paddingBottom: 12,
  },
  compactLayerPill: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 0,
  },
  compactLayerActionOnly: {
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 10,
  },
  statusContent: {
    gap: 10,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  statusCopyWrap: {
    flex: 1,
    minWidth: 0,
  },
  previewLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  previewViewport: {
    minHeight: PREVIEW_HEIGHT,
  },
  statusActionIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusInlineRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statusPillRow: {
    minHeight: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statusPillDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  statusPillLabel: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Noto Sans',
  },
  statusLinkButton: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
  },
  statusActionText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  statusTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
    marginBottom: 2,
  },
  statusSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Noto Sans',
  },
  cardContent: {
    paddingHorizontal: mapOverlayTokens.overlayPadding,
    paddingTop: 20,
    paddingBottom: 12,
  },
  previewList: {
    marginBottom: 8,
  },
  previewListContent: {
    gap: 0,
  },
  previewPage: {
    minHeight: 76,
  },
  previewPageInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: PREVIEW_ROW_GAP,
    minHeight: 76,
  },
  copyWrap: {
    flex: 1,
    minWidth: 0,
    paddingTop: 2,
  },
  photoThumb: {
    width: PREVIEW_MEDIA_SIZE,
    height: PREVIEW_MEDIA_SIZE,
    borderRadius: 15,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  textThumb: {
    width: PREVIEW_MEDIA_SIZE,
    height: PREVIEW_MEDIA_SIZE,
    borderRadius: 15,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  textThumbPaper: {
    width: 42,
    height: 42,
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
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 6,
    fontFamily: 'Noto Sans',
  },
  content: {
    fontSize: 13,
    lineHeight: 18,
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
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingLeft: PREVIEW_FOOTER_OFFSET,
  },
  actionButton: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  indexLabelWrap: {
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Noto Sans',
  },
});

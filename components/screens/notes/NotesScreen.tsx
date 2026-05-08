import { FlashList } from '@shopify/flash-list';
import * as Haptics from '../../../hooks/useHaptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Href, Stack, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  FadeInUp,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout } from '../../../constants/theme';
import { DOODLE_ARTBOARD_FRAME } from '../../../constants/doodleLayout';
import { useAuth } from '../../../hooks/useAuth';
import { useFeedFocus } from '../../../hooks/useFeedFocus';
import { useNotesStore } from '../../../hooks/useNotes';
import { usePreparedNotesRecapData } from '../../../hooks/state/useNotesRecapViewModel';
import { useSharedFeedStore } from '../../../hooks/useSharedFeed';
import { useSyncStatus } from '../../../hooks/useSyncStatus';
import { useTheme } from '../../../hooks/useTheme';
import DynamicStickerCanvas from '../../notes/DynamicStickerCanvas';
import NoteDoodleCanvas from '../../notes/NoteDoodleCanvas';
import NotesRecapView from '../../notes/recap/NotesRecapView';
import RecapModeSwitch, {
  type RecapMode,
} from '../../notes/recap/RecapModeSwitch';
import PeekingCatIcon from '../../ui/PeekingCatIcon';
import StickerIcon from '../../ui/StickerIcon';
import { SHARED_POST_MEDIA_BUCKET } from '../../../services/remoteMedia';
import {
  buildHomeFeedItems,
  getHomeFeedItemKey,
  type HomeFeedItem,
} from '../../home/feedItems';
import { scheduleOnIdle } from '../../../utils/scheduleOnIdle';
import { useNotesGridSharedPhotoHydration } from './useNotesGridSharedPhotoHydration';
import { GlassView } from '../../ui/GlassView';
import { buildNotesGridTileModels } from './buildNotesGridTileModels';
import NotoLoader from '../../ui/NotoLoader';

const GRID_DOODLE_STROKE_WIDTH = 4.5;
const GRID_STICKER_MIN_SIZE = 0;
const GRID_DECORATION_REVEAL_DELAY_MS = 180;
const MODE_SWIPE_DISTANCE = 56;
const MODE_SWIPE_VELOCITY = 460;
const NOTES_BROWSE_MODE_ORDER: RecapMode[] = ['all', 'recap'];
const NOTES_GRID_SKELETON_TILE_COUNT = 15;

function triggerNotesHaptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  void Haptics.impactAsync(style);
}

export function resolveNotesModeFromSwipe(
  currentMode: RecapMode,
  translationX: number,
  velocityX: number,
  hasRecapNotes: boolean
): RecapMode {
  if (!hasRecapNotes) {
    return currentMode;
  }

  const currentModeIndex = NOTES_BROWSE_MODE_ORDER.indexOf(currentMode);
  const swipeLeft =
    translationX <= -MODE_SWIPE_DISTANCE || velocityX <= -MODE_SWIPE_VELOCITY;
  if (swipeLeft) {
    return NOTES_BROWSE_MODE_ORDER[Math.min(currentModeIndex + 1, NOTES_BROWSE_MODE_ORDER.length - 1)];
  }

  const swipeRight =
    translationX >= MODE_SWIPE_DISTANCE || velocityX >= MODE_SWIPE_VELOCITY;
  if (swipeRight) {
    return NOTES_BROWSE_MODE_ORDER[Math.max(currentModeIndex - 1, 0)];
  }

  return currentMode;
}

function areStringArraysEqual(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

const GridTile = memo(function GridTile({
  accessibilityLabel,
  model,
  size,
  gap,
  colors,
  onPress,
  index,
  sharedPhotoUri,
}: {
  accessibilityLabel: string;
  model: ReturnType<typeof buildNotesGridTileModels>[number];
  size: number;
  gap: number;
  colors: {
    card: string;
    border: string;
    primary: string;
    primarySoft: string;
  };
  onPress: () => void;
  index: number;
  sharedPhotoUri: string | null;
}) {
  const imageUri =
    model.item.kind === 'shared-post' && model.isPhotoTile
      ? sharedPhotoUri ?? model.baseImageUri ?? ''
      : model.baseImageUri ?? '';
  const showPhotoPlaceholder = model.showPhotoPlaceholder && !imageUri;
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.tilePressable,
        {
          width: size,
          height: size,
          marginRight: index % 3 === 2 ? 0 : gap,
          marginBottom: gap,
        },
        pressed ? styles.tilePressablePressed : null,
      ]}
    >
      <Reanimated.View
        style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        {imageUri ? (
          <View style={styles.tileMediaWrap}>
            <Image
              source={{ uri: imageUri }}
              style={styles.tileImage}
              contentFit="cover"
              transition={120}
            />
            {model.stickerPlacements.length > 0 ? (
              <View pointerEvents="none" style={styles.tileDoodleOverlay}>
                <DynamicStickerCanvas
                  placements={model.stickerPlacements}
                  remoteBucket={model.usesSharedCache ? SHARED_POST_MEDIA_BUCKET : undefined}
                  sharedCache={model.usesSharedCache}
                  minimumBaseSize={GRID_STICKER_MIN_SIZE}
                  motionVariant={model.stickerMotionVariant}
                />
              </View>
            ) : null}
            {model.doodleStrokes.length > 0 ? (
              <View pointerEvents="none" style={styles.tileDoodleOverlay}>
                <NoteDoodleCanvas
                  strokes={model.doodleStrokes}
                  strokeWidth={GRID_DOODLE_STROKE_WIDTH}
                />
              </View>
            ) : null}
          </View>
        ) : showPhotoPlaceholder ? (
          <View
            testID="shared-photo-grid-placeholder"
            style={[
              styles.photoPlaceholder,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.photoPlaceholderBadge,
                {
                  backgroundColor: colors.primarySoft,
                },
              ]}
            >
              <Text style={[styles.photoPlaceholderIcon, { color: colors.primary }]}>+</Text>
            </View>
            <NotoLoader variant="inline" size="small" color={colors.primary} />
          </View>
        ) : (
          <LinearGradient
            colors={model.textGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tileTextFill}
          >
            {model.stickerPlacements.length > 0 ? (
              <View pointerEvents="none" style={[styles.tileDoodleOverlay, styles.tileTextStickerOverlay]}>
                <DynamicStickerCanvas
                  placements={model.stickerPlacements}
                  remoteBucket={model.usesSharedCache ? SHARED_POST_MEDIA_BUCKET : undefined}
                  sharedCache={model.usesSharedCache}
                  minimumBaseSize={GRID_STICKER_MIN_SIZE}
                  motionVariant={model.stickerMotionVariant}
                />
              </View>
            ) : null}
            {model.doodleStrokes.length > 0 ? (
              <View pointerEvents="none" style={[styles.tileDoodleOverlay, styles.tileTextDoodleOverlay]}>
                <NoteDoodleCanvas
                  strokes={model.doodleStrokes}
                  strokeWidth={GRID_DOODLE_STROKE_WIDTH}
                />
              </View>
            ) : null}
            {model.tileText ? (
              <Text style={styles.tileText} numberOfLines={3}>
                {model.tileText}
              </Text>
            ) : null}
          </LinearGradient>
        )}
      </Reanimated.View>
    </Pressable>
  );
}, (prevProps, nextProps) => (
  prevProps.accessibilityLabel === nextProps.accessibilityLabel &&
  prevProps.index === nextProps.index &&
  prevProps.size === nextProps.size &&
  prevProps.gap === nextProps.gap &&
  prevProps.colors === nextProps.colors &&
  prevProps.sharedPhotoUri === nextProps.sharedPhotoUri &&
  prevProps.model === nextProps.model
));

function NotesGridSkeleton({
  bottomInset,
  colors,
  gap,
  loadingBody,
  loadingTitle,
  showLoadingCopy,
  tileSize,
}: {
  bottomInset: number;
  colors: {
    border: string;
    card: string;
    primarySoft: string;
    secondaryText: string;
    surface: string;
    text: string;
  };
  gap: number;
  loadingBody: string;
  loadingTitle: string;
  showLoadingCopy: boolean;
  tileSize: number;
}) {
  const opacity = useSharedValue(0.46);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.78, { duration: 760 }), -1, true);

    return () => {
      cancelAnimation(opacity);
    };
  }, [opacity]);

  return (
    <View
      accessible
      accessibilityLabel={loadingTitle}
      accessibilityState={{ busy: true }}
      style={[
        styles.skeletonScreen,
        {
          paddingBottom: bottomInset + 28,
          paddingHorizontal: Layout.screenPadding,
        },
      ]}
      testID="notes-grid-skeleton"
    >
      {showLoadingCopy ? (
        <View
          style={[
            styles.skeletonStatus,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.loadingTitle, styles.skeletonStatusTitle, { color: colors.text }]}>
            {loadingTitle}
          </Text>
          <Text style={[styles.loadingBody, { color: colors.secondaryText }]}>
            {loadingBody}
          </Text>
        </View>
      ) : null}
      <View style={styles.skeletonGrid} pointerEvents="none">
        {Array.from({ length: NOTES_GRID_SKELETON_TILE_COUNT }).map((_, index) => {
          const rowVariant = index % 6;
          return (
            <Reanimated.View
              key={`notes-grid-skeleton-${index}`}
              style={[
                styles.skeletonTile,
                {
                  width: tileSize,
                  height: tileSize,
                  marginRight: index % 3 === 2 ? 0 : gap,
                  marginBottom: gap,
                  backgroundColor: rowVariant === 1 || rowVariant === 4 ? colors.primarySoft : colors.card,
                  borderColor: colors.border,
                },
                pulseStyle,
              ]}
            >
              {rowVariant === 0 || rowVariant === 3 ? (
                <View style={styles.skeletonTextTile}>
                  <View
                    style={[
                      styles.skeletonLine,
                      styles.skeletonLineWide,
                      { backgroundColor: colors.surface },
                    ]}
                  />
                  <View
                    style={[
                      styles.skeletonLine,
                      styles.skeletonLineMedium,
                      { backgroundColor: colors.surface },
                    ]}
                  />
                  <View
                    style={[
                      styles.skeletonLine,
                      styles.skeletonLineShort,
                      { backgroundColor: colors.surface },
                    ]}
                  />
                </View>
              ) : rowVariant === 2 ? (
                <View style={[styles.skeletonPhotoBadge, { backgroundColor: colors.surface }]} />
              ) : null}
            </Reanimated.View>
          );
        })}
      </View>
    </View>
  );
}

export default function NotesIndexScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { requestFeedFocus } = useFeedFocus();
  const { notes, loading } = useNotesStore();
  const { sharedPosts, loading: sharedLoading } = useSharedFeedStore();
  const { isInitialSyncPending, status: syncStatus } = useSyncStatus();
  const [mode, setMode] = useState<RecapMode>('all');
  const [showGridDecorations, setShowGridDecorations] = useState(process.env.NODE_ENV === 'test');
  const [isRecapPhysicsSuspended, setIsRecapPhysicsSuspended] = useState(false);
  const [visibleSharedPhotoIds, setVisibleSharedPhotoIds] = useState<string[]>([]);

  const items = useMemo(
    () =>
      buildHomeFeedItems(
        notes,
        user?.uid ? sharedPosts.filter((post) => post.authorUid !== user.uid) : sharedPosts
      ),
    [notes, sharedPosts, user?.uid]
  );
  const sharedPhotoPosts = useMemo(
    () =>
      items
        .filter(
          (item): item is Extract<HomeFeedItem, { kind: 'shared-post' }> =>
            item.kind === 'shared-post' && item.post.type === 'photo'
        )
        .map((item) => item.post),
    [items]
  );
  const sharedPhotoUrisById = useNotesGridSharedPhotoHydration(
    sharedPhotoPosts,
    visibleSharedPhotoIds
  );
  const photoFallbackLabel = t('shared.photoMemory', 'Photo memory');
  const tileModels = useMemo(
    () =>
      buildNotesGridTileModels(items, {
        captureGradient: colors.captureGradient,
        photoFallbackLabel,
        showDecorations: showGridDecorations && mode === 'all',
      }),
    [colors.captureGradient, items, mode, photoFallbackLabel, showGridDecorations]
  );

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { item: ReturnType<typeof buildNotesGridTileModels>[number] }[] }) => {
      const nextVisibleSharedPhotoIds = viewableItems
        .map(({ item }) => item.item)
        .filter(
          (item): item is Extract<HomeFeedItem, { kind: 'shared-post' }> =>
            item.kind === 'shared-post' && item.post.type === 'photo'
        )
        .map((item) => item.post.id)
        .sort();

      setVisibleSharedPhotoIds((current) =>
        areStringArraysEqual(current, nextVisibleSharedPhotoIds) ? current : nextVisibleSharedPhotoIds
      );
    },
    []
  );
  const gridViewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 60,
    }),
    []
  );

  const gridGap = 10;
  const gridSize = Math.floor((width - Layout.screenPadding * 2 - gridGap * 2) / 3);
  const isBootstrapSyncing = syncStatus === 'syncing' && isInitialSyncPending && items.length === 0;
  const isLoading = ((loading || sharedLoading) && items.length === 0) || isBootstrapSyncing;
  const hasRecapNotes = notes.length > 0;
  const shouldRenderRecap = hasRecapNotes && mode === 'recap';
  const preparedRecap = usePreparedNotesRecapData({
    notes,
    enabled: hasRecapNotes && !isLoading,
    immediate: mode === 'recap',
  });
  useEffect(() => {
    if (!hasRecapNotes && mode !== 'all') {
      setMode('all');
    }
  }, [hasRecapNotes, mode]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    let cancelled = false;
    let animationFrameId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleHandle: ReturnType<typeof scheduleOnIdle> | null = null;

    setShowGridDecorations(false);

    if (mode !== 'all') {
      return () => {
        cancelled = true;
      };
    }

    idleHandle = scheduleOnIdle(() => {
      animationFrameId = requestAnimationFrame(() => {
        timeoutId = setTimeout(() => {
          if (!cancelled) {
            setShowGridDecorations(true);
          }
        }, GRID_DECORATION_REVEAL_DELAY_MS);
      });
    }, { timeout: 220 });

    return () => {
      cancelled = true;
      idleHandle?.cancel();
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [mode]);

  const openItem = useCallback(
    (item: HomeFeedItem) => {
      triggerNotesHaptic();
      if (item.kind === 'note') {
        requestFeedFocus({ kind: 'note', id: item.note.id });
        router.replace('/' as Href);
        return;
      }

      requestFeedFocus({ kind: 'shared-post', id: item.post.id });
      router.replace('/' as Href);
    },
    [requestFeedFocus, router]
  );
  const openStickerLibrary = useCallback(() => {
    triggerNotesHaptic();
    router.push('/notes/stickers' as Href);
  }, [router]);
  const handleModeChange = useCallback((nextMode: RecapMode) => {
    if (nextMode === mode) {
      return;
    }

    if (mode === 'recap' && nextMode !== 'recap' && process.env.NODE_ENV !== 'test') {
      setIsRecapPhysicsSuspended(true);
      requestAnimationFrame(() => {
        setMode(nextMode);
      });
      return;
    }

    setIsRecapPhysicsSuspended(false);
    setMode(nextMode);
  }, [mode]);
  const modeContentGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(hasRecapNotes)
        .maxPointers(1)
        .activeOffsetX([-18, 18])
        .failOffsetY([-14, 14])
        .shouldCancelWhenOutside(false)
        .runOnJS(true)
        .onEnd((event) => {
          const nextMode = resolveNotesModeFromSwipe(mode, event.translationX, event.velocityX, hasRecapNotes);
          if (nextMode !== mode) {
            handleModeChange(nextMode);
          }
        }),
    [handleModeChange, hasRecapNotes, mode]
  );
  const modeSwitch = hasRecapNotes ? (
    <Reanimated.View
      entering={FadeInUp.duration(220)}
      style={[
        styles.modeSwitchWrap,
        {
          paddingHorizontal: Layout.screenPadding,
        },
      ]}
    >
      <RecapModeSwitch
        value={mode}
        onChange={handleModeChange}
        showCollection={false}
        allLabel={t('notes.recap.allLabel', 'All')}
        recapLabel={t('notes.recap.recapLabel', 'Calendar')}
        trackWidth={width - Layout.screenPadding * 2}
      />
    </Reanimated.View>
  ) : null;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(
                'notes.stickerLibrary.buttonA11y',
                'Open your sticker library'
              )}
              hitSlop={8}
              onPress={openStickerLibrary}
              style={({ pressed }) => [
                styles.headerButton,
                pressed ? styles.headerButtonPressed : null,
              ]}
              testID="notes-sticker-library-header-button"
            >
              <GlassView
                style={[
                  styles.headerButtonShell,
                  Platform.OS === 'android'
                    ? {
                        borderColor: colors.androidTabShellMutedBorder,
                      }
                    : null,
                ]}
                fallbackColor={
                  Platform.OS === 'android'
                    ? colors.androidTabShellMutedBackground
                    : colors.glassBackdrop
                }
                glassEffectStyle="regular"
                colorScheme={Platform.OS === 'android' ? (isDark ? 'dark' : 'light') : undefined}
              >
                <StickerIcon
                  size={18}
                  color={Platform.OS === 'android' ? colors.androidTabShellActive : colors.text}
                />
              </GlassView>
            </Pressable>
          ),
        }}
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {isLoading ? (
          <NotesGridSkeleton
            bottomInset={insets.bottom}
            colors={colors}
            gap={gridGap}
            loadingTitle={
              isBootstrapSyncing
                ? t('settings.syncingNow', 'Syncing your journal.')
                : t('common.loading', 'Loading')
            }
            loadingBody={t(
              'settings.initialSyncLoadingHint',
              'Keep Noto open a little longer so your first backup can finish safely.'
            )}
            showLoadingCopy={isBootstrapSyncing}
            tileSize={gridSize}
          />
        ) : (
          <>
            {modeSwitch}
            <GestureDetector gesture={modeContentGesture}>
              <View style={styles.modeContentStack}>
                {mode === 'all' ? (
                  items.length === 0 ? (
                    <View
                      testID="notes-empty-state"
                      style={[
                        styles.center,
                        styles.emptyScreen,
                        styles.modeContentFill,
                        {
                          paddingBottom: insets.bottom + 28,
                        },
                      ]}
                    >
                      <View style={styles.emptyState}>
                        <View style={styles.emptyIconWrap}>
                          <PeekingCatIcon size={54} color={colors.secondaryText} />
                        </View>
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>
                          {t('home.emptyTitle', 'No notes yet')}
                        </Text>
                        <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
                          {t('home.emptySubtitle', 'Write down what she likes or dislikes at each restaurant. We\'ll remind you next time.')}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <FlashList
                      data={tileModels}
                      keyExtractor={(model) => getHomeFeedItemKey(model.item)}
                      getItemType={(model) =>
                        `${model.item.kind}:${model.item.kind === 'note' ? model.item.note.type : model.item.post.type}`
                      }
                      drawDistance={gridSize * 2}
                      removeClippedSubviews={Platform.OS === 'android'}
                      renderItem={({ item: model, index }) => (
                        <GridTile
                          accessibilityLabel={
                            model.item.kind === 'shared-post'
                              ? t('shared.openSharedDetailsA11y', {
                                  defaultValue: 'Open shared post details for {{location}}',
                                  location: model.item.post.placeName ?? t('shared.sharedNow', 'Shared now'),
                                })
                              : t('home.openNoteDetailsA11y', {
                                  defaultValue: 'Open note details for {{location}}',
                                  location: model.item.note.locationName ?? t('home.unknownLocation', 'Unknown location'),
                                })
                          }
                          model={model}
                          index={index}
                          size={gridSize}
                          gap={gridGap}
                          colors={colors}
                          sharedPhotoUri={
                            model.item.kind === 'shared-post'
                              ? sharedPhotoUrisById[model.item.post.id] ?? model.baseImageUri ?? null
                              : null
                          }
                          onPress={() => openItem(model.item)}
                        />
                      )}
                      onViewableItemsChanged={handleViewableItemsChanged}
                      viewabilityConfig={gridViewabilityConfig}
                      numColumns={3}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={{
                        paddingBottom: insets.bottom + 28,
                        paddingHorizontal: Layout.screenPadding,
                      }}
                      style={styles.modeContentFill}
                    />
                  )
                ) : null}

                {mode === 'recap' && shouldRenderRecap ? (
                  <NotesRecapView
                    notes={notes}
                    bottomInset={insets.bottom}
                    isVisible
                    suspendPhysics={isRecapPhysicsSuspended}
                    preparedData={preparedRecap.data}
                  />
                ) : null}
              </View>
            </GestureDetector>
          </>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyScreen: {
    paddingHorizontal: Layout.screenPadding,
  },
  loadingTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'Noto Sans',
  },
  loadingBody: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: 'Noto Sans',
    maxWidth: 260,
  },
  skeletonScreen: {
    flex: 1,
    paddingTop: 4,
  },
  skeletonStatus: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  skeletonStatusTitle: {
    marginBottom: 6,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  skeletonTile: {
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
  },
  skeletonTextTile: {
    flex: 1,
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  skeletonLine: {
    height: 9,
    borderRadius: 999,
  },
  skeletonLineWide: {
    width: '78%',
  },
  skeletonLineMedium: {
    width: '58%',
  },
  skeletonLineShort: {
    width: '44%',
  },
  skeletonPhotoBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  modeSwitchWrap: {
    paddingTop: 4,
    paddingBottom: 16,
  },
  headerButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  headerButtonShell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  headerButtonPressed: {
    opacity: 0.88,
  },
  modeContentStack: {
    flex: 1,
  },
  modeContentFill: {
    flex: 1,
  },
  tilePressable: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  tilePressablePressed: {
    transform: [{ scale: 0.99 }],
  },
  tile: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  tileMediaWrap: {
    flex: 1,
  },
  tileDoodleOverlay: {
    position: 'absolute',
    ...DOODLE_ARTBOARD_FRAME,
  },
  tileTextDoodleOverlay: {
    opacity: 0.48,
  },
  tileTextStickerOverlay: {
    zIndex: 0,
  },
  photoPlaceholder: {
    flex: 1,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 1,
  },
  photoPlaceholderBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderIcon: {
    fontSize: 20,
    lineHeight: 20,
    fontWeight: '700',
  },
  tileTextFill: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'Noto Sans',
    zIndex: 1,
  },
  emptyState: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'Noto Sans',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: 'Noto Sans',
    marginTop: 8,
    maxWidth: 280,
  },
});

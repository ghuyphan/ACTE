import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../../../hooks/useHaptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Href, Stack, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { FadeInUp } from 'react-native-reanimated';
import {
  ActivityIndicator,
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
import { useSharedFeedStore } from '../../../hooks/useSharedFeed';
import { useTheme } from '../../../hooks/useTheme';
import DynamicStickerCanvas from '../../notes/DynamicStickerCanvas';
import NoteDoodleCanvas from '../../notes/NoteDoodleCanvas';
import NotesRecapView from '../../notes/recap/NotesRecapView';
import RecapModeSwitch, {
  type RecapMode,
} from '../../notes/recap/RecapModeSwitch';
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

const GRID_DOODLE_STROKE_WIDTH = 4.5;
const GRID_STICKER_MIN_SIZE = 0;
const GRID_DECORATION_REVEAL_DELAY_MS = 180;
const MODE_SWIPE_DISTANCE = 56;
const MODE_SWIPE_VELOCITY = 460;
const NOTES_BROWSE_MODE_ORDER: RecapMode[] = ['all', 'recap'];

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
  model,
  size,
  gap,
  colors,
  onPress,
  index,
  sharedPhotoUri,
}: {
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
            <ActivityIndicator size="small" color={colors.primary} />
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
  prevProps.index === nextProps.index &&
  prevProps.size === nextProps.size &&
  prevProps.gap === nextProps.gap &&
  prevProps.colors === nextProps.colors &&
  prevProps.sharedPhotoUri === nextProps.sharedPhotoUri &&
  prevProps.model === nextProps.model
));

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
  const [mode, setMode] = useState<RecapMode>('all');
  const [hasPreparedRecap, setHasPreparedRecap] = useState(process.env.NODE_ENV === 'test');
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
        photoFallbackLabel,
        showDecorations: showGridDecorations && mode === 'all',
      }),
    [items, mode, photoFallbackLabel, showGridDecorations]
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
  const isLoading = (loading || sharedLoading) && items.length === 0;
  const hasRecapNotes = notes.length > 0;
  const shouldRenderRecap = hasRecapNotes && (hasPreparedRecap || mode === 'recap');
  useEffect(() => {
    if (!hasRecapNotes && mode !== 'all') {
      setMode('all');
    }
  }, [hasRecapNotes, mode]);

  useEffect(() => {
    if (!hasRecapNotes) {
      setHasPreparedRecap(process.env.NODE_ENV === 'test');
      return;
    }

    if (hasPreparedRecap || mode === 'recap') {
      setHasPreparedRecap(true);
      return;
    }

    if (process.env.NODE_ENV === 'test') {
      setHasPreparedRecap(true);
      return;
    }

    const idleHandle = scheduleOnIdle(() => {
      setHasPreparedRecap(true);
    }, { timeout: 220 });

    return () => {
      idleHandle.cancel();
    };
  }, [hasPreparedRecap, hasRecapNotes, mode]);

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
                fallbackColor={Platform.OS === 'android' ? colors.androidTabShellMutedBackground : undefined}
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
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
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
                          <Ionicons name="document-text-outline" size={44} color={colors.secondaryText} />
                        </View>
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>
                          {t('home.emptyTitle', 'No notes yet')}
                        </Text>
                        <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
                          {t('home.emptySubtitle', 'Write down what she likes or dislikes\nat each restaurant — we\'ll remind you!')}
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
    maxWidth: 240,
  },
});

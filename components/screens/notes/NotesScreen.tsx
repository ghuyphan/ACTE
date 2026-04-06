import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Href, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  ActivityIndicator,
  InteractionManager,
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
import { useReducedMotion } from '../../../hooks/useReducedMotion';
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
import {
  getGradientStickerMotionVariant,
  getNoteColorStickerMotion,
  getTextNoteCardGradient,
  type StickerMotionVariant,
} from '../../../services/noteAppearance';
import { parseNoteDoodleStrokes } from '../../../services/noteDoodles';
import { parseNoteStickerPlacements } from '../../../services/noteStickers';
import { getNotePhotoUri } from '../../../services/photoStorage';
import { downloadPhotoFromStorage, SHARED_POST_MEDIA_BUCKET } from '../../../services/remoteMedia';
import { Note } from '../../../services/database';
import { SharedPost } from '../../../services/sharedFeedService';

type NoteGridItem =
  | { id: string; kind: 'note'; createdAt: string; note: Note }
  | { id: string; kind: 'shared-post'; createdAt: string; post: SharedPost };

const GRID_DOODLE_STROKE_WIDTH = 4.5;
const GRID_STICKER_MIN_SIZE = 0;
const GRID_TILE_ENTRY_STAGGER_MS = 28;
const GRID_TILE_ENTRY_ANIMATION_LIMIT = 5;
const GRID_DECORATION_REVEAL_DELAY_MS = 180;
const MODE_TRANSITION_DURATION_MS = 220;
const MODE_SWIPE_DISTANCE = 56;
const MODE_SWIPE_VELOCITY = 460;

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

  const swipeLeft =
    translationX <= -MODE_SWIPE_DISTANCE || velocityX <= -MODE_SWIPE_VELOCITY;
  if (currentMode === 'all' && swipeLeft) {
    return 'recap';
  }

  const swipeRight =
    translationX >= MODE_SWIPE_DISTANCE || velocityX >= MODE_SWIPE_VELOCITY;
  if (currentMode === 'recap' && swipeRight) {
    return 'all';
  }

  return currentMode;
}

function getGridTileEntering(index: number, shouldAnimate: boolean) {
  if (!shouldAnimate || index > GRID_TILE_ENTRY_ANIMATION_LIMIT) {
    return undefined;
  }

  const delay = Math.min(index, 8) * GRID_TILE_ENTRY_STAGGER_MS;
  const column = index % 3;

  if (column === 0) {
    return FadeInLeft.delay(delay).springify().damping(18).stiffness(210).mass(0.72);
  }

  if (column === 2) {
    return FadeInRight.delay(delay).springify().damping(18).stiffness(210).mass(0.72);
  }

  return FadeInUp.delay(delay).springify().damping(18).stiffness(210).mass(0.72);
}

const GridTile = memo(function GridTile({
  item,
  size,
  gap,
  colors,
  onPress,
  index,
  photoFallbackLabel,
  animateOnMount,
  showDecorations,
}: {
  item: NoteGridItem;
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
  photoFallbackLabel: string;
  animateOnMount: boolean;
  showDecorations: boolean;
}) {
  const [sharedPhotoUri, setSharedPhotoUri] = useState(
    item.kind === 'shared-post' ? item.post.photoLocalUri ?? null : null
  );

  useEffect(() => {
    if (item.kind !== 'shared-post') {
      setSharedPhotoUri(null);
      return;
    }

    setSharedPhotoUri(item.post.photoLocalUri ?? null);
  }, [item]);

  useEffect(() => {
    if (item.kind !== 'shared-post' || item.post.type !== 'photo' || sharedPhotoUri || !item.post.photoPath) {
      return;
    }

    let cancelled = false;

    void downloadPhotoFromStorage(
      SHARED_POST_MEDIA_BUCKET,
      item.post.photoPath,
      `shared-grid-${item.post.id}`
    )
      .then((nextUri) => {
        if (!cancelled && nextUri) {
          setSharedPhotoUri(nextUri);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('[notes-grid] Failed to hydrate shared photo:', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [item, sharedPhotoUri]);

  const imageUri =
    item.kind === 'note'
      ? getNotePhotoUri(item.note)
      : item.post.type === 'photo'
        ? sharedPhotoUri ?? ''
        : '';
  const isPhotoTile = (item.kind === 'note' ? item.note.type : item.post.type) === 'photo';
  const doodleStrokesJson =
    item.kind === 'note'
      ? item.note.doodleStrokesJson
      : item.post.doodleStrokesJson ?? null;
  const doodleStrokes = useMemo(
    () => (showDecorations ? parseNoteDoodleStrokes(doodleStrokesJson) : []),
    [doodleStrokesJson, showDecorations]
  );
  const stickerPlacementsJson =
    item.kind === 'note'
      ? item.note.stickerPlacementsJson ?? null
      : item.post.stickerPlacementsJson ?? null;
  const stickerPlacements = useMemo(
    () => (showDecorations ? parseNoteStickerPlacements(stickerPlacementsJson) : []),
    [showDecorations, stickerPlacementsJson]
  );
  const text =
    item.kind === 'note'
      ? item.note.content.trim()
      : (item.post.text || '').trim();
  const textGradient = useMemo(
    () =>
      getTextNoteCardGradient({
        text,
        noteId: item.kind === 'note' ? item.note.id : item.post.id,
        emoji: item.kind === 'note' ? item.note.moodEmoji : null,
        noteColor: item.kind === 'note' ? item.note.noteColor : item.post.noteColor,
      }),
    [item, text]
  );
  const stickerMotionVariant = useMemo<StickerMotionVariant>(() => {
    if (isPhotoTile) {
      return 'physics';
    }

    const noteColor = item.kind === 'note' ? item.note.noteColor : item.post.noteColor;
    return getNoteColorStickerMotion(noteColor) ?? getGradientStickerMotionVariant(textGradient);
  }, [isPhotoTile, item, textGradient]);
  const tileText = text || (isPhotoTile ? photoFallbackLabel : '');
  const showPhotoPlaceholder = item.kind === 'shared-post' && item.post.type === 'photo' && !imageUri;
  const sharedTransitionTag = item.kind === 'note' ? `feed-note-card-${item.note.id}` : undefined;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tilePressable,
        {
          width: size,
          height: size,
          marginRight: index % 3 === 2 ? 0 : gap,
          marginBottom: gap,
        },
      ]}
    >
      <Reanimated.View
        entering={getGridTileEntering(index, animateOnMount)}
        sharedTransitionTag={sharedTransitionTag}
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
            {stickerPlacements.length > 0 ? (
              <View pointerEvents="none" style={styles.tileDoodleOverlay}>
                <DynamicStickerCanvas
                  placements={stickerPlacements}
                  remoteBucket={item.kind === 'shared-post' ? SHARED_POST_MEDIA_BUCKET : undefined}
                  sharedCache={item.kind === 'shared-post'}
                  minimumBaseSize={GRID_STICKER_MIN_SIZE}
                  motionVariant={stickerMotionVariant}
                />
              </View>
            ) : null}
            {doodleStrokes.length > 0 ? (
              <View pointerEvents="none" style={styles.tileDoodleOverlay}>
                <NoteDoodleCanvas strokes={doodleStrokes} strokeWidth={GRID_DOODLE_STROKE_WIDTH} />
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
          <LinearGradient colors={textGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tileTextFill}>
            {stickerPlacements.length > 0 ? (
              <View pointerEvents="none" style={[styles.tileDoodleOverlay, styles.tileTextStickerOverlay]}>
                <DynamicStickerCanvas
                  placements={stickerPlacements}
                  remoteBucket={item.kind === 'shared-post' ? SHARED_POST_MEDIA_BUCKET : undefined}
                  sharedCache={item.kind === 'shared-post'}
                  minimumBaseSize={GRID_STICKER_MIN_SIZE}
                  motionVariant={stickerMotionVariant}
                />
              </View>
            ) : null}
            {doodleStrokes.length > 0 ? (
              <View pointerEvents="none" style={[styles.tileDoodleOverlay, styles.tileTextDoodleOverlay]}>
                <NoteDoodleCanvas strokes={doodleStrokes} strokeWidth={GRID_DOODLE_STROKE_WIDTH} />
              </View>
            ) : null}
            {tileText ? (
              <Text style={styles.tileText} numberOfLines={4}>
                {tileText}
              </Text>
            ) : null}
          </LinearGradient>
        )}
      </Reanimated.View>
    </Pressable>
  );
}, (prevProps, nextProps) => (
  prevProps.animateOnMount === nextProps.animateOnMount &&
  prevProps.showDecorations === nextProps.showDecorations &&
  prevProps.index === nextProps.index &&
  prevProps.size === nextProps.size &&
  prevProps.gap === nextProps.gap &&
  prevProps.colors === nextProps.colors &&
  prevProps.photoFallbackLabel === nextProps.photoFallbackLabel &&
  prevProps.item.id === nextProps.item.id &&
  prevProps.item.kind === nextProps.item.kind &&
  prevProps.item.createdAt === nextProps.item.createdAt &&
  (prevProps.item.kind === 'note' && nextProps.item.kind === 'note'
    ? prevProps.item.note === nextProps.item.note
    : prevProps.item.kind === 'shared-post' && nextProps.item.kind === 'shared-post'
      ? prevProps.item.post === nextProps.item.post
      : false)
));

export default function NotesIndexScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reduceMotionEnabled = useReducedMotion();
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
  const [showAllModeLayer, setShowAllModeLayer] = useState(true);
  const [isRecapPhysicsSuspended, setIsRecapPhysicsSuspended] = useState(false);
  const modeProgress = useSharedValue(0);

  const friendPosts = useMemo(
    () => sharedPosts.filter((post) => post.authorUid !== user?.uid),
    [sharedPosts, user?.uid]
  );
  const items = useMemo<NoteGridItem[]>(
    () =>
      [
        ...notes.map((note) => ({
          id: `note-${note.id}`,
          kind: 'note' as const,
          createdAt: note.createdAt,
          note,
        })),
        ...friendPosts.map((post) => ({
          id: `shared-${post.id}`,
          kind: 'shared-post' as const,
          createdAt: post.createdAt,
          post,
        })),
      ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [friendPosts, notes]
  );

  const gridGap = 8;
  const gridSize = Math.floor((width - Layout.screenPadding * 2 - gridGap * 2) / 3);
  const isLoading = loading || (sharedLoading && items.length === 0);
  const hasRecapNotes = notes.length > 0;
  const shouldRenderRecap = hasRecapNotes && (hasPreparedRecap || mode === 'recap');
  const shouldRenderAllMode = showAllModeLayer;
  const shouldAnimateGridTiles =
    !reduceMotionEnabled && Platform.OS !== 'android' && items.length <= GRID_TILE_ENTRY_ANIMATION_LIMIT + 1;

  useEffect(() => {
    if (!hasRecapNotes && mode === 'recap') {
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

    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      setHasPreparedRecap(true);
    });

    return () => {
      interactionHandle.cancel();
    };
  }, [hasPreparedRecap, hasRecapNotes, mode]);

  useEffect(() => {
    if (mode === 'all') {
      setShowAllModeLayer(true);
      return;
    }

    if (process.env.NODE_ENV === 'test') {
      setShowAllModeLayer(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      setShowAllModeLayer(false);
    }, MODE_TRANSITION_DURATION_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [mode]);

  useEffect(() => {
    modeProgress.value = withTiming(mode === 'recap' ? 1 : 0, {
      duration: MODE_TRANSITION_DURATION_MS,
    });
  }, [mode, modeProgress]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    let cancelled = false;
    let animationFrameId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let interactionHandle: { cancel: () => void } | null = null;

    setShowGridDecorations(false);

    if (mode !== 'all') {
      return () => {
        cancelled = true;
      };
    }

    interactionHandle = InteractionManager.runAfterInteractions(() => {
      animationFrameId = requestAnimationFrame(() => {
        timeoutId = setTimeout(() => {
          if (!cancelled) {
            setShowGridDecorations(true);
          }
        }, GRID_DECORATION_REVEAL_DELAY_MS);
      });
    });

    return () => {
      cancelled = true;
      interactionHandle?.cancel();
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [mode]);

  const allLayerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - modeProgress.value,
    transform: [
      { translateY: modeProgress.value * -8 },
      { scale: 1 - modeProgress.value * 0.02 },
    ],
  }));
  const recapLayerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: modeProgress.value,
    transform: [
      { translateY: (1 - modeProgress.value) * 10 },
      { scale: 0.985 + modeProgress.value * 0.015 },
    ],
  }));

  const openItem = useCallback(
    (item: NoteGridItem) => {
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
  const handleModeChange = useCallback((nextMode: RecapMode) => {
    if (nextMode === mode) {
      return;
    }

    if (nextMode === 'all' && mode === 'recap' && process.env.NODE_ENV !== 'test') {
      setIsRecapPhysicsSuspended(true);
      requestAnimationFrame(() => {
        setMode('all');
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
        allLabel={t('notes.recap.allLabel', 'All')}
        recapLabel={t('notes.recap.recapLabel', 'Calendar')}
        trackWidth={width - Layout.screenPadding * 2}
      />
    </Reanimated.View>
  ) : null;

  return (
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
              {shouldRenderAllMode ? (
                <Reanimated.View
                  pointerEvents={mode === 'all' ? 'auto' : 'none'}
                  style={[styles.modeContentLayer, allLayerAnimatedStyle]}
                >
                  {items.length === 0 ? (
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
                      data={items}
                      keyExtractor={(item) => item.id}
                      getItemType={(item) => `${item.kind}:${item.kind === 'note' ? item.note.type : item.post.type}`}
                      drawDistance={gridSize * 2}
                      removeClippedSubviews={Platform.OS === 'android'}
                      renderItem={({ item, index }) => (
                        <GridTile
                          item={item}
                          index={index}
                          size={gridSize}
                          gap={gridGap}
                          colors={colors}
                          photoFallbackLabel={t('shared.photoMemory', 'Photo memory')}
                          animateOnMount={shouldAnimateGridTiles}
                          showDecorations={showGridDecorations && mode === 'all'}
                          onPress={() => openItem(item)}
                        />
                      )}
                      numColumns={3}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={{
                        paddingBottom: insets.bottom + 28,
                        paddingHorizontal: Layout.screenPadding,
                      }}
                      style={styles.modeContentFill}
                    />
                  )}
                </Reanimated.View>
              ) : null}

              {shouldRenderRecap ? (
                <Reanimated.View
                  pointerEvents={mode === 'recap' ? 'auto' : 'none'}
                  style={[styles.modeContentLayer, recapLayerAnimatedStyle]}
                >
                  <NotesRecapView
                    notes={notes}
                    bottomInset={insets.bottom}
                    isVisible={mode === 'recap'}
                    suspendPhysics={isRecapPhysicsSuspended}
                  />
                </Reanimated.View>
              ) : null}
            </View>
          </GestureDetector>
        </>
      )}
    </View>
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
    paddingBottom: 18,
  },
  modeContentStack: {
    flex: 1,
    position: 'relative',
  },
  modeContentLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  modeContentFill: {
    flex: 1,
  },
  tilePressable: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  tile: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
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
    opacity: 0.48,
    zIndex: 0,
  },
  photoPlaceholder: {
    flex: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
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
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
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

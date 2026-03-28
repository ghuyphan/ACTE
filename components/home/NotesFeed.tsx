import { FlashList } from '@shopify/flash-list';
import { TFunction } from 'i18next';
import { ReactElement, RefObject, memo, useCallback, useEffect, useMemo, useRef } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  Dimensions,
  Platform,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { Note } from '../../services/database';
import { SharedPost } from '../../services/sharedFeedService';
import { Layout } from '../../constants/theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { NoteMemoryCard, SharedPostMemoryCard } from './MemoryCardPrimitives';

const { width, height } = Dimensions.get('window');
const MAX_STAGGERED_ENTRANCE_INDEX = 2;
const ENTRANCE_DELAY_MS = 24;

function getEntranceDelay(index: number) {
  return Math.min(index, MAX_STAGGERED_ENTRANCE_INDEX) * ENTRANCE_DELAY_MS;
}

const AnimatedNoteCard = memo(function AnimatedNoteCard({
  item,
  index,
  onOpenNote,
  colors,
  t,
  shouldReveal,
  revealToken,
}: {
  item: Note;
  index: number;
  onOpenNote: (noteId: string) => void;
  colors: {
    primary: string;
    text: string;
    secondaryText: string;
    danger: string;
    card: string;
  };
  t: TFunction;
  shouldReveal: boolean;
  revealToken: number;
}) {
  const reduceMotionEnabled = useReducedMotion();
  const scale = useSharedValue(0.9);
  const cardTranslateY = useSharedValue(18);
  const metaTranslateY = useSharedValue(10);
  const revealScale = useSharedValue(1);
  const revealTranslateY = useSharedValue(0);
  const revealGlow = useSharedValue(0);
  const lastRevealTokenRef = useRef<number | null>(null);
  const mountIndex = useRef(index).current;
  const sharedTransitionTag = `feed-note-card-${item.id}`;
  const entranceDelay = getEntranceDelay(mountIndex);

  useEffect(() => {
    scale.value = withDelay(entranceDelay, withTiming(1, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      }));
    cardTranslateY.value = withDelay(entranceDelay, withTiming(0, {
        duration: 280,
        easing: Easing.out(Easing.cubic),
      }));
    metaTranslateY.value = withDelay(entranceDelay, withTiming(0, {
        duration: 240,
        easing: Easing.out(Easing.cubic),
      }));
  }, [cardTranslateY, entranceDelay, metaTranslateY, scale]);

  useEffect(() => {
    if (!shouldReveal || revealToken === 0 || lastRevealTokenRef.current === revealToken) {
      return;
    }

    lastRevealTokenRef.current = revealToken;
    revealScale.value = reduceMotionEnabled ? 0.99 : 0.965;
    revealTranslateY.value = reduceMotionEnabled ? 4 : 12;
    revealGlow.value = 0;
    revealScale.value = withSequence(
      withTiming(1.02, {
        duration: reduceMotionEnabled ? 90 : 190,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(1, {
        duration: reduceMotionEnabled ? 140 : 260,
        easing: Easing.out(Easing.back(1.05)),
      })
    );
    revealTranslateY.value = withTiming(0, {
      duration: reduceMotionEnabled ? 100 : 220,
      easing: Easing.out(Easing.cubic),
    });
    revealGlow.value = withSequence(
      withTiming(1, {
        duration: reduceMotionEnabled ? 90 : 180,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(0, {
        duration: reduceMotionEnabled ? 220 : 620,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [reduceMotionEnabled, revealGlow, revealScale, revealToken, revealTranslateY, shouldReveal]);

  const revealGlowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: revealGlow.value,
    transform: [{ scale: revealScale.value }],
  }));
  const noteCardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: cardTranslateY.value + revealTranslateY.value },
      { scale: scale.value * revealScale.value },
    ],
  }));
  const noteMetaAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: metaTranslateY.value }],
  }));

  return (
    <View style={styles.revealWrap}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.revealGlow,
          {
            backgroundColor: colors.primary,
          },
          revealGlowAnimatedStyle,
        ]}
      />
      <Animated.View sharedTransitionTag={sharedTransitionTag}>
        <Animated.View style={noteCardAnimatedStyle}>
          <Animated.View style={noteMetaAnimatedStyle}>
            <NoteMemoryCard
              note={item}
              onPress={() => onOpenNote(item.id)}
              colors={colors}
              t={t}
            />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}, (prevProps, nextProps) => (
  prevProps.index === nextProps.index &&
  prevProps.colors === nextProps.colors &&
  prevProps.t === nextProps.t &&
  prevProps.onOpenNote === nextProps.onOpenNote &&
  prevProps.item.id === nextProps.item.id &&
  prevProps.item.type === nextProps.item.type &&
  prevProps.item.content === nextProps.item.content &&
  prevProps.item.photoLocalUri === nextProps.item.photoLocalUri &&
  prevProps.item.locationName === nextProps.item.locationName &&
  prevProps.item.createdAt === nextProps.item.createdAt &&
  prevProps.item.isFavorite === nextProps.item.isFavorite &&
  prevProps.item.moodEmoji === nextProps.item.moodEmoji &&
  prevProps.item.noteColor === nextProps.item.noteColor &&
  prevProps.item.hasDoodle === nextProps.item.hasDoodle &&
  prevProps.item.doodleStrokesJson === nextProps.item.doodleStrokesJson &&
  prevProps.item.hasStickers === nextProps.item.hasStickers &&
  prevProps.item.stickerPlacementsJson === nextProps.item.stickerPlacementsJson &&
  prevProps.shouldReveal === nextProps.shouldReveal &&
  prevProps.revealToken === nextProps.revealToken
));

const AnimatedSharedPostCard = memo(function AnimatedSharedPostCard({
  item,
  index,
  colors,
  t,
  onOpenSharedPost,
}: {
  item: SharedPost;
  index: number;
  onOpenSharedPost?: (postId: string) => void;
  colors: {
    primary: string;
    text: string;
    secondaryText: string;
    danger: string;
    card: string;
    border?: string;
  };
  t: TFunction;
}) {
  const scale = useSharedValue(0.9);
  const translateY = useSharedValue(18);
  const mountIndex = useRef(index).current;
  const entranceDelay = getEntranceDelay(mountIndex);

  useEffect(() => {
    scale.value = withDelay(entranceDelay, withTiming(1, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      }));
    translateY.value = withDelay(entranceDelay, withTiming(0, {
        duration: 280,
        easing: Easing.out(Easing.cubic),
      }));
  }, [entranceDelay, scale, translateY]);

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedCardStyle}>
      <SharedPostMemoryCard
        post={item}
        onPress={onOpenSharedPost ? () => onOpenSharedPost(item.id) : undefined}
        colors={colors}
        t={t}
      />
    </Animated.View>
  );
}, (prevProps, nextProps) => (
  prevProps.index === nextProps.index &&
  prevProps.colors === nextProps.colors &&
  prevProps.t === nextProps.t &&
  prevProps.onOpenSharedPost === nextProps.onOpenSharedPost &&
  prevProps.item.id === nextProps.item.id &&
  prevProps.item.type === nextProps.item.type &&
  prevProps.item.text === nextProps.item.text &&
  prevProps.item.photoLocalUri === nextProps.item.photoLocalUri &&
  prevProps.item.photoPath === nextProps.item.photoPath &&
  prevProps.item.doodleStrokesJson === nextProps.item.doodleStrokesJson &&
  prevProps.item.hasStickers === nextProps.item.hasStickers &&
  prevProps.item.stickerPlacementsJson === nextProps.item.stickerPlacementsJson &&
  prevProps.item.noteColor === nextProps.item.noteColor &&
  prevProps.item.placeName === nextProps.item.placeName &&
  prevProps.item.createdAt === nextProps.item.createdAt &&
  prevProps.item.authorDisplayName === nextProps.item.authorDisplayName &&
  prevProps.item.authorPhotoURLSnapshot === nextProps.item.authorPhotoURLSnapshot
));

type NotesFeedListItem =
  | { id: string; kind: 'note'; note: Note; createdAt: string }
  | { id: string; kind: 'shared-post'; post: SharedPost; createdAt: string };

interface NotesFeedProps {
  flatListRef: RefObject<any>;
  captureHeader: ReactElement;
  captureMode: 'text' | 'camera';
  notes: Note[];
  sharedPosts?: SharedPost[];
  refreshing: boolean;
  onRefresh: () => void;
  topInset: number;
  snapHeight: number;
  onOpenNote: (noteId: string) => void;
  onOpenSharedPost?: (postId: string) => void;
  colors: {
    primary: string;
    text: string;
    secondaryText: string;
    danger: string;
    card: string;
    border?: string;
  };
  t: TFunction;
  onCaptureVisibilityChange?: (isVisible: boolean) => void;
  scrollEnabled?: boolean;
  revealedNoteId?: string | null;
  revealToken?: number;
  onSettledArchiveItemChange?: (item: { id: string; kind: 'note' | 'shared-post' } | null) => void;
}

export default function NotesFeed({
  flatListRef,
  captureHeader,
  captureMode,
  notes,
  sharedPosts = [],
  refreshing,
  onRefresh,
  topInset,
  snapHeight,
  onOpenNote,
  onOpenSharedPost,
  colors,
  t,
  onCaptureVisibilityChange,
  scrollEnabled = true,
  revealedNoteId = null,
  revealToken = 0,
  onSettledArchiveItemChange,
}: NotesFeedProps) {
  const captureVisibilityRef = useRef(true);
  const isAdjustingSnapRef = useRef(false);
  const listData = useMemo<NotesFeedListItem[]>(
    () =>
      [
        ...notes.map((note) => ({
          id: note.id,
          kind: 'note' as const,
          note,
          createdAt: note.createdAt,
        })),
        ...sharedPosts.map((post) => ({
          id: post.id,
          kind: 'shared-post' as const,
          post,
          createdAt: post.createdAt,
        })),
      ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [notes, sharedPosts]
  );
  const refreshSpinnerOffset = topInset + Layout.headerHeight + Layout.floatingGap;

  const reportCaptureVisibility = useCallback(
    (offsetY: number) => {
      const visibilityThreshold = Math.min(Math.max(snapHeight * 0.1, 48), 72);
      const nextIsVisible = offsetY <= visibilityThreshold;

      if (captureVisibilityRef.current === nextIsVisible) {
        return;
      }

      captureVisibilityRef.current = nextIsVisible;
      onCaptureVisibilityChange?.(nextIsVisible);
    },
    [onCaptureVisibilityChange, snapHeight]
  );

  useEffect(() => {
    captureVisibilityRef.current = true;
    onCaptureVisibilityChange?.(true);
  }, [onCaptureVisibilityChange]);

  const settleCaptureVisibility = useCallback((offsetY: number) => {
    reportCaptureVisibility(offsetY);
  }, [reportCaptureVisibility]);

  const settleAndroidSnap = useCallback(
    (offsetY: number) => {
      if (Platform.OS !== 'android') {
        return;
      }

      if (isAdjustingSnapRef.current) {
        isAdjustingSnapRef.current = false;
        return;
      }

      const maxSnapOffset = listData.length * snapHeight;
      const nearestSnapOffset = Math.min(
        maxSnapOffset,
        Math.max(0, Math.round(offsetY / snapHeight) * snapHeight)
      );

      if (Math.abs(nearestSnapOffset - offsetY) < 2) {
        return;
      }

      isAdjustingSnapRef.current = true;
      flatListRef.current?.scrollToOffset({ offset: nearestSnapOffset, animated: true });
    },
    [flatListRef, listData.length, snapHeight]
  );

  const reportSettledArchiveItem = useCallback(
    (offsetY: number) => {
      const settledOffset =
        Platform.OS === 'android'
          ? Math.min(
              listData.length * snapHeight,
              Math.max(0, Math.round(offsetY / snapHeight) * snapHeight)
            )
          : offsetY;
      const rawIndex = Math.round(settledOffset / snapHeight) - 1;
      const nextItem = rawIndex >= 0 ? listData[rawIndex] ?? null : null;

      onSettledArchiveItemChange?.(
        nextItem
          ? {
              id: nextItem.id,
              kind: nextItem.kind,
            }
          : null
      );
    },
    [listData, onSettledArchiveItemChange, snapHeight]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: NotesFeedListItem; index: number }) => {
      if (item.kind === 'shared-post') {
        return (
          <View style={[styles.snapItem, { height: snapHeight, paddingTop: topInset + 60 }]}>
            <View style={styles.cardStage}>
              <AnimatedSharedPostCard
                item={item.post}
                index={index}
                onOpenSharedPost={onOpenSharedPost}
                colors={colors}
                t={t}
              />
            </View>
          </View>
        );
      }

      return (
        <View style={[styles.snapItem, { height: snapHeight, paddingTop: topInset + 60 }]}>
          <View style={styles.cardStage}>
            <AnimatedNoteCard
              item={item.note}
              index={index}
              onOpenNote={onOpenNote}
              colors={colors}
              t={t}
              shouldReveal={item.note.id === revealedNoteId}
              revealToken={revealToken}
            />
          </View>
        </View>
      );
    },
    [
      colors,
      onOpenNote,
      onOpenSharedPost,
      revealedNoteId,
      revealToken,
      snapHeight,
      t,
      topInset,
    ]
  );

  return (
    <FlashList
      ref={flatListRef}
      data={listData}
      keyExtractor={(item) => `${item.kind}:${item.id}`}
      renderItem={renderItem}
      getItemType={(item) => item.kind}
      drawDistance={snapHeight * 2}
      removeClippedSubviews={Platform.OS === 'android' && captureMode !== 'camera'}
      snapToInterval={snapHeight}
      disableIntervalMomentum={Platform.OS === 'android'}
      snapToAlignment="start"
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={captureHeader}
      onScroll={(event) => {
        reportCaptureVisibility(event.nativeEvent.contentOffset.y);
      }}
      scrollEventThrottle={16}
      onScrollEndDrag={(event) => {
        const velocityY = event.nativeEvent.velocity?.y ?? 0;
        if (Math.abs(velocityY) < 0.05) {
          const offsetY = event.nativeEvent.contentOffset.y;
          settleCaptureVisibility(offsetY);
          reportSettledArchiveItem(offsetY);
        }
      }}
      onMomentumScrollEnd={(event) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        settleCaptureVisibility(offsetY);
        settleAndroidSnap(offsetY);
        reportSettledArchiveItem(offsetY);
      }}
      contentContainerStyle={{ paddingBottom: height - snapHeight }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          progressViewOffset={refreshSpinnerOffset}
        />
      }
      scrollEnabled={scrollEnabled}
    />
  );
}

const styles = StyleSheet.create({
  snapItem: {
    width,
    justifyContent: 'flex-start',
  },
  cardStage: {
    flex: 1,
    justifyContent: 'center',
  },
  revealWrap: {
    alignSelf: 'center',
    overflow: 'visible',
  },
  revealGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: Layout.cardRadius + 18,
  },
});

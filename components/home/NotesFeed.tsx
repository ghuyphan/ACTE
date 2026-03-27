import { FlashList } from '@shopify/flash-list';
import { TFunction } from 'i18next';
import { ReactElement, RefObject, memo, useCallback, useEffect, useMemo, useRef } from 'react';
import Reanimated from 'react-native-reanimated';
import {
  Animated,
  Dimensions,
  Easing as RNEasing,
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
  const scale = useRef(new Animated.Value(0.9)).current;
  const cardTranslateY = useRef(new Animated.Value(18)).current;
  const metaTranslateY = useRef(new Animated.Value(10)).current;
  const revealScale = useRef(new Animated.Value(1)).current;
  const revealTranslateY = useRef(new Animated.Value(0)).current;
  const revealGlow = useRef(new Animated.Value(0)).current;
  const lastRevealTokenRef = useRef<number | null>(null);
  const mountIndex = useRef(index).current;
  const sharedTransitionTag = `feed-note-card-${item.id}`;
  const entranceDelay = getEntranceDelay(mountIndex);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 260,
        easing: RNEasing.out(RNEasing.cubic),
        delay: entranceDelay,
        useNativeDriver: true,
      }),
      Animated.timing(cardTranslateY, {
        toValue: 0,
        duration: 280,
        delay: entranceDelay,
        easing: RNEasing.out(RNEasing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(metaTranslateY, {
        toValue: 0,
        duration: 240,
        delay: entranceDelay,
        easing: RNEasing.out(RNEasing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [cardTranslateY, entranceDelay, metaTranslateY, scale]);

  useEffect(() => {
    if (!shouldReveal || revealToken === 0 || lastRevealTokenRef.current === revealToken) {
      return;
    }

    lastRevealTokenRef.current = revealToken;
    revealScale.setValue(reduceMotionEnabled ? 0.99 : 0.965);
    revealTranslateY.setValue(reduceMotionEnabled ? 4 : 12);
    revealGlow.setValue(0);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(revealScale, {
          toValue: 1.02,
          duration: reduceMotionEnabled ? 90 : 190,
          easing: RNEasing.out(RNEasing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(revealTranslateY, {
          toValue: 0,
          duration: reduceMotionEnabled ? 100 : 220,
          easing: RNEasing.out(RNEasing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(revealGlow, {
          toValue: 1,
          duration: reduceMotionEnabled ? 90 : 180,
          easing: RNEasing.out(RNEasing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(revealScale, {
          toValue: 1,
          duration: reduceMotionEnabled ? 140 : 260,
          easing: RNEasing.out(RNEasing.back(1.05)),
          useNativeDriver: true,
        }),
        Animated.timing(revealGlow, {
          toValue: 0,
          duration: reduceMotionEnabled ? 220 : 620,
          easing: RNEasing.out(RNEasing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [reduceMotionEnabled, revealGlow, revealScale, revealToken, revealTranslateY, shouldReveal]);

  return (
    <View style={styles.revealWrap}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.revealGlow,
          {
            backgroundColor: colors.primary,
            opacity: revealGlow,
            transform: [{ scale: revealScale }],
          },
        ]}
      />
      <Reanimated.View sharedTransitionTag={sharedTransitionTag}>
        <Animated.View
          style={{
            transform: [
              { translateY: Animated.add(cardTranslateY, revealTranslateY) },
              { scale: Animated.multiply(scale, revealScale) },
            ],
          }}
        >
          <Animated.View style={{ transform: [{ translateY: metaTranslateY }] }}>
            <NoteMemoryCard
              note={item}
              onPress={() => onOpenNote(item.id)}
              colors={colors}
              t={t}
            />
          </Animated.View>
        </Animated.View>
      </Reanimated.View>
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
  const scale = useRef(new Animated.Value(0.9)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  const mountIndex = useRef(index).current;
  const entranceDelay = getEntranceDelay(mountIndex);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 260,
        easing: RNEasing.out(RNEasing.cubic),
        delay: entranceDelay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        delay: entranceDelay,
        easing: RNEasing.out(RNEasing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [entranceDelay, scale, translateY]);

  return (
    <Animated.View style={{ transform: [{ translateY }, { scale }] }}>
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
    ...StyleSheet.absoluteFillObject,
    borderRadius: Layout.cardRadius + 18,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { TFunction } from 'i18next';
import { ReactElement, RefObject, memo, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing as RNEasing,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Note } from '../../services/database';
import { SharedPost } from '../../services/sharedFeedService';
import { Layout } from '../../constants/theme';
import { NoteMemoryCard, SharedPostMemoryCard } from './MemoryCardPrimitives';

const { width, height } = Dimensions.get('window');

const AnimatedNoteCard = memo(function AnimatedNoteCard({
  item,
  index,
  onOpenNote,
  colors,
  t,
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
}) {
  const scale = useRef(new Animated.Value(0.9)).current;
  const cardTranslateY = useRef(new Animated.Value(18)).current;
  const metaTranslateY = useRef(new Animated.Value(10)).current;
  const mountIndex = useRef(index).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 260,
        easing: RNEasing.out(RNEasing.cubic),
        delay: mountIndex * 50,
        useNativeDriver: true,
      }),
      Animated.timing(cardTranslateY, {
        toValue: 0,
        duration: 280,
        delay: mountIndex * 50,
        easing: RNEasing.out(RNEasing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(metaTranslateY, {
        toValue: 0,
        duration: 240,
        delay: mountIndex * 50,
        easing: RNEasing.out(RNEasing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [cardTranslateY, metaTranslateY, mountIndex, scale]);

  return (
    <Animated.View
      style={{
        transform: [{ translateY: cardTranslateY }, { scale }],
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
  prevProps.item.hasDoodle === nextProps.item.hasDoodle
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

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 260,
        easing: RNEasing.out(RNEasing.cubic),
        delay: mountIndex * 50,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        delay: mountIndex * 50,
        easing: RNEasing.out(RNEasing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [mountIndex, scale, translateY]);

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
  onOpenArchive?: () => void;
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
  onOpenArchive,
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
  const shouldShowArchiveCta = Boolean(onOpenArchive) && listData.length > 0;

  const renderArchiveCta = useCallback(() => {
    if (!shouldShowArchiveCta || !onOpenArchive) {
      return null;
    }

    return (
      <View style={styles.archiveCtaWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('notes.viewAllButton', 'View all notes')}
          onPress={onOpenArchive}
          style={[
            styles.archiveCtaButton,
            {
              backgroundColor: colors.card,
              borderColor: colors.border ?? colors.card,
            },
          ]}
        >
          <Ionicons name="grid-outline" size={18} color={colors.text} />
          <Text style={[styles.archiveCtaLabel, { color: colors.text }]}>
            {t('notes.viewAllButton', 'View all notes')}
          </Text>
        </Pressable>
      </View>
    );
  }, [colors.border, colors.card, colors.text, onOpenArchive, shouldShowArchiveCta, t]);

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

  const renderItem = useCallback(
    ({ item, index }: { item: NotesFeedListItem; index: number }) => {
      const archiveCta = index === 0 ? renderArchiveCta() : null;

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
            {archiveCta}
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
            />
          </View>
          {archiveCta}
        </View>
      );
    },
    [colors, onOpenNote, onOpenSharedPost, renderArchiveCta, snapHeight, t, topInset]
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
          settleCaptureVisibility(event.nativeEvent.contentOffset.y);
        }
      }}
      onMomentumScrollEnd={(event) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        settleCaptureVisibility(offsetY);
        settleAndroidSnap(offsetY);
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
  archiveCtaWrap: {
    alignSelf: 'center',
    marginBottom: 18,
  },
  archiveCtaButton: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  archiveCtaLabel: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'System',
  },
});

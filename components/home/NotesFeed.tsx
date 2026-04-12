import { FlashList } from '@shopify/flash-list';
import { TFunction } from 'i18next';
import { ReactElement, RefObject, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {
  Platform,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Note } from '../../services/database';
import { SharedPost } from '../../services/sharedFeedService';
import { Layout } from '../../constants/theme';
import { buildHomeFeedItems, type HomeFeedItem, getHomeFeedItemKey } from './feedItems';
import { NoteMemoryCard, SharedPostMemoryCard } from './MemoryCardPrimitives';

const DOCKED_HEADER_CONTENT_OVERLAP = 22;
const CAPTURE_PAGE_STICKY_THRESHOLD = 0.62;
const CAPTURE_PAGE_STICKY_VELOCITY_THRESHOLD = 0.9;
const SCROLL_SNAP_EPSILON = 2;
const REFRESH_PULL_THRESHOLD = -6;
const HOME_PAGE_VISUAL_BOTTOM_INSET = 90;
const INACTIVE_CARD_SCALE = 0.968;
const INACTIVE_CARD_OPACITY = 0.78;
const INACTIVE_CARD_TRANSLATE_Y = 24;

const AnimatedNoteCard = memo(function AnimatedNoteCard({
  item,
  index,
  onOpenNote,
  colors,
  t,
  isActive,
  isSharedByMe,
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
  isActive: boolean;
  isSharedByMe: boolean;
}) {
  return (
    <View>
      <NoteMemoryCard
        note={item}
        onPress={() => onOpenNote(item.id)}
        colors={colors}
        t={t}
        isActive={isActive}
        isSharedByMe={isSharedByMe}
      />
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
  prevProps.item.caption === nextProps.item.caption &&
  prevProps.item.photoLocalUri === nextProps.item.photoLocalUri &&
  prevProps.item.isLivePhoto === nextProps.item.isLivePhoto &&
  prevProps.item.pairedVideoLocalUri === nextProps.item.pairedVideoLocalUri &&
  prevProps.item.locationName === nextProps.item.locationName &&
  prevProps.item.createdAt === nextProps.item.createdAt &&
  prevProps.item.isFavorite === nextProps.item.isFavorite &&
  prevProps.item.moodEmoji === nextProps.item.moodEmoji &&
  prevProps.item.noteColor === nextProps.item.noteColor &&
  prevProps.item.hasDoodle === nextProps.item.hasDoodle &&
  prevProps.item.doodleStrokesJson === nextProps.item.doodleStrokesJson &&
  prevProps.item.hasStickers === nextProps.item.hasStickers &&
  prevProps.item.stickerPlacementsJson === nextProps.item.stickerPlacementsJson &&
  prevProps.isSharedByMe === nextProps.isSharedByMe &&
  prevProps.isActive === nextProps.isActive
));

const AnimatedSharedPostCard = memo(function AnimatedSharedPostCard({
  item,
  index,
  colors,
  t,
  onOpenSharedPost,
  isActive,
  pageOffset,
  scrollOffsetY,
  snapHeight,
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
  isActive: boolean;
  pageOffset: number;
  scrollOffsetY: SharedValue<number>;
  snapHeight: number;
}) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));
  const pageAnimatedStyle = useAnimatedStyle(() => {
    const distanceFromFocus = Math.min(
      Math.abs(Math.max(0, scrollOffsetY.value) - pageOffset) / Math.max(snapHeight, 1),
      1
    );

    return {
      opacity: interpolate(distanceFromFocus, [0, 1], [1, INACTIVE_CARD_OPACITY], Extrapolation.CLAMP),
      transform: [
        {
          translateY: interpolate(
            distanceFromFocus,
            [0, 1],
            [0, INACTIVE_CARD_TRANSLATE_Y],
            Extrapolation.CLAMP
          ),
        },
        {
          scale: interpolate(distanceFromFocus, [0, 1], [1, INACTIVE_CARD_SCALE], Extrapolation.CLAMP),
        },
      ],
    };
  }, [pageOffset, scrollOffsetY, snapHeight]);

  return (
    <Animated.View style={pageAnimatedStyle}>
      <Animated.View style={animatedCardStyle}>
        <SharedPostMemoryCard
          post={item}
          onPress={onOpenSharedPost ? () => onOpenSharedPost(item.id) : undefined}
          colors={colors}
          t={t}
          isActive={isActive}
        />
      </Animated.View>
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
  prevProps.item.isLivePhoto === nextProps.item.isLivePhoto &&
  prevProps.item.pairedVideoLocalUri === nextProps.item.pairedVideoLocalUri &&
  prevProps.item.pairedVideoPath === nextProps.item.pairedVideoPath &&
  prevProps.item.doodleStrokesJson === nextProps.item.doodleStrokesJson &&
  prevProps.item.hasStickers === nextProps.item.hasStickers &&
  prevProps.item.stickerPlacementsJson === nextProps.item.stickerPlacementsJson &&
  prevProps.item.noteColor === nextProps.item.noteColor &&
  prevProps.item.placeName === nextProps.item.placeName &&
  prevProps.item.createdAt === nextProps.item.createdAt &&
  prevProps.item.authorDisplayName === nextProps.item.authorDisplayName &&
  prevProps.item.authorPhotoURLSnapshot === nextProps.item.authorPhotoURLSnapshot &&
  prevProps.isActive === nextProps.isActive &&
  prevProps.pageOffset === nextProps.pageOffset &&
  prevProps.snapHeight === nextProps.snapHeight &&
  prevProps.scrollOffsetY === nextProps.scrollOffsetY
));

interface NotesFeedProps {
  flatListRef: RefObject<any>;
  captureHeader: ReactElement;
  emptyState?: ReactElement | null;
  captureMode: 'text' | 'camera';
  screenActive?: boolean;
  items?: HomeFeedItem[];
  notes?: Note[];
  sharedPosts?: SharedPost[];
  ownedSharedNoteIds?: string[];
  refreshing: boolean;
  onRefresh: () => void;
  onEndReached?: () => void;
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
  onCaptureScrollSettledChange?: (settled: boolean) => void;
  capturePageLocked?: boolean;
  scrollEnabled?: boolean;
  onSettledArchiveItemChange?: (item: { id: string; kind: 'note' | 'shared-post' } | null) => void;
  onScrollOffsetChange?: (offsetY: number) => void;
  onInitialContentDraw?: () => void;
}

export default function NotesFeed({
  flatListRef,
  captureHeader,
  emptyState = null,
  captureMode,
  screenActive = true,
  items,
  notes = [],
  sharedPosts = [],
  ownedSharedNoteIds = [],
  refreshing,
  onRefresh,
  onEndReached,
  topInset,
  snapHeight,
  onOpenNote,
  onOpenSharedPost,
  colors,
  t,
  onCaptureVisibilityChange,
  onCaptureScrollSettledChange,
  capturePageLocked = false,
  scrollEnabled = true,
  onSettledArchiveItemChange,
  onScrollOffsetChange,
  onInitialContentDraw,
}: NotesFeedProps) {
  const { height } = useWindowDimensions();
  const captureVisibilityRef = useRef(true);
  const captureScrollSettledRef = useRef(true);
  const refreshGestureActiveRef = useRef(false);
  const settledOffsetYRef = useRef(0);
  const liveOffsetYRef = useRef(0);
  const settledPageIndexRef = useRef(0);
  const dragStartPageIndexRef = useRef(0);
  const previousItemKeysRef = useRef<string[] | null>(null);
  const scrollOffsetY = useSharedValue(0);
  const [activeCardKey, setActiveCardKey] = useState<string | null>(null);
  const [refreshGestureActive, setRefreshGestureActive] = useState(false);
  const ownedSharedNoteIdSet = useMemo(
    () => new Set(ownedSharedNoteIds),
    [ownedSharedNoteIds]
  );
  const listData = useMemo<HomeFeedItem[]>(
    () => items ?? buildHomeFeedItems(notes, sharedPosts),
    [items, notes, sharedPosts]
  );
  const hasEmptyStatePage = listData.length === 0 && Boolean(emptyState);
  const snapPageCount = hasEmptyStatePage ? 1 : listData.length;
  const itemKeys = useMemo(
    () => listData.map(getHomeFeedItemKey),
    [listData]
  );
  const refreshSpinnerOffset = topInset + Layout.headerHeight + Layout.floatingGap;
  const pageBottomInset = topInset + HOME_PAGE_VISUAL_BOTTOM_INSET;
  const snapSuspended = refreshGestureActive;
  const drawDistance = Math.max(snapHeight * 2, height * 1.15);
  const listHeaderStyle = useMemo(
    () => ({
      height: snapHeight,
    }),
    [snapHeight]
  );
  const nativeSnapEnabled = !snapSuspended;
  const getItemType = useCallback(
    (item: HomeFeedItem) =>
      item.kind === 'note' ? `note:${item.note.type}` : `shared-post:${item.post.type}`,
    []
  );
  const overrideItemLayout = useCallback(
    (layout: { span?: number; size?: number }) => {
      layout.size = snapHeight;
    },
    [snapHeight]
  );

  const updateRefreshGestureActive = useCallback((nextActive: boolean) => {
    if (refreshGestureActiveRef.current === nextActive) {
      return;
    }

    refreshGestureActiveRef.current = nextActive;
    setRefreshGestureActive(nextActive);
  }, []);

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

  const reportCaptureScrollSettled = useCallback(
    (nextSettled: boolean) => {
      if (captureScrollSettledRef.current === nextSettled) {
        return;
      }

      captureScrollSettledRef.current = nextSettled;
      onCaptureScrollSettledChange?.(nextSettled);
    },
    [onCaptureScrollSettledChange]
  );

  useEffect(() => {
    captureVisibilityRef.current = true;
    onCaptureVisibilityChange?.(true);
    captureScrollSettledRef.current = true;
    onCaptureScrollSettledChange?.(true);
  }, [onCaptureScrollSettledChange, onCaptureVisibilityChange]);

  useEffect(() => {
    if (settledOffsetYRef.current >= 0) {
      updateRefreshGestureActive(false);
    }
  }, [refreshing, updateRefreshGestureActive]);

  const getNearestSnapPageIndex = useCallback(
    (offsetY: number) => {
      if (snapHeight <= 0) {
        return 0;
      }

      return Math.min(
        snapPageCount,
        Math.max(0, Math.round(offsetY / snapHeight))
      );
    },
    [snapHeight, snapPageCount]
  );

  const getNearestSnapOffset = useCallback(
    (offsetY: number) => {
      return getNearestSnapPageIndex(offsetY) * snapHeight;
    },
    [getNearestSnapPageIndex, snapHeight]
  );

  const getSettledItemFromOffset = useCallback(
    (offsetY: number) => {
      const settledPageIndex =
        Platform.OS === 'android'
          ? getNearestSnapPageIndex(offsetY)
          : Math.max(0, Math.round(Math.max(0, offsetY) / snapHeight));
      const rawIndex = settledPageIndex - 1;
      return rawIndex >= 0 ? listData[rawIndex] ?? null : null;
    },
    [getNearestSnapPageIndex, listData, snapHeight]
  );

  const reportActiveCard = useCallback(
    (offsetY: number) => {
      const nextItem = getSettledItemFromOffset(offsetY);
      setActiveCardKey(nextItem ? `${nextItem.kind}:${nextItem.id}` : null);
    },
    [getSettledItemFromOffset]
  );

  const reportSettledArchiveItem = useCallback(
    (offsetY: number) => {
      const nextItem = getSettledItemFromOffset(offsetY);

      onSettledArchiveItemChange?.(
        nextItem
          ? {
              id: nextItem.id,
              kind: nextItem.kind,
            }
          : null
      );
    },
    [getSettledItemFromOffset, onSettledArchiveItemChange]
  );

  const applySettledOffset = useCallback(
    (offsetY: number) => {
      const normalizedOffset = Math.max(0, offsetY);
      const settledPageIndex = getNearestSnapPageIndex(normalizedOffset);
      liveOffsetYRef.current = normalizedOffset;
      settledOffsetYRef.current = normalizedOffset;
      settledPageIndexRef.current = settledPageIndex;
      dragStartPageIndexRef.current = settledPageIndex;
      scrollOffsetY.value = normalizedOffset;
      reportCaptureVisibility(normalizedOffset);
      reportCaptureScrollSettled(true);
      reportActiveCard(normalizedOffset);
      reportSettledArchiveItem(normalizedOffset);

      if (!refreshing) {
        updateRefreshGestureActive(false);
      }
    },
    [
      refreshing,
      reportActiveCard,
      reportCaptureVisibility,
      reportCaptureScrollSettled,
      reportSettledArchiveItem,
      getNearestSnapPageIndex,
      scrollOffsetY,
      updateRefreshGestureActive,
    ]
  );

  const maybeCorrectSnapOffset = useCallback(
    (
      offsetY: number,
      { animated }: { animated: boolean }
    ) => {
      if (Platform.OS !== 'android') {
        return false;
      }

      const nearestSnapOffset = getNearestSnapOffset(offsetY);
      if (Math.abs(nearestSnapOffset - offsetY) < SCROLL_SNAP_EPSILON) {
        return false;
      }

      flatListRef.current?.scrollToOffset({ offset: nearestSnapOffset, animated });
      applySettledOffset(nearestSnapOffset);
      return true;
    },
    [applySettledOffset, flatListRef, getNearestSnapOffset]
  );

  const pinCapturePageToTop = useCallback(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    applySettledOffset(0);
  }, [applySettledOffset, flatListRef]);

  const maybeStickToCapturePage = useCallback(
    (offsetY: number, velocityY: number) => {
      if (dragStartPageIndexRef.current !== 0) {
        return false;
      }

      if (offsetY <= 0 || offsetY >= snapHeight) {
        return false;
      }

      if (offsetY >= snapHeight * CAPTURE_PAGE_STICKY_THRESHOLD) {
        return false;
      }

      if (Math.abs(velocityY) >= CAPTURE_PAGE_STICKY_VELOCITY_THRESHOLD) {
        return false;
      }

      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      applySettledOffset(0);
      return true;
    },
    [applySettledOffset, flatListRef, snapHeight]
  );

  useLayoutEffect(() => {
    if (Platform.OS !== 'android') {
      previousItemKeysRef.current = itemKeys;
      return;
    }

    if (capturePageLocked) {
      previousItemKeysRef.current = itemKeys;
      return;
    }

    const previousItemKeys = previousItemKeysRef.current;
    previousItemKeysRef.current = itemKeys;

    if (!previousItemKeys) {
      return;
    }

    if (itemKeys.length >= previousItemKeys.length) {
      return;
    }

    const nextItemKeySet = new Set(itemKeys);
    const removedItemCount = previousItemKeys.filter((key) => !nextItemKeySet.has(key)).length;
    if (removedItemCount === 0) {
      return;
    }

    maybeCorrectSnapOffset(liveOffsetYRef.current, { animated: false });
  }, [
    itemKeys,
    capturePageLocked,
    maybeCorrectSnapOffset,
  ]);

  useLayoutEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    if (capturePageLocked) {
      return;
    }

    maybeCorrectSnapOffset(liveOffsetYRef.current, { animated: false });
  }, [
    capturePageLocked,
    maybeCorrectSnapOffset,
  ]);

  useEffect(() => {
    if (!capturePageLocked) {
      return;
    }

    pinCapturePageToTop();
  }, [capturePageLocked, pinCapturePageToTop]);

  const renderItem = useCallback(
    ({ item, index }: { item: HomeFeedItem; index: number }) => {
      const isActive = screenActive && activeCardKey === getHomeFeedItemKey(item);

      if (item.kind === 'shared-post') {
        return (
          <View
            style={[
              styles.snapItem,
              {
                height: snapHeight,
                paddingTop: topInset + Layout.headerHeight - DOCKED_HEADER_CONTENT_OVERLAP,
                paddingBottom: pageBottomInset,
              },
            ]}
          >
            <View style={styles.cardStage}>
              <AnimatedSharedPostCard
                item={item.post}
                index={index}
                onOpenSharedPost={onOpenSharedPost}
                colors={colors}
                t={t}
                isActive={isActive}
                pageOffset={(index + 1) * snapHeight}
                scrollOffsetY={scrollOffsetY}
                snapHeight={snapHeight}
              />
            </View>
          </View>
        );
      }

      return (
        <View
          style={[
            styles.snapItem,
            {
              height: snapHeight,
              paddingTop: topInset + Layout.headerHeight - DOCKED_HEADER_CONTENT_OVERLAP,
              paddingBottom: pageBottomInset,
            },
          ]}
        >
          <View style={styles.cardStage}>
            <AnimatedNoteCard
              item={item.note}
              index={index}
              onOpenNote={onOpenNote}
              colors={colors}
              t={t}
              isActive={isActive}
              isSharedByMe={ownedSharedNoteIdSet.has(item.note.id)}
            />
          </View>
        </View>
      );
    },
    [
      activeCardKey,
      colors,
      onOpenNote,
      onOpenSharedPost,
      ownedSharedNoteIdSet,
      screenActive,
      snapHeight,
      scrollOffsetY,
      t,
      topInset,
      pageBottomInset,
    ]
  );

  return (
    <FlashList
      ref={flatListRef}
      data={listData}
      keyExtractor={getHomeFeedItemKey}
      renderItem={renderItem}
      extraData={activeCardKey}
      getItemType={getItemType}
      overrideItemLayout={overrideItemLayout as any}
      drawDistance={drawDistance}
      removeClippedSubviews={Platform.OS === 'android' && captureMode !== 'camera'}
      pagingEnabled={nativeSnapEnabled}
      decelerationRate={snapSuspended ? 'normal' : 'fast'}
      // This feed already manages its own anchor + snap corrections. Letting
      // FlashList auto-maintain visible content position can cause double-adjusts.
      maintainVisibleContentPosition={{ disabled: true }}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      automaticallyAdjustsScrollIndicatorInsets={false}
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      ListHeaderComponent={captureHeader}
      ListHeaderComponentStyle={listHeaderStyle}
      ListEmptyComponent={
        emptyState ? (
          <View
            style={[
              styles.snapItem,
              {
                height: snapHeight,
                paddingTop: topInset + Layout.headerHeight - DOCKED_HEADER_CONTENT_OVERLAP,
                paddingBottom: pageBottomInset,
              },
            ]}
          >
            <View style={styles.cardStage}>{emptyState}</View>
          </View>
        ) : null
      }
      onLoad={() => {
        if (listData.length > 0) {
          onInitialContentDraw?.();
        }
      }}
      onScroll={(event) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        const previousSettledOffsetY = settledOffsetYRef.current;
        liveOffsetYRef.current = Math.max(0, offsetY);
        scrollOffsetY.value = offsetY;
        updateRefreshGestureActive(offsetY < REFRESH_PULL_THRESHOLD);
        if (Math.abs(offsetY - previousSettledOffsetY) > SCROLL_SNAP_EPSILON) {
          reportCaptureScrollSettled(false);
        }
        reportCaptureVisibility(offsetY);
        onScrollOffsetChange?.(offsetY);
      }}
      scrollEventThrottle={16}
      onScrollBeginDrag={() => {
        dragStartPageIndexRef.current = settledPageIndexRef.current;
        setActiveCardKey(null);
      }}
      onScrollEndDrag={(event) => {
        if (capturePageLocked) {
          pinCapturePageToTop();
          return;
        }

        const offsetY = event.nativeEvent.contentOffset.y;
        if (offsetY <= 0) {
          applySettledOffset(0);
          return;
        }

        const velocityY = event.nativeEvent.velocity?.y ?? 0;
        if (maybeStickToCapturePage(offsetY, velocityY)) {
          return;
        }

        if (!nativeSnapEnabled) {
          applySettledOffset(offsetY);
        }
      }}
      onMomentumScrollBegin={() => {
        setActiveCardKey(null);
        reportCaptureScrollSettled(false);
      }}
      onMomentumScrollEnd={(event) => {
        if (capturePageLocked) {
          pinCapturePageToTop();
          return;
        }

        const offsetY = event.nativeEvent.contentOffset.y;
        if (offsetY <= 0) {
          applySettledOffset(0);
          return;
        }

        applySettledOffset(offsetY);
      }}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.35}
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
    width: '100%',
    justifyContent: 'flex-start',
  },
  cardStage: {
    flex: 1,
    justifyContent: 'center',
  },
});

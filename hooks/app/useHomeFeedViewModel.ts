import { useEffect, useMemo, useRef } from 'react';
import { buildHomeFeedItems, type HomeFeedItem } from '../../components/home/feedItems';
import type { Note } from '../../services/database';
import type { SharedPost } from '../../services/sharedFeedService';

type HomeSyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export type HomeFeedMode =
  | 'content'
  | 'syncing-empty'
  | 'friends-empty'
  | 'first-note-empty';

interface UseHomeFeedViewModelParams {
  userUid: string | null | undefined;
  notes: Note[];
  notesLoading: boolean;
  notesInitialLoadComplete: boolean;
  sharedEnabled: boolean;
  sharedReady: boolean;
  sharedPosts: SharedPost[];
  isInitialSyncPending: boolean;
  syncStatus: HomeSyncStatus;
  isFriendsFilterEnabled: boolean;
  suppressedHomeNoteIds: string[];
  savedNoteRevealNoteId?: string | null;
  markHomeFeedReady: () => void;
  resetHomeFeedReady: () => void;
}

interface UseHomeFeedViewModelResult {
  feedMode: HomeFeedMode;
  homeFeedItemsCount: number;
  visibleFeedItems: HomeFeedItem[];
  ownedSharedNoteIds: string[];
  savedNoteRevealIsSharedByMe: boolean;
  isFriendsFilterActive: boolean;
}

export function useHomeFeedViewModel({
  userUid,
  notes,
  notesLoading,
  notesInitialLoadComplete,
  sharedEnabled,
  sharedReady,
  sharedPosts,
  isInitialSyncPending,
  syncStatus,
  isFriendsFilterEnabled,
  suppressedHomeNoteIds,
  savedNoteRevealNoteId = null,
  markHomeFeedReady,
  resetHomeFeedReady,
}: UseHomeFeedViewModelParams): UseHomeFeedViewModelResult {
  const currentUserUid = userUid ?? null;
  const previousUserUidRef = useRef<string | null>(currentUserUid);

  const friendPosts = useMemo(
    () => sharedPosts.filter((post) => post.authorUid !== currentUserUid),
    [currentUserUid, sharedPosts]
  );
  const sharedPostsForHomeFeed = useMemo(
    () => (sharedEnabled ? friendPosts : sharedPosts),
    [friendPosts, sharedEnabled, sharedPosts]
  );
  const homeFeedItems = useMemo(
    () => buildHomeFeedItems(notes, sharedPostsForHomeFeed),
    [notes, sharedPostsForHomeFeed]
  );
  const isFriendsFilterActive = isFriendsFilterEnabled;
  const suppressedHomeNoteIdSet = useMemo(
    () => new Set(suppressedHomeNoteIds),
    [suppressedHomeNoteIds]
  );
  const visibleFeedItems = useMemo(() => {
    if (isFriendsFilterActive) {
      return homeFeedItems.filter((item) => item.kind === 'shared-post');
    }

    return homeFeedItems.filter((item) => (
      item.kind !== 'note' || !suppressedHomeNoteIdSet.has(item.id)
    ));
  }, [homeFeedItems, isFriendsFilterActive, suppressedHomeNoteIdSet]);
  const ownedSharedNoteIds = useMemo(
    () => (
      currentUserUid
        ? Array.from(
            new Set(
              sharedPosts
                .filter(
                  (post) =>
                    post.authorUid === currentUserUid &&
                    typeof post.sourceNoteId === 'string' &&
                    post.sourceNoteId.trim().length > 0
                )
                .map((post) => post.sourceNoteId as string)
            )
          )
        : []
    ),
    [currentUserUid, sharedPosts]
  );
  const savedNoteRevealIsSharedByMe = useMemo(
    () => Boolean(savedNoteRevealNoteId && ownedSharedNoteIds.includes(savedNoteRevealNoteId)),
    [ownedSharedNoteIds, savedNoteRevealNoteId]
  );

  const authUserChanged = previousUserUidRef.current !== currentUserUid;
  const shouldHoldSignedInEmptyState =
    Boolean(currentUserUid) &&
    (
      authUserChanged ||
      !notesInitialLoadComplete ||
      !sharedReady ||
      (isInitialSyncPending && syncStatus === 'syncing')
    );
  const isPostLoginSyncingEmpty =
    Boolean(currentUserUid) &&
    notes.length === 0 &&
    sharedPosts.length === 0 &&
    shouldHoldSignedInEmptyState;
  const hasStableHomeFeedContent = homeFeedItems.length > 0;
  const hasStableFriendFeedContent = friendPosts.length > 0;

  const feedMode: HomeFeedMode = useMemo(() => {
    if (isPostLoginSyncingEmpty) {
      return 'syncing-empty';
    }

    if (isFriendsFilterActive && !hasStableFriendFeedContent) {
      return 'friends-empty';
    }

    if (
      !isFriendsFilterActive &&
      !hasStableHomeFeedContent &&
      !authUserChanged &&
      notesInitialLoadComplete &&
      !notesLoading &&
      (!currentUserUid || sharedReady)
    ) {
      return 'first-note-empty';
    }

    return 'content';
  }, [
    authUserChanged,
    currentUserUid,
    hasStableFriendFeedContent,
    hasStableHomeFeedContent,
    isFriendsFilterActive,
    isPostLoginSyncingEmpty,
    notesInitialLoadComplete,
    notesLoading,
    sharedReady,
  ]);

  useEffect(() => {
    previousUserUidRef.current = currentUserUid;
  }, [currentUserUid]);

  useEffect(() => {
    if (!notesInitialLoadComplete) {
      resetHomeFeedReady();
      return;
    }

    if (visibleFeedItems.length === 0) {
      markHomeFeedReady();
    }
  }, [
    markHomeFeedReady,
    notesInitialLoadComplete,
    resetHomeFeedReady,
    visibleFeedItems.length,
  ]);

  return {
    feedMode,
    homeFeedItemsCount: homeFeedItems.length,
    visibleFeedItems,
    ownedSharedNoteIds,
    savedNoteRevealIsSharedByMe,
    isFriendsFilterActive,
  };
}

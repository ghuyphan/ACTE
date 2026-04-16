import { useEffect, useMemo, useRef } from 'react';
import { buildHomeFeedItems, type HomeFeedItem } from '../../components/home/feedItems';
import type { Note } from '../../services/database';
import type { SharedPost } from '../../services/sharedFeedService';
import type { NotesLoadPhase } from '../state/useNotesStore';
import type { SharedFeedLoadPhase } from '../useSharedFeedStore';
import type { SyncBootstrapState } from '../useSyncStatus';

export type HomeFeedMode =
  | 'content'
  | 'syncing-empty'
  | 'bootstrap-blocked-empty'
  | 'friends-empty'
  | 'first-note-empty';

export type HomeFeedBootstrapState =
  | 'idle'
  | 'switching-account'
  | 'loading-notes'
  | 'loading-shared'
  | 'syncing'
  | 'disabled'
  | 'offline'
  | 'error';

interface UseHomeFeedViewModelParams {
  userUid: string | null | undefined;
  notes: Note[];
  notesPhase: NotesLoadPhase;
  sharedEnabled: boolean;
  sharedPhase: SharedFeedLoadPhase;
  sharedPosts: SharedPost[];
  syncBootstrapState: SyncBootstrapState;
  isFriendsFilterEnabled: boolean;
  suppressedHomeNoteIds: string[];
  savedNoteRevealNoteId?: string | null;
  markHomeFeedReady: () => void;
  resetHomeFeedReady: () => void;
}

interface UseHomeFeedViewModelResult {
  feedMode: HomeFeedMode;
  isFeedBootstrapPending: boolean;
  bootstrapState: HomeFeedBootstrapState;
  homeFeedItemsCount: number;
  visibleFeedItems: HomeFeedItem[];
  ownedSharedNoteIds: string[];
  savedNoteRevealIsSharedByMe: boolean;
  isFriendsFilterActive: boolean;
}

export function useHomeFeedViewModel({
  userUid,
  notes,
  notesPhase,
  sharedEnabled,
  sharedPhase,
  sharedPosts,
  syncBootstrapState,
  isFriendsFilterEnabled,
  suppressedHomeNoteIds,
  savedNoteRevealNoteId = null,
  markHomeFeedReady,
  resetHomeFeedReady,
}: UseHomeFeedViewModelParams): UseHomeFeedViewModelResult {
  const currentUserUid = userUid ?? null;
  const previousUserUidRef = useRef<string | null>(currentUserUid);
  const previousDebugSnapshotRef = useRef<string | null>(null);
  const notesInitialLoadComplete = notesPhase !== 'bootstrapping';
  const notesLoading = notesPhase === 'bootstrapping' || notesPhase === 'hydrating';
  const sharedInitialLoadComplete =
    sharedPhase === 'ready' || sharedPhase === 'refreshing';

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
  const hasNoSignedInContent =
    Boolean(currentUserUid) &&
    notes.length === 0 &&
    sharedPosts.length === 0;
  const bootstrapState: HomeFeedBootstrapState = useMemo(() => {
    if (!hasNoSignedInContent) {
      return 'idle';
    }

    if (authUserChanged) {
      return 'switching-account';
    }

    if (!notesInitialLoadComplete || notesLoading) {
      return 'loading-notes';
    }

    if (!sharedInitialLoadComplete) {
      return 'loading-shared';
    }

    switch (syncBootstrapState) {
      case 'preparing':
      case 'syncing':
        return 'syncing';
      case 'disabled':
        return 'disabled';
      case 'offline':
        return 'offline';
      case 'error':
        return 'error';
      default:
        return 'idle';
    }
  }, [
    authUserChanged,
    hasNoSignedInContent,
    notesInitialLoadComplete,
    notesLoading,
    sharedInitialLoadComplete,
    syncBootstrapState,
  ]);
  const isPostLoginSyncingEmpty =
    bootstrapState === 'switching-account' ||
    bootstrapState === 'loading-notes' ||
    bootstrapState === 'loading-shared' ||
    bootstrapState === 'syncing';
  const isPostLoginBootstrapBlocked =
    bootstrapState === 'disabled' ||
    bootstrapState === 'offline' ||
    bootstrapState === 'error';
  const hasStableHomeFeedContent = homeFeedItems.length > 0;
  const hasVisibleHomeFeedContent = visibleFeedItems.length > 0;
  const hasStableFriendFeedContent = friendPosts.length > 0;
  const isSuppressedBySavedRevealOnly =
    !isFriendsFilterActive &&
    !hasVisibleHomeFeedContent &&
    hasStableHomeFeedContent &&
    Boolean(savedNoteRevealNoteId);

  const feedMode: HomeFeedMode = useMemo(() => {
    if (isPostLoginSyncingEmpty) {
      return 'syncing-empty';
    }

    if (isPostLoginBootstrapBlocked) {
      return 'bootstrap-blocked-empty';
    }

    if (isFriendsFilterActive && !hasStableFriendFeedContent) {
      return 'friends-empty';
    }

    if (
      !isFriendsFilterActive &&
      !hasVisibleHomeFeedContent &&
      !isSuppressedBySavedRevealOnly &&
      !authUserChanged &&
      notesInitialLoadComplete &&
      !notesLoading &&
      (!currentUserUid || sharedInitialLoadComplete)
    ) {
      return 'first-note-empty';
    }

    return 'content';
  }, [
    authUserChanged,
    currentUserUid,
    hasStableFriendFeedContent,
    hasVisibleHomeFeedContent,
    isFriendsFilterActive,
    isPostLoginBootstrapBlocked,
    isPostLoginSyncingEmpty,
    isSuppressedBySavedRevealOnly,
    notesInitialLoadComplete,
    notesLoading,
    sharedInitialLoadComplete,
  ]);

  useEffect(() => {
    previousUserUidRef.current = currentUserUid;
  }, [currentUserUid]);

  useEffect(() => {
    if (!__DEV__) {
      return;
    }

    const snapshot = JSON.stringify({
      currentUserUid,
      notesPhase,
      sharedPhase,
      syncBootstrapState,
      notesCount: notes.length,
      sharedPostsCount: sharedPosts.length,
      homeFeedItemsCount: homeFeedItems.length,
      visibleFeedItemsCount: visibleFeedItems.length,
      bootstrapState,
      feedMode,
      hasNoSignedInContent,
      isFriendsFilterActive,
    });

    if (previousDebugSnapshotRef.current === snapshot) {
      return;
    }

    previousDebugSnapshotRef.current = snapshot;
    console.log('[homeFeed] state changed', JSON.parse(snapshot));
  }, [
    bootstrapState,
    currentUserUid,
    feedMode,
    hasNoSignedInContent,
    homeFeedItems.length,
    isFriendsFilterActive,
    notes.length,
    notesPhase,
    sharedPhase,
    sharedPosts.length,
    syncBootstrapState,
    visibleFeedItems.length,
  ]);

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
    isFeedBootstrapPending: isPostLoginSyncingEmpty,
    bootstrapState,
    homeFeedItemsCount: homeFeedItems.length,
    visibleFeedItems,
    ownedSharedNoteIds,
    savedNoteRevealIsSharedByMe,
    isFriendsFilterActive,
  };
}

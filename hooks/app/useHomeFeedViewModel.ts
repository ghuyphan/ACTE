import { useEffect, useMemo, useRef } from 'react';
import { buildHomeFeedItems, type HomeFeedItem } from '../../components/home/feedItems';
import type { Note } from '../../services/database';
import {
  getOwnedSharedNoteIdsFromPosts,
  normalizeOwnedSharedNoteIds,
} from '../../services/sharedFeedOwnership';
import type { SharedPost } from '../../services/sharedFeedService';
import type { NotesLoadPhase } from '../state/useNotesStore';
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
  | 'syncing'
  | 'disabled'
  | 'offline'
  | 'error';

interface UseHomeFeedViewModelParams {
  userUid: string | null | undefined;
  notes: Note[];
  notesPhase: NotesLoadPhase;
  sharedEnabled: boolean;
  sharedLoading: boolean;
  sharedInitialLoadComplete: boolean;
  sharedPosts: SharedPost[];
  ownedSharedNoteIds?: string[];
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
  sharedLoading,
  sharedInitialLoadComplete,
  sharedPosts,
  ownedSharedNoteIds: ownedSharedNoteIdsInput,
  syncBootstrapState,
  isFriendsFilterEnabled,
  suppressedHomeNoteIds,
  savedNoteRevealNoteId = null,
  markHomeFeedReady,
  resetHomeFeedReady,
}: UseHomeFeedViewModelParams): UseHomeFeedViewModelResult {
  const currentUserUid = userUid ?? null;
  const previousUserUidRef = useRef<string | null>(currentUserUid);
  const hasLoadedNotes = notes.length > 0;
  const hasLoadedSharedPosts = sharedPosts.length > 0;
  const hasAnyLoadedFeedContent = hasLoadedNotes || hasLoadedSharedPosts;
  const notesLoading =
    notesPhase === 'bootstrapping' || (notesPhase === 'hydrating' && !hasLoadedNotes);

  const friendPosts = useMemo(
    () => sharedPosts.filter((post) => post.authorUid !== currentUserUid),
    [currentUserUid, sharedPosts]
  );
  const authUserChanged =
    previousUserUidRef.current !== null &&
    currentUserUid !== null &&
    previousUserUidRef.current !== currentUserUid;
  const effectiveFriendPosts = authUserChanged ? [] : friendPosts;
  const sharedPostsForHomeFeed = useMemo(
    () => (sharedEnabled ? effectiveFriendPosts : authUserChanged ? [] : sharedPosts),
    [authUserChanged, effectiveFriendPosts, sharedEnabled, sharedPosts]
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
    if (authUserChanged) {
      return [];
    }

    if (isFriendsFilterActive) {
      return homeFeedItems.filter((item) => item.kind === 'shared-post');
    }

    return homeFeedItems.filter((item) => (
      item.kind !== 'note' || !suppressedHomeNoteIdSet.has(item.id)
    ));
  }, [authUserChanged, homeFeedItems, isFriendsFilterActive, suppressedHomeNoteIdSet]);
  const ownedSharedNoteIds = useMemo(() => {
    if (authUserChanged || !currentUserUid) {
      return [];
    }

    const derivedOwnedSharedNoteIds = getOwnedSharedNoteIdsFromPosts(sharedPosts, currentUserUid);
    return normalizeOwnedSharedNoteIds([
      ...(ownedSharedNoteIdsInput ?? []),
      ...derivedOwnedSharedNoteIds,
    ]);
  }, [authUserChanged, currentUserUid, ownedSharedNoteIdsInput, sharedPosts]);
  const savedNoteRevealIsSharedByMe = useMemo(
    () => Boolean(savedNoteRevealNoteId && ownedSharedNoteIds.includes(savedNoteRevealNoteId)),
    [ownedSharedNoteIds, savedNoteRevealNoteId]
  );

  const hasNoSignedInContent = Boolean(currentUserUid) && !hasAnyLoadedFeedContent;
  const isWaitingForFirstSharedSnapshot =
    hasNoSignedInContent && sharedEnabled && sharedLoading && !sharedInitialLoadComplete;
  const bootstrapState: HomeFeedBootstrapState = useMemo(() => {
    if (authUserChanged) {
      return 'switching-account';
    }

    if (hasNoSignedInContent && (
      syncBootstrapState === 'preparing' ||
      syncBootstrapState === 'syncing' ||
      isWaitingForFirstSharedSnapshot
    )) {
      return 'syncing';
    }

    if (notesLoading) {
      return 'loading-notes';
    }

    if (hasNoSignedInContent) {
      switch (syncBootstrapState) {
        case 'disabled':
          return 'disabled';
        case 'offline':
          return 'offline';
        case 'error':
          return 'error';
        default:
          return 'idle';
      }
    }

    return 'idle';
  }, [
    authUserChanged,
    hasNoSignedInContent,
    isWaitingForFirstSharedSnapshot,
    notesLoading,
    syncBootstrapState,
  ]);
  const isPostLoginSyncingEmpty =
    bootstrapState === 'switching-account' ||
    bootstrapState === 'loading-notes' ||
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
      !notesLoading
    ) {
      return 'first-note-empty';
    }

    return 'content';
  }, [
    authUserChanged,
    hasStableFriendFeedContent,
    hasVisibleHomeFeedContent,
    isFriendsFilterActive,
    isPostLoginBootstrapBlocked,
    isPostLoginSyncingEmpty,
    isSuppressedBySavedRevealOnly,
    notesLoading,
  ]);

  useEffect(() => {
    previousUserUidRef.current = currentUserUid;
  }, [currentUserUid]);

  useEffect(() => {
    if (notesLoading && visibleFeedItems.length === 0) {
      resetHomeFeedReady();
      return;
    }

    if (visibleFeedItems.length === 0 && feedMode !== 'content') {
      markHomeFeedReady();
    }
  }, [
    feedMode,
    markHomeFeedReady,
    notesLoading,
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

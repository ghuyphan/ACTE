import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AppState } from 'react-native';
import i18n from '../constants/i18n';
import { Note } from '../services/database';
import {
  addFriendByUsername as addFriendByUsernameRemote,
  acceptFriendInvite as acceptInvite,
  createFriendInvite as createInvite,
  createFriendGroup as createGroup,
  createSharedPost as createPost,
  createSharedPostResponse as createPostResponse,
  createSharedPostResponseReaction as createPostResponseReaction,
  deleteSharedPostResponseReaction as deletePostResponseReaction,
  deleteFriendGroup as removeGroup,
  deleteOwnedSharedPostsForNotes,
  deleteSharedPost as deletePost,
  findFriendByUsername as findFriendByUsernameRemote,
  FriendGroup,
  FriendSearchResult,
  findOwnedSharedPostIdsForNote,
  FriendConnection,
  FriendInvite,
  FriendPresenceSnapshot,
  getSharedPostResponsesPage as fetchPostResponsesPage,
  getSharedPostThreadSummaries as fetchPostThreadSummaries,
  getSharedFeedErrorMessage,
  invalidateSharedFeedRefresh,
  refreshSharedFeed as fetchSharedFeed,
  removeFriend as deleteFriend,
  revokeFriendInvite as revokeInvite,
  SharedPost,
  SharedPostResponse,
  SharedPostResponseReaction,
  SharedPostResponsesSubscriptionOptions,
  SharedPostTypingUser,
  SharedThreadSummary,
  subscribeToFriendPresence,
  subscribeToSharedFeed,
  subscribeToSharedPostResponses as subscribeToPostResponses,
  subscribeToSharedPostTyping as subscribeToPostTyping,
  updateFriendGroup as saveGroup,
  updateFriendNickname as saveFriendNickname,
  updateOwnPresenceLastSeen,
  updateSharedPost as updatePost,
} from '../services/sharedFeedService';
import {
  cacheSharedFeedSnapshot,
  clearSharedFeedCache,
  getCachedSharedPostResponses,
  getCachedSharedPostResponsesPage,
  getCachedSharedFeedSnapshot,
  getCachedSharedThreadReadStates,
  getCachedSharedThreadSummaries,
  deleteCachedSharedPostResponse,
  deleteCachedSharedPostResponseReactionById,
  deleteCachedSharedPostResponseReaction,
  markCachedSharedThreadRead,
  patchCachedSharedPostMedia,
  reconcileCachedSharedPostResponsesPage,
  replaceCachedSharedPostResponses,
  replaceCachedSharedThreadSummaries,
  upsertCachedSharedPostResponse,
  upsertCachedSharedPostResponseReaction,
  type SharedThreadReadState,
} from '../services/sharedFeedCache';
import { getNotePairedVideoUri } from '../services/livePhotoStorage';
import { subscribeToDeletedNotes } from '../services/noteMutationEvents';
import { normalizeSavedTextNoteColor } from '../services/noteAppearance';
import { formatNoteTextWithEmoji } from '../services/noteTextPresentation';
import { getNotePhotoUri } from '../services/photoStorage';
import {
  downloadPairedVideoFromStorage,
  downloadPhotoFromStorage,
  SHARED_POST_MEDIA_BUCKET,
} from '../services/remoteMedia';
import {
  shouldForceSharedFeedForegroundRefresh,
  shouldRefreshSharedFeedOnForeground,
} from '../services/sharedFeedRefreshPolicy';
import { rememberSharedPostResponses } from '../services/sharedPostResponseMemory';
import {
  getOwnedSharedNoteIdsFromPosts,
  normalizeOwnedSharedNoteIds,
} from '../services/sharedFeedOwnership';
import { scheduleWidgetDataUpdate } from '../services/widgetService';
import { useStartupInteraction } from './app/useHomeStartupReady';
import { useAuth } from './useAuth';
import { useConnectivity } from './useConnectivity';
import { logStartupEvent, traceStartupAsync } from '../utils/startupTrace';
import { applyFriendNicknamesToSharedPosts } from '../utils/sharedDisplayNames';
import type { AppUser } from '../utils/appUser';

export type SharedFeedLoadPhase = 'bootstrapping' | 'cache-ready' | 'ready' | 'refreshing';

interface SharedFeedStoreValue {
  enabled: boolean;
  phase: SharedFeedLoadPhase;
  loading: boolean;
  ready: boolean;
  initialLoadComplete: boolean;
  dataSource: 'live' | 'cache';
  lastUpdatedAt: string | null;
  friends: FriendConnection[];
  friendPresence: FriendPresenceSnapshot;
  friendGroups: FriendGroup[];
  sharedPosts: SharedPost[];
  ownedSharedNoteIds: string[];
  activeInvite: FriendInvite | null;
  refreshSharedFeed: () => Promise<void>;
  createFriendInvite: () => Promise<FriendInvite>;
  revokeFriendInvite: (inviteId: string) => Promise<void>;
  acceptFriendInvite: (inviteValue: string) => Promise<void>;
  findFriendByUsername: (username: string) => Promise<FriendSearchResult>;
  addFriendByUsername: (username: string) => Promise<void>;
  removeFriend: (friendUid: string) => Promise<void>;
  updateFriendNickname: (friendUid: string, nickname: string | null) => Promise<void>;
  createFriendGroup: (input: { name: string; memberUserIds: string[] }) => Promise<void>;
  updateFriendGroup: (groupId: string, input: { name: string; memberUserIds: string[] }) => Promise<void>;
  deleteFriendGroup: (groupId: string) => Promise<void>;
  createSharedPost: (note: Note, audienceUserIds?: string[]) => Promise<SharedPost>;
  getSharedPostResponses: (postId: string) => Promise<SharedPostResponse[]>;
  getSharedPostResponsesPage: (
    postId: string,
    options?: { limit?: number; beforeCreatedAt?: string | null }
  ) => Promise<SharedPostResponse[]>;
  getSharedPostThreadSummaries: (postIds: string[]) => Promise<SharedThreadSummary[]>;
  subscribeToSharedPostResponses: (
    postId: string,
    options: SharedPostResponsesSubscriptionOptions
  ) => () => void;
  subscribeToSharedPostTyping: (
    postId: string,
    options: {
      onTypingUsers: (users: SharedPostTypingUser[]) => void;
      onError?: (error: unknown) => void;
    }
  ) => {
    setTyping: (isTyping: boolean) => void;
    unsubscribe: () => void;
  };
  createSharedPostResponse: (
    postId: string,
    input: { emoji?: string | null; text?: string | null; replyToResponseId?: string | null }
  ) => Promise<SharedPostResponse>;
  createSharedPostResponseReaction: (
    postId: string,
    responseId: string,
    emoji: string
  ) => Promise<SharedPostResponseReaction>;
  deleteSharedPostResponseReaction: (
    postId: string,
    responseId: string
  ) => Promise<void>;
  getSharedThreadReadStates: () => Promise<SharedThreadReadState[]>;
  markSharedThreadRead: (
    postId: string,
    lastReadResponseId: string | null
  ) => Promise<SharedThreadReadState | null>;
  updateSharedNote: (note: Note) => Promise<void>;
  deleteSharedNote: (noteId: string) => Promise<void>;
  deleteSharedNotes: (noteIds: string[]) => Promise<void>;
  deleteSharedPostById: (postId: string) => Promise<void>;
}

const SharedFeedStoreContext = createContext<SharedFeedStoreValue | undefined>(undefined);
const INITIAL_SHARED_MEDIA_HYDRATION_LIMIT = 12;
const SHARED_MEDIA_HYDRATION_CONCURRENCY = 3;

type SharedFeedSnapshotState = {
  friends: FriendConnection[];
  friendGroups?: FriendGroup[];
  sharedPosts: SharedPost[];
  activeInvite: FriendInvite | null;
  ownedSharedNoteIds?: string[];
};

type SharedMediaPatch = {
  postId: string;
  photoLocalUri: string | null;
  dualPrimaryPhotoLocalUri: string | null;
  dualSecondaryPhotoLocalUri: string | null;
  pairedVideoLocalUri: string | null;
};

type SharedFeedLoadState = {
  loading: boolean;
  ready: boolean;
  initialLoadComplete: boolean;
  dataSource: 'live' | 'cache';
  lastUpdatedAt: string | null;
};

type SharedFeedLoadAction =
  | { type: 'snapshotCommitted'; source: 'live' | 'cache'; updatedAt: string | null }
  | { type: 'cacheHydrated'; hasCachedSnapshot: boolean; isOnline: boolean }
  | { type: 'refreshStarted' }
  | { type: 'ready' }
  | { type: 'resetForUser' };

const initialSharedFeedLoadState: SharedFeedLoadState = {
  dataSource: 'cache',
  initialLoadComplete: false,
  lastUpdatedAt: null,
  loading: false,
  ready: false,
};

function sharedFeedLoadReducer(
  state: SharedFeedLoadState,
  action: SharedFeedLoadAction
): SharedFeedLoadState {
  switch (action.type) {
    case 'snapshotCommitted':
      return {
        ...state,
        dataSource: action.source,
        lastUpdatedAt: action.updatedAt,
      };
    case 'cacheHydrated':
      return {
        ...state,
        loading: !action.hasCachedSnapshot && action.isOnline,
        ready: true,
        initialLoadComplete: action.hasCachedSnapshot || !action.isOnline,
      };
    case 'refreshStarted':
      return {
        ...state,
        loading: true,
      };
    case 'ready':
      return {
        ...state,
        loading: false,
        ready: true,
        initialLoadComplete: true,
      };
    case 'resetForUser':
      return initialSharedFeedLoadState;
  }
}

function sortFriendsByFriendedAt(friends: FriendConnection[]) {
  return [...friends].sort(
    (left, right) => new Date(left.friendedAt).getTime() - new Date(right.friendedAt).getTime()
  );
}

function upsertFriendConnection(
  friends: FriendConnection[],
  nextFriend: FriendConnection
) {
  return sortFriendsByFriendedAt([
    ...friends.filter((friend) => friend.userId !== nextFriend.userId),
    nextFriend,
  ]);
}

function addOwnedSharedNoteId(current: string[], noteId: string | null | undefined) {
  return normalizeOwnedSharedNoteIds([...current, noteId ?? null]);
}

function removeOwnedSharedNoteIds(current: string[], noteIds: string[]) {
  const noteIdSet = new Set(noteIds.map((noteId) => noteId.trim()).filter(Boolean));
  if (noteIdSet.size === 0) {
    return current;
  }

  return normalizeOwnedSharedNoteIds(current.filter((noteId) => !noteIdSet.has(noteId)));
}

function buildSharedMediaHydrationKey(
  sessionId: number,
  source: 'live' | 'cache',
  updatedAt: string | null,
  posts: SharedPost[]
) {
  return [
    sessionId,
    source,
    updatedAt ?? 'unknown',
    ...posts.map((post) => `${post.id}:${post.photoPath ?? ''}:${post.pairedVideoPath ?? ''}`),
  ].join('|');
}

function shouldHydrateSharedPostMedia(post: SharedPost) {
  if (post.type !== 'photo') {
    return false;
  }

  if (post.photoPath && !post.photoLocalUri) {
    return true;
  }

  if (
    post.captureVariant === 'dual' &&
    (
      (post.dualPrimaryPhotoPath && !post.dualPrimaryPhotoLocalUri) ||
      (post.dualSecondaryPhotoPath && !post.dualSecondaryPhotoLocalUri)
    )
  ) {
    return true;
  }

  return Boolean(post.isLivePhoto && post.pairedVideoPath && !post.pairedVideoLocalUri);
}

function getSharedMediaHydrationCandidates(posts: SharedPost[], limit?: number) {
  const candidates = posts.filter(shouldHydrateSharedPostMedia);
  return typeof limit === 'number' && Number.isFinite(limit)
    ? candidates.slice(0, Math.max(0, limit))
    : candidates;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
) {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex]);
      }
    })
  );

  return results;
}

function getSharedMediaPatches(
  previousPosts: SharedPost[],
  nextPosts: SharedPost[]
): SharedMediaPatch[] {
  const previousPostMap = new Map(previousPosts.map((post) => [post.id, post]));
  const patches: SharedMediaPatch[] = [];

  for (const nextPost of nextPosts) {
    const previousPost = previousPostMap.get(nextPost.id);
    if (!previousPost || nextPost.type !== 'photo') {
      continue;
    }

    const photoLocalUri = nextPost.photoLocalUri ?? null;
    const dualPrimaryPhotoLocalUri =
      nextPost.captureVariant === 'dual' ? nextPost.dualPrimaryPhotoLocalUri ?? null : null;
    const dualSecondaryPhotoLocalUri =
      nextPost.captureVariant === 'dual' ? nextPost.dualSecondaryPhotoLocalUri ?? null : null;
    const pairedVideoLocalUri = nextPost.pairedVideoLocalUri ?? null;

    if (
      photoLocalUri === (previousPost.photoLocalUri ?? null) &&
      dualPrimaryPhotoLocalUri === (previousPost.dualPrimaryPhotoLocalUri ?? null) &&
      dualSecondaryPhotoLocalUri === (previousPost.dualSecondaryPhotoLocalUri ?? null) &&
      pairedVideoLocalUri === (previousPost.pairedVideoLocalUri ?? null)
    ) {
      continue;
    }

    patches.push({
      postId: nextPost.id,
      photoLocalUri,
      dualPrimaryPhotoLocalUri,
      dualSecondaryPhotoLocalUri,
      pairedVideoLocalUri,
    });
  }

  return patches;
}

function useSharedFeedStoreValue(): SharedFeedStoreValue {
  const { user, isAuthAvailable, isReady } = useAuth();
  const { isOnline } = useConnectivity();
  const { startupInteractive } = useStartupInteraction();
  const [friends, setFriends] = useState<FriendConnection[]>([]);
  const [friendPresence, setFriendPresence] = useState<FriendPresenceSnapshot>({});
  const [friendGroups, setFriendGroups] = useState<FriendGroup[]>([]);
  const [sharedPosts, setSharedPosts] = useState<SharedPost[]>([]);
  const [ownedSharedNoteIds, setOwnedSharedNoteIds] = useState<string[]>([]);
  const [activeInvite, setActiveInvite] = useState<FriendInvite | null>(null);
  const [loadState, dispatchLoadState] = useReducer(
    sharedFeedLoadReducer,
    initialSharedFeedLoadState
  );
  const friendsRef = useRef<FriendConnection[]>([]);
  const friendGroupsRef = useRef<FriendGroup[]>([]);
  const sharedPostsRef = useRef<SharedPost[]>([]);
  const ownedSharedNoteIdsRef = useRef<string[]>([]);
  const activeInviteRef = useRef<FriendInvite | null>(null);
  const suppressedActiveInviteIdRef = useRef<string | null>(null);
  const createInvitePromiseRef = useRef<Promise<FriendInvite> | null>(null);
  const userRef = useRef(user);
  const previousUserUidRef = useRef<string | null>(null);
  const sharedFeedSessionRef = useRef(0);
  const refreshRequestIdRef = useRef(0);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const responsePageFetchesRef = useRef<Map<string, Promise<SharedPostResponse[]>>>(new Map());
  const pendingForcedRefreshRef = useRef(false);
  const sharedFeedSubscriptionHealthyRef = useRef(true);
  const sharedMediaHydrationKeyRef = useRef<string | null>(null);
  const sharedMediaHydrationPromiseRef = useRef<Promise<void> | null>(null);
  const lastForegroundRefreshAtRef = useRef<number | null>(null);
  const liveSnapshotSessionRef = useRef<number | null>(null);

  const isCurrentSharedFeedSession = useCallback(
    (sessionId: number, userUid: string) =>
      sharedFeedSessionRef.current === sessionId && previousUserUidRef.current === userUid,
    []
  );

  const enabled = isAuthAvailable;
  userRef.current = user;
  const {
    loading,
    ready,
    initialLoadComplete,
    dataSource,
    lastUpdatedAt,
  } = loadState;
  const phase: SharedFeedLoadPhase = !ready
    ? 'bootstrapping'
    : loading
      ? 'refreshing'
      : dataSource === 'cache'
        ? 'cache-ready'
        : 'ready';

  const commitSnapshot = useCallback(
    (
      snapshot: {
        friends: FriendConnection[];
        friendGroups?: FriendGroup[];
        sharedPosts: SharedPost[];
        activeInvite: FriendInvite | null;
        ownedSharedNoteIds?: string[];
      },
      source: 'live' | 'cache',
      updatedAt: string | null
    ) => {
      const derivedOwnedSharedNoteIds = getOwnedSharedNoteIdsFromPosts(
        snapshot.sharedPosts,
        previousUserUidRef.current
      );
      const nextOwnedSharedNoteIds =
        snapshot.ownedSharedNoteIds
          ? normalizeOwnedSharedNoteIds([
              ...snapshot.ownedSharedNoteIds,
              ...derivedOwnedSharedNoteIds,
            ])
          : derivedOwnedSharedNoteIds;

      const nextFriendGroups = snapshot.friendGroups ?? friendGroupsRef.current;
      friendsRef.current = snapshot.friends;
      friendGroupsRef.current = nextFriendGroups;
      sharedPostsRef.current = snapshot.sharedPosts;
      ownedSharedNoteIdsRef.current = nextOwnedSharedNoteIds;
      activeInviteRef.current = snapshot.activeInvite;
      setFriends(snapshot.friends);
      setFriendGroups(nextFriendGroups);
      setSharedPosts(snapshot.sharedPosts);
      setOwnedSharedNoteIds(nextOwnedSharedNoteIds);
      setActiveInvite(snapshot.activeInvite);
      dispatchLoadState({ type: 'snapshotCommitted', source, updatedAt });
    },
    []
  );

  const applySnapshot = useCallback(
    (
      snapshot: {
        friends: FriendConnection[];
        friendGroups?: FriendGroup[];
        sharedPosts: SharedPost[];
        activeInvite: FriendInvite | null;
        ownedSharedNoteIds?: string[];
      },
      source: 'live' | 'cache',
      updatedAt: string | null
    ) => {
      const incomingActiveInviteId = snapshot.activeInvite?.id ?? null;
      const suppressedActiveInviteId = suppressedActiveInviteIdRef.current;
      const shouldSuppressActiveInvite =
        Boolean(incomingActiveInviteId && suppressedActiveInviteId === incomingActiveInviteId);

      if (
        incomingActiveInviteId &&
        suppressedActiveInviteId &&
        suppressedActiveInviteId !== incomingActiveInviteId
      ) {
        suppressedActiveInviteIdRef.current = null;
      }

      commitSnapshot(
        {
          ...snapshot,
          activeInvite: shouldSuppressActiveInvite ? null : snapshot.activeInvite,
        },
        source,
        updatedAt
      );
    },
    [commitSnapshot]
  );

  const persistSnapshot = useCallback(
    async (
      userUid: string,
      snapshot?: {
        friends: FriendConnection[];
        sharedPosts: SharedPost[];
        activeInvite: FriendInvite | null;
        ownedSharedNoteIds?: string[];
      }
    ) => {
      const nextSnapshot = snapshot ?? {
        friends: friendsRef.current,
        friendGroups: friendGroupsRef.current,
        sharedPosts: sharedPostsRef.current,
        activeInvite: activeInviteRef.current,
        ownedSharedNoteIds: ownedSharedNoteIdsRef.current,
      };

      try {
        await cacheSharedFeedSnapshot(userUid, nextSnapshot);
      } catch (error) {
        console.warn('Failed to persist shared feed cache:', error);
      }
    },
    []
  );

  const scheduleSharedFeedWidgetRefresh = useCallback(() => {
    scheduleWidgetDataUpdate(
      {
        includeLocationLookup: false,
        includeSharedRefresh: false,
      },
      {
        debounceMs: 120,
        throttleKey: 'shared-feed',
        throttleMs: 1_000,
      }
    );
  }, []);

  const hydrateSharedMediaPosts = useCallback(
    async (
      posts: SharedPost[],
      options?: {
        cachedOnly?: boolean;
        limit?: number;
      }
    ) => {
      const candidates = getSharedMediaHydrationCandidates(posts, options?.limit);
      if (candidates.length === 0) {
        return posts;
      }

      const downloadOptions =
        options?.cachedOnly || !isOnline
          ? { preferCachedOnly: true }
          : undefined;
      const downloadSharedPhoto = (
        path: string | null | undefined,
        localId: string
      ) =>
        downloadOptions
          ? downloadPhotoFromStorage(
              SHARED_POST_MEDIA_BUCKET,
              path,
              localId,
              downloadOptions
            )
          : downloadPhotoFromStorage(SHARED_POST_MEDIA_BUCKET, path, localId);
      const downloadSharedPairedVideo = (
        path: string | null | undefined,
        localId: string
      ) =>
        downloadOptions
          ? downloadPairedVideoFromStorage(
              SHARED_POST_MEDIA_BUCKET,
              path,
              localId,
              downloadOptions
            )
          : downloadPairedVideoFromStorage(SHARED_POST_MEDIA_BUCKET, path, localId);

      const hydratedCandidates = await mapWithConcurrency(
        candidates,
        SHARED_MEDIA_HYDRATION_CONCURRENCY,
        async (post) => {
          const nextPhotoLocalUri =
            post.photoLocalUri ??
            (post.photoPath
              ? await downloadSharedPhoto(post.photoPath, post.id).catch(() => null)
              : null);

          const nextDualPrimaryPhotoLocalUri =
            post.captureVariant === 'dual'
              ? post.dualPrimaryPhotoLocalUri ??
                (post.dualPrimaryPhotoPath
                  ? await downloadSharedPhoto(
                      post.dualPrimaryPhotoPath,
                      `shared-post-${post.id}-primary`
                    ).catch(() => null)
                  : null)
              : null;

          const nextDualSecondaryPhotoLocalUri =
            post.captureVariant === 'dual'
              ? post.dualSecondaryPhotoLocalUri ??
                (post.dualSecondaryPhotoPath
                  ? await downloadSharedPhoto(
                      post.dualSecondaryPhotoPath,
                      `shared-post-${post.id}-secondary`
                    ).catch(() => null)
                  : null)
              : null;

          const nextPairedVideoLocalUri =
            post.pairedVideoLocalUri ??
            (post.isLivePhoto && post.pairedVideoPath
              ? await downloadSharedPairedVideo(
                  post.pairedVideoPath,
                  `${post.id}-motion`
                ).catch(() => null)
              : null);

          if (
            nextPhotoLocalUri === (post.photoLocalUri ?? null) &&
            nextDualPrimaryPhotoLocalUri === (post.dualPrimaryPhotoLocalUri ?? null) &&
            nextDualSecondaryPhotoLocalUri === (post.dualSecondaryPhotoLocalUri ?? null) &&
            nextPairedVideoLocalUri === (post.pairedVideoLocalUri ?? null)
          ) {
            return post;
          }

          return {
            ...post,
            photoLocalUri: nextPhotoLocalUri,
            dualPrimaryPhotoLocalUri: nextDualPrimaryPhotoLocalUri,
            dualSecondaryPhotoLocalUri: nextDualSecondaryPhotoLocalUri,
            pairedVideoLocalUri: nextPairedVideoLocalUri,
          };
        }
      );

      const hydratedCandidateMap = new Map(
        hydratedCandidates.map((post) => [post.id, post])
      );
      return posts.map((post) => hydratedCandidateMap.get(post.id) ?? post);
    },
    [isOnline]
  );

  const hydrateSnapshotFromCachedMedia = useCallback(
    async (
      userUid: string,
      sessionId: number,
      source: 'live' | 'cache',
      snapshot: SharedFeedSnapshotState,
      limit = INITIAL_SHARED_MEDIA_HYDRATION_LIMIT
    ): Promise<SharedFeedSnapshotState> => {
      if (
        !isCurrentSharedFeedSession(sessionId, userUid) ||
        snapshot.sharedPosts.length === 0
      ) {
        return snapshot;
      }

      const sharedPosts = await traceStartupAsync(
        'shared-feed.cached-media-hydration',
        () =>
          hydrateSharedMediaPosts(snapshot.sharedPosts, {
            cachedOnly: true,
            limit,
          }),
        {
          limit,
          postCount: snapshot.sharedPosts.length,
          source,
          userUid,
        }
      );

      if (!isCurrentSharedFeedSession(sessionId, userUid)) {
        return snapshot;
      }

      const mediaPatches = getSharedMediaPatches(snapshot.sharedPosts, sharedPosts);
      if (mediaPatches.length > 0) {
        void patchCachedSharedPostMedia(userUid, mediaPatches).catch((error) => {
          console.warn('Failed to patch cached shared media before startup:', error);
        });
      }

      return {
        ...snapshot,
        sharedPosts,
      };
    },
    [hydrateSharedMediaPosts, isCurrentSharedFeedSession]
  );

  const hydrateSharedPostMedia = useCallback(
    async (
      userUid: string,
      sessionId: number,
      source: 'live' | 'cache',
      updatedAt: string | null,
      posts: SharedPost[]
    ) => {
      if (!isCurrentSharedFeedSession(sessionId, userUid) || posts.length === 0) {
        return;
      }

      const hydratedPosts = await hydrateSharedMediaPosts(posts);

      if (!isCurrentSharedFeedSession(sessionId, userUid)) {
        return;
      }

      const hydratedPostMap = new Map(hydratedPosts.map((post) => [post.id, post]));
      let didChange = false;
      const mediaPatches: SharedMediaPatch[] = [];

      const mergedSharedPosts = sharedPostsRef.current.map((post) => {
        const hydratedPost = hydratedPostMap.get(post.id);
        if (!hydratedPost) {
          return post;
        }

        const nextPhotoLocalUri = hydratedPost.photoLocalUri ?? post.photoLocalUri ?? null;
        const nextDualPrimaryPhotoLocalUri =
          hydratedPost.captureVariant === 'dual'
            ? hydratedPost.dualPrimaryPhotoLocalUri ?? post.dualPrimaryPhotoLocalUri ?? null
            : null;
        const nextDualSecondaryPhotoLocalUri =
          hydratedPost.captureVariant === 'dual'
            ? hydratedPost.dualSecondaryPhotoLocalUri ?? post.dualSecondaryPhotoLocalUri ?? null
            : null;
        const nextPairedVideoLocalUri =
          hydratedPost.pairedVideoLocalUri ?? post.pairedVideoLocalUri ?? null;

        if (
          nextPhotoLocalUri === post.photoLocalUri &&
          nextDualPrimaryPhotoLocalUri === (post.dualPrimaryPhotoLocalUri ?? null) &&
          nextDualSecondaryPhotoLocalUri === (post.dualSecondaryPhotoLocalUri ?? null) &&
          nextPairedVideoLocalUri === (post.pairedVideoLocalUri ?? null)
        ) {
          return post;
        }

        didChange = true;
        mediaPatches.push({
          postId: post.id,
          photoLocalUri: nextPhotoLocalUri,
          dualPrimaryPhotoLocalUri: nextDualPrimaryPhotoLocalUri,
          dualSecondaryPhotoLocalUri: nextDualSecondaryPhotoLocalUri,
          pairedVideoLocalUri: nextPairedVideoLocalUri,
        });
        return {
          ...post,
          photoLocalUri: nextPhotoLocalUri,
          dualPrimaryPhotoLocalUri: nextDualPrimaryPhotoLocalUri,
          dualSecondaryPhotoLocalUri: nextDualSecondaryPhotoLocalUri,
          pairedVideoLocalUri: nextPairedVideoLocalUri,
        };
      });

      if (!didChange) {
        return;
      }

      const nextSnapshot = {
        friends: friendsRef.current,
        sharedPosts: mergedSharedPosts,
        activeInvite: activeInviteRef.current,
        ownedSharedNoteIds: ownedSharedNoteIdsRef.current,
      };

      commitSnapshot(nextSnapshot, source, updatedAt);
      await patchCachedSharedPostMedia(userUid, mediaPatches);
      scheduleSharedFeedWidgetRefresh();
    },
    [
      commitSnapshot,
      hydrateSharedMediaPosts,
      isCurrentSharedFeedSession,
      scheduleSharedFeedWidgetRefresh,
    ]
  );

  const hydrateSharedPostMediaWhenReady = useCallback(
    async (
      userUid: string,
      sessionId: number,
      source: 'live' | 'cache',
      updatedAt: string | null,
      posts: SharedPost[]
    ) => {
      if (posts.length === 0) {
        return;
      }

      if (!startupInteractive) {
        logStartupEvent('shared-feed.media-hydration:deferred', {
          postCount: posts.length,
          source,
          userUid,
        });
        return;
      }

      const hydrationKey = buildSharedMediaHydrationKey(sessionId, source, updatedAt, posts);
      if (sharedMediaHydrationKeyRef.current === hydrationKey) {
        return sharedMediaHydrationPromiseRef.current ?? Promise.resolve();
      }

      sharedMediaHydrationKeyRef.current = hydrationKey;
      const hydrationPromise = traceStartupAsync(
        'shared-feed.media-hydration',
        () => hydrateSharedPostMedia(userUid, sessionId, source, updatedAt, posts),
        {
          postCount: posts.length,
          source,
          userUid,
        }
      )
        .catch((error) => {
          if (sharedMediaHydrationKeyRef.current === hydrationKey) {
            sharedMediaHydrationKeyRef.current = null;
          }
          console.warn('[shared-feed] Shared media hydration failed:', getSharedFeedErrorMessage(error));
        })
        .finally(() => {
          if (sharedMediaHydrationPromiseRef.current === hydrationPromise) {
            sharedMediaHydrationPromiseRef.current = null;
          }
        });

      sharedMediaHydrationPromiseRef.current = hydrationPromise;
      await hydrationPromise;
    },
    [hydrateSharedPostMedia, startupInteractive]
  );

  const commitSnapshotAndPersist = useCallback(
    (
      userUid: string,
      snapshot: {
        friends: FriendConnection[];
        friendGroups?: FriendGroup[];
        sharedPosts: SharedPost[];
        activeInvite: FriendInvite | null;
        ownedSharedNoteIds?: string[];
      },
      updatedAt: string,
      source: 'live' | 'cache' = 'live'
    ) => {
      applySnapshot(snapshot, source, updatedAt);
      return persistSnapshot(userUid, snapshot).finally(() => {
        scheduleSharedFeedWidgetRefresh();
      });
    },
    [applySnapshot, persistSnapshot, scheduleSharedFeedWidgetRefresh]
  );

  const pruneDeletedNoteProjections = useCallback(
    (userUid: string, noteIds: string[]) => {
      const nextNoteIds = noteIds.map((noteId) => noteId.trim()).filter(Boolean);
      if (nextNoteIds.length === 0) {
        return;
      }

      const noteIdSet = new Set(nextNoteIds);
      let didChange = false;
      const nextSharedPosts = sharedPostsRef.current.filter((post) => {
        const shouldRemove =
          post.authorUid === userUid &&
          Boolean(post.sourceNoteId && noteIdSet.has(post.sourceNoteId));
        if (shouldRemove) {
          didChange = true;
        }
        return !shouldRemove;
      });
      const nextOwnedSharedNoteIds = removeOwnedSharedNoteIds(
        ownedSharedNoteIdsRef.current,
        nextNoteIds
      );
      const ownedSharedNoteIdsChanged = nextOwnedSharedNoteIds !== ownedSharedNoteIdsRef.current;

      invalidateSharedFeedRefresh(userUid);
      if (!didChange && !ownedSharedNoteIdsChanged) {
        return;
      }

      const nextSnapshot = {
        friends: friendsRef.current,
        sharedPosts: nextSharedPosts,
        activeInvite: activeInviteRef.current,
        ownedSharedNoteIds: nextOwnedSharedNoteIds,
      };

      commitSnapshot(
        nextSnapshot,
        dataSource,
        lastUpdatedAt
      );
      void persistSnapshot(userUid, nextSnapshot).catch((error) => {
        console.warn('Failed to prune shared-feed cache after note deletion:', error);
      });
      scheduleSharedFeedWidgetRefresh();
    },
    [commitSnapshot, dataSource, lastUpdatedAt, persistSnapshot, scheduleSharedFeedWidgetRefresh]
  );

  const hydrateFromCache = useCallback(async (userUid: string, sessionId: number) => {
    const snapshot = await traceStartupAsync(
      'shared-feed.cache-hydration',
      () => getCachedSharedFeedSnapshot(userUid),
      { userUid }
    );
    if (!isCurrentSharedFeedSession(sessionId, userUid)) {
      return false;
    }
    if (liveSnapshotSessionRef.current === sessionId) {
      return false;
    }
    const hydratedSnapshot = await hydrateSnapshotFromCachedMedia(
      userUid,
      sessionId,
      'cache',
      snapshot
    );
    applySnapshot(hydratedSnapshot, 'cache', snapshot.lastUpdatedAt);
    const hasCachedSnapshot =
      Boolean(snapshot.lastUpdatedAt) ||
      hydratedSnapshot.friends.length > 0 ||
      hydratedSnapshot.sharedPosts.length > 0 ||
      Boolean(hydratedSnapshot.activeInvite);
    dispatchLoadState({ type: 'cacheHydrated', hasCachedSnapshot, isOnline });
    void hydrateSharedPostMediaWhenReady(
      userUid,
      sessionId,
      'cache',
      snapshot.lastUpdatedAt,
      hydratedSnapshot.sharedPosts
    );
    return true;
  }, [
    applySnapshot,
    hydrateSharedPostMediaWhenReady,
    hydrateSnapshotFromCachedMedia,
    isOnline,
    isCurrentSharedFeedSession,
  ]);

  const refreshAll = useCallback(async (options?: { force?: boolean }) => {
    if (!enabled || !user) {
      commitSnapshot(
        {
          friends: [],
          friendGroups: [],
          sharedPosts: [],
          activeInvite: null,
          ownedSharedNoteIds: [],
        },
        'cache',
        null
      );
      suppressedActiveInviteIdRef.current = null;
      createInvitePromiseRef.current = null;
      dispatchLoadState({ type: 'ready' });
      pendingForcedRefreshRef.current = false;
      refreshInFlightRef.current = null;
      return;
    }

    if (!isOnline) {
      dispatchLoadState({ type: 'ready' });
      return;
    }

    const userUid = user.uid;
    const sessionId = sharedFeedSessionRef.current;
    if (refreshInFlightRef.current) {
      pendingForcedRefreshRef.current = pendingForcedRefreshRef.current || Boolean(options?.force);
      return refreshInFlightRef.current;
    }

    const requestId = ++refreshRequestIdRef.current;
    const refreshPromise = (async () => {
      dispatchLoadState({ type: 'refreshStarted' });
      try {
        const snapshot = await traceStartupAsync(
          'shared-feed.refresh',
          () => fetchSharedFeed(user, options),
          {
            force: Boolean(options?.force),
            userUid,
          }
        );
        if (
          !isCurrentSharedFeedSession(sessionId, userUid) ||
          refreshRequestIdRef.current !== requestId
        ) {
          return;
        }

        liveSnapshotSessionRef.current = sessionId;
        const updatedAt = new Date().toISOString();
        const hydratedSnapshot = await hydrateSnapshotFromCachedMedia(
          userUid,
          sessionId,
          'live',
          snapshot
        );
        commitSnapshotAndPersist(userUid, hydratedSnapshot, updatedAt);
        void hydrateSharedPostMediaWhenReady(userUid, sessionId, 'live', updatedAt, hydratedSnapshot.sharedPosts);
      } finally {
        if (
          isCurrentSharedFeedSession(sessionId, userUid) &&
          refreshRequestIdRef.current === requestId
        ) {
          dispatchLoadState({ type: 'ready' });
        }
      }
    })().finally(async () => {
      if (refreshInFlightRef.current === refreshPromise) {
        refreshInFlightRef.current = null;
      }

      if (
        pendingForcedRefreshRef.current &&
        isCurrentSharedFeedSession(sessionId, userUid) &&
        user?.uid === userUid
      ) {
        pendingForcedRefreshRef.current = false;
        await refreshAll({ force: true });
      }
    });

    refreshInFlightRef.current = refreshPromise;
    return refreshPromise;
  }, [
    commitSnapshot,
    commitSnapshotAndPersist,
    enabled,
    hydrateSharedPostMediaWhenReady,
    hydrateSnapshotFromCachedMedia,
    isCurrentSharedFeedSession,
    isOnline,
    user,
  ]);

  const resolveOwnedPostIdsForNote = useCallback(
    async (activeUser: typeof user, noteId: string) => {
      if (!activeUser) {
        return [];
      }

      let matchingPostIds = sharedPostsRef.current
        .filter((post) => post.authorUid === activeUser.uid && post.sourceNoteId === noteId)
        .map((post) => post.id);

      if (matchingPostIds.length === 0 && !ready) {
        await refreshAll();
        matchingPostIds = sharedPostsRef.current
          .filter((post) => post.authorUid === activeUser.uid && post.sourceNoteId === noteId)
          .map((post) => post.id);
      }

      if (matchingPostIds.length === 0) {
        matchingPostIds = await findOwnedSharedPostIdsForNote(activeUser, noteId);
      }

      return matchingPostIds;
    },
    [ready, refreshAll]
  );

  useEffect(() => {
    const activeUser = userRef.current;
    const activeUserUid = activeUser?.uid ?? null;
    sharedFeedSessionRef.current += 1;
    const sessionId = sharedFeedSessionRef.current;

    if (!isReady) {
      return;
    }

    if (!enabled || !activeUser || !activeUserUid) {
      commitSnapshot(
        {
          friends: [],
          friendGroups: [],
          sharedPosts: [],
          activeInvite: null,
          ownedSharedNoteIds: [],
        },
        'cache',
        null
      );
      suppressedActiveInviteIdRef.current = null;
      createInvitePromiseRef.current = null;
      dispatchLoadState({ type: 'ready' });
      pendingForcedRefreshRef.current = false;
      refreshInFlightRef.current = null;
      sharedMediaHydrationKeyRef.current = null;
      sharedMediaHydrationPromiseRef.current = null;
      sharedFeedSubscriptionHealthyRef.current = true;
      lastForegroundRefreshAtRef.current = null;
      liveSnapshotSessionRef.current = null;
      if (previousUserUidRef.current) {
        void clearSharedFeedCache(previousUserUidRef.current);
        invalidateSharedFeedRefresh(previousUserUidRef.current);
      }
      previousUserUidRef.current = null;
      return;
    }

    const isSameUserSession = previousUserUidRef.current === activeUserUid;
    if (previousUserUidRef.current && !isSameUserSession) {
      void clearSharedFeedCache(previousUserUidRef.current);
      invalidateSharedFeedRefresh(previousUserUidRef.current);
    }

    previousUserUidRef.current = activeUserUid;
    sharedMediaHydrationKeyRef.current = null;
    sharedMediaHydrationPromiseRef.current = null;
    sharedFeedSubscriptionHealthyRef.current = true;
    lastForegroundRefreshAtRef.current = null;
    liveSnapshotSessionRef.current = null;
    if (!isSameUserSession) {
      commitSnapshot(
        {
          friends: [],
          friendGroups: [],
          sharedPosts: [],
          activeInvite: null,
          ownedSharedNoteIds: [],
        },
        'cache',
        null
      );
      dispatchLoadState({ type: 'resetForUser' });
      pendingForcedRefreshRef.current = false;
      refreshInFlightRef.current = null;
      suppressedActiveInviteIdRef.current = null;
      void hydrateFromCache(activeUserUid, sessionId)
        .catch((error) => {
          if (sharedFeedSessionRef.current !== sessionId || previousUserUidRef.current !== activeUserUid) {
            return;
          }

          console.warn('Shared feed cache hydration failed:', getSharedFeedErrorMessage(error));
          dispatchLoadState({ type: 'ready' });
        })
        .finally(() => {
          if (sharedFeedSessionRef.current === sessionId && !isOnline) {
            dispatchLoadState({ type: 'ready' });
          }
        });
    }

    if (!isOnline) {
      if (isSameUserSession) {
        dispatchLoadState({ type: 'ready' });
      }
      return;
    }

    const unsubscribe = subscribeToSharedFeed(activeUser, {
      onSnapshot: (snapshot) => {
        if (sharedFeedSessionRef.current !== sessionId || previousUserUidRef.current !== activeUserUid) {
          return;
        }
        return (async () => {
          sharedFeedSubscriptionHealthyRef.current = true;
          liveSnapshotSessionRef.current = sessionId;
          const updatedAt = new Date().toISOString();
          const hydratedSnapshot = await hydrateSnapshotFromCachedMedia(
            activeUserUid,
            sessionId,
            'live',
            snapshot
          );

          if (
            sharedFeedSessionRef.current !== sessionId ||
            previousUserUidRef.current !== activeUserUid
          ) {
            return;
          }

          commitSnapshotAndPersist(activeUserUid, hydratedSnapshot, updatedAt);
          logStartupEvent('shared-feed.subscription-snapshot', {
            postCount: hydratedSnapshot.sharedPosts.length,
            userUid: activeUserUid,
          });
          void hydrateSharedPostMediaWhenReady(
            activeUserUid,
            sessionId,
            'live',
            updatedAt,
            hydratedSnapshot.sharedPosts
          );
          dispatchLoadState({ type: 'ready' });
        })().catch((error) => {
          if (
            sharedFeedSessionRef.current !== sessionId ||
            previousUserUidRef.current !== activeUserUid
          ) {
            return;
          }

          sharedFeedSubscriptionHealthyRef.current = false;
          console.warn('Shared feed subscription snapshot failed:', getSharedFeedErrorMessage(error));
          dispatchLoadState({ type: 'ready' });
        });
      },
      onError: (error) => {
        if (sharedFeedSessionRef.current !== sessionId || previousUserUidRef.current !== activeUserUid) {
          return;
        }
        sharedFeedSubscriptionHealthyRef.current = false;
        console.warn('Shared feed subscription failed:', getSharedFeedErrorMessage(error));
        dispatchLoadState({ type: 'ready' });
      },
    });

    return unsubscribe;
  }, [
    commitSnapshot,
    commitSnapshotAndPersist,
    enabled,
    hydrateFromCache,
    hydrateSharedPostMediaWhenReady,
    hydrateSnapshotFromCachedMedia,
    isOnline,
    isReady,
    user?.uid,
  ]);

  const friendPresenceUserIds = useMemo(
    () => friends.map((friend) => friend.userId).filter(Boolean).sort(),
    [friends]
  );
  const friendPresenceKey = friendPresenceUserIds.join('|');

  useEffect(() => {
    if (!enabled || !user || !isOnline || friendPresenceUserIds.length === 0) {
      setFriendPresence({});
      return;
    }

    return subscribeToFriendPresence(user, friendPresenceUserIds, {
      onPresence: setFriendPresence,
      onError: (error) => {
        console.warn('Friend presence subscription failed:', getSharedFeedErrorMessage(error));
      },
    });
  }, [enabled, friendPresenceKey, friendPresenceUserIds, isOnline, user]);

  useEffect(() => {
    const activeUserUid = userRef.current?.uid ?? null;
    if (!enabled || !activeUserUid || !ready || !startupInteractive || sharedPosts.length === 0) {
      return;
    }

    void hydrateSharedPostMediaWhenReady(
      activeUserUid,
      sharedFeedSessionRef.current,
      dataSource,
      lastUpdatedAt,
      sharedPosts
    );
  }, [
    dataSource,
    enabled,
    hydrateSharedPostMediaWhenReady,
    lastUpdatedAt,
    ready,
    sharedPosts,
    startupInteractive,
    user?.uid,
  ]);

  useEffect(() => {
    if (!enabled || !user || !isReady) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        if (isOnline) {
          void updateOwnPresenceLastSeen(user).catch(() => undefined);
        }
        return;
      }

      const now = Date.now();
      const refreshContext = {
        dataSource,
        isOnline,
        lastForegroundRefreshAt: lastForegroundRefreshAtRef.current,
        lastUpdatedAt,
        ready,
        subscriptionHealthy: sharedFeedSubscriptionHealthyRef.current,
      };

      if (!shouldRefreshSharedFeedOnForeground(refreshContext, now)) {
        return;
      }

      lastForegroundRefreshAtRef.current = now;
      const shouldForceRefresh = shouldForceSharedFeedForegroundRefresh(refreshContext);

      void refreshAll(shouldForceRefresh ? { force: true } : undefined).catch(() => undefined);
    });

    return () => {
      subscription.remove();
    };
  }, [dataSource, enabled, isOnline, isReady, lastUpdatedAt, loading, ready, refreshAll, user]);

  useEffect(() => {
    if (!enabled || !user) {
      return;
    }

    return subscribeToDeletedNotes((event) => {
      if (event.scope !== user.uid) {
        return;
      }

      pruneDeletedNoteProjections(user.uid, event.noteIds);
    });
  }, [enabled, pruneDeletedNoteProjections, user]);

  const requireUser = useCallback(() => {
    if (!enabled || !user) {
      throw new Error(i18n.t('shared.signInRequiredError', 'Sign in to share moments.'));
    }

    return user;
  }, [enabled, user]);

  const requireOnline = useCallback(() => {
    if (!isOnline) {
      throw new Error(
        i18n.t(
          'shared.offlineActionError',
          'You are offline. Cached shared moments are still visible, but sharing actions need a connection.'
        )
      );
    }
  }, [isOnline]);
  const fetchSharedPostResponsesPageOnce = useCallback(
    (
      activeUser: AppUser,
      postId: string,
      options: { limit?: number; beforeCreatedAt?: string | null } = {}
    ) => {
      const normalizedPostId = postId.trim();
      const beforeCreatedAt = options.beforeCreatedAt?.trim() || '';
      const requestKey = [
        activeUser.uid,
        normalizedPostId,
        options.limit ?? 'default',
        beforeCreatedAt,
      ].join(':');
      const inFlightRequest = responsePageFetchesRef.current.get(requestKey);
      if (inFlightRequest) {
        return inFlightRequest;
      }

      const request = fetchPostResponsesPage(activeUser, normalizedPostId, options).finally(() => {
        responsePageFetchesRef.current.delete(requestKey);
      });
      responsePageFetchesRef.current.set(requestKey, request);
      return request;
    },
    []
  );
  const presentedSharedPosts = useMemo(
    () => applyFriendNicknamesToSharedPosts(sharedPosts, friends, user?.uid ?? null),
    [friends, sharedPosts, user?.uid]
  );

  return useMemo<SharedFeedStoreValue>(
    () => ({
      enabled,
      phase,
      loading,
      ready,
      initialLoadComplete,
      dataSource,
      lastUpdatedAt,
      friends,
      friendPresence,
      friendGroups,
      sharedPosts: presentedSharedPosts,
      ownedSharedNoteIds,
      activeInvite,
      refreshSharedFeed: refreshAll,
      createFriendInvite: async () => {
        if (activeInviteRef.current) {
          return activeInviteRef.current;
        }

        if (createInvitePromiseRef.current) {
          return createInvitePromiseRef.current;
        }

        const activeUser = requireUser();
        requireOnline();
        const sessionId = sharedFeedSessionRef.current;
        const invitePromise = createInvite(activeUser)
          .then((invite) => {
            if (!isCurrentSharedFeedSession(sessionId, activeUser.uid)) {
              return invite;
            }

            suppressedActiveInviteIdRef.current = null;
            commitSnapshotAndPersist(
              activeUser.uid,
              {
                friends: friendsRef.current,
                sharedPosts: sharedPostsRef.current,
                activeInvite: invite,
                ownedSharedNoteIds: ownedSharedNoteIdsRef.current,
              },
              new Date().toISOString()
            );
            return invite;
          })
          .finally(() => {
            createInvitePromiseRef.current = null;
          });

        createInvitePromiseRef.current = invitePromise;
        return invitePromise;
      },
      revokeFriendInvite: async (inviteId: string) => {
        requireOnline();
        const activeUser = requireUser();
        const sessionId = sharedFeedSessionRef.current;
        await revokeInvite(activeUser, inviteId);
        if (!isCurrentSharedFeedSession(sessionId, activeUser.uid)) {
          return;
        }
        suppressedActiveInviteIdRef.current = inviteId;
        await commitSnapshotAndPersist(
          activeUser.uid,
          {
            friends: friendsRef.current,
            sharedPosts: sharedPostsRef.current,
            activeInvite: activeInviteRef.current?.id === inviteId ? null : activeInviteRef.current,
            ownedSharedNoteIds: ownedSharedNoteIdsRef.current,
          },
          new Date().toISOString()
        );
      },
      acceptFriendInvite: async (inviteValue: string) => {
        requireOnline();
        const activeUser = requireUser();
        const sessionId = sharedFeedSessionRef.current;
        const connection = await acceptInvite(activeUser, inviteValue);
        if (!isCurrentSharedFeedSession(sessionId, activeUser.uid)) {
          return;
        }
        const nextFriends = upsertFriendConnection(friendsRef.current, connection);
        commitSnapshotAndPersist(
          activeUser.uid,
          {
            friends: nextFriends,
            sharedPosts: sharedPostsRef.current,
            activeInvite: activeInviteRef.current,
            ownedSharedNoteIds: ownedSharedNoteIdsRef.current,
          },
          new Date().toISOString()
        );
      },
      findFriendByUsername: async (username: string) => {
        requireOnline();
        const activeUser = requireUser();
        return findFriendByUsernameRemote(activeUser, username);
      },
      addFriendByUsername: async (username: string) => {
        requireOnline();
        const activeUser = requireUser();
        const sessionId = sharedFeedSessionRef.current;
        const connection = await addFriendByUsernameRemote(activeUser, username);
        if (!isCurrentSharedFeedSession(sessionId, activeUser.uid)) {
          return;
        }
        const nextFriends = upsertFriendConnection(friendsRef.current, connection);
        commitSnapshotAndPersist(
          activeUser.uid,
          {
            friends: nextFriends,
            sharedPosts: sharedPostsRef.current,
            activeInvite: activeInviteRef.current,
            ownedSharedNoteIds: ownedSharedNoteIdsRef.current,
          },
          new Date().toISOString()
        );
        void refreshAll({ force: true }).catch(() => undefined);
      },
      removeFriend: async (friendUid: string) => {
        requireOnline();
        const activeUser = requireUser();
        const sessionId = sharedFeedSessionRef.current;
        await deleteFriend(activeUser, friendUid);
        if (!isCurrentSharedFeedSession(sessionId, activeUser.uid)) {
          return;
        }
        const nextFriends = friendsRef.current.filter((friend) => friend.userId !== friendUid);
        const nextFriendUidSet = new Set(nextFriends.map((friend) => friend.userId));
        const nextSharedPosts = sharedPostsRef.current.flatMap((post) => {
          if (post.authorUid === friendUid) {
            return [];
          }

          if (post.authorUid !== activeUser.uid) {
            return [post];
          }

          const nextAudienceUserIds = Array.from(
            new Set([activeUser.uid, ...post.audienceUserIds.filter((audienceUid) => audienceUid !== friendUid)])
          );
          const hasRemainingFriendAudience = nextAudienceUserIds.some(
            (audienceUid) => audienceUid !== activeUser.uid && nextFriendUidSet.has(audienceUid)
          );

          if (!hasRemainingFriendAudience) {
            return [];
          }

          return [
            {
              ...post,
              audienceUserIds: nextAudienceUserIds,
            },
          ];
        });
        commitSnapshotAndPersist(
          activeUser.uid,
          {
            friends: nextFriends,
            sharedPosts: nextSharedPosts,
            activeInvite: activeInviteRef.current,
            ownedSharedNoteIds: ownedSharedNoteIdsRef.current,
          },
          new Date().toISOString()
        );
        void refreshAll({ force: true }).catch(() => undefined);
      },
      updateFriendNickname: async (friendUid: string, nickname: string | null) => {
        requireOnline();
        const activeUser = requireUser();
        const sessionId = sharedFeedSessionRef.current;
        const connection = await saveFriendNickname(activeUser, friendUid, nickname);
        if (!isCurrentSharedFeedSession(sessionId, activeUser.uid)) {
          return;
        }
        const nextFriends = upsertFriendConnection(friendsRef.current, connection);
        commitSnapshotAndPersist(
          activeUser.uid,
          {
            friends: nextFriends,
            sharedPosts: sharedPostsRef.current,
            activeInvite: activeInviteRef.current,
            ownedSharedNoteIds: ownedSharedNoteIdsRef.current,
          },
          new Date().toISOString()
        );
        void refreshAll({ force: true }).catch(() => undefined);
      },
      createFriendGroup: async (input: { name: string; memberUserIds: string[] }) => {
        requireOnline();
        const activeUser = requireUser();
        const sessionId = sharedFeedSessionRef.current;
        const group = await createGroup(activeUser, input);
        if (!isCurrentSharedFeedSession(sessionId, activeUser.uid)) {
          return;
        }

        const nextGroups = [...friendGroupsRef.current, group];
        commitSnapshotAndPersist(
          activeUser.uid,
          {
            friends: friendsRef.current,
            friendGroups: nextGroups,
            sharedPosts: sharedPostsRef.current,
            activeInvite: activeInviteRef.current,
            ownedSharedNoteIds: ownedSharedNoteIdsRef.current,
          },
          new Date().toISOString()
        );
      },
      updateFriendGroup: async (
        groupId: string,
        input: { name: string; memberUserIds: string[] }
      ) => {
        requireOnline();
        const activeUser = requireUser();
        const sessionId = sharedFeedSessionRef.current;
        const group = await saveGroup(activeUser, groupId, input);
        if (!isCurrentSharedFeedSession(sessionId, activeUser.uid)) {
          return;
        }

        const nextGroups = friendGroupsRef.current.map((item) =>
          item.id === group.id ? group : item
        );
        commitSnapshotAndPersist(
          activeUser.uid,
          {
            friends: friendsRef.current,
            friendGroups: nextGroups,
            sharedPosts: sharedPostsRef.current,
            activeInvite: activeInviteRef.current,
            ownedSharedNoteIds: ownedSharedNoteIdsRef.current,
          },
          new Date().toISOString()
        );
      },
      deleteFriendGroup: async (groupId: string) => {
        requireOnline();
        const activeUser = requireUser();
        const sessionId = sharedFeedSessionRef.current;
        await removeGroup(activeUser, groupId);
        if (!isCurrentSharedFeedSession(sessionId, activeUser.uid)) {
          return;
        }

        const nextGroups = friendGroupsRef.current.filter((group) => group.id !== groupId);
        commitSnapshotAndPersist(
          activeUser.uid,
          {
            friends: friendsRef.current,
            friendGroups: nextGroups,
            sharedPosts: sharedPostsRef.current,
            activeInvite: activeInviteRef.current,
            ownedSharedNoteIds: ownedSharedNoteIdsRef.current,
          },
          new Date().toISOString()
        );
      },
      createSharedPost: async (note: Note, audienceUserIds?: string[]) => {
        requireOnline();
        const activeUser = requireUser();
        const sessionId = sharedFeedSessionRef.current;
        const requestedAudienceUserIds = audienceUserIds
          ? normalizeOwnedSharedNoteIds(audienceUserIds)
          : undefined;
        const post = await createPost(activeUser, note, requestedAudienceUserIds);
        if (!isCurrentSharedFeedSession(sessionId, activeUser.uid)) {
          return post;
        }
        const nextSharedPosts = [post, ...sharedPostsRef.current.filter((item) => item.id !== post.id)];
        await commitSnapshotAndPersist(
          activeUser.uid,
          {
            friends: friendsRef.current,
            sharedPosts: nextSharedPosts,
            activeInvite: activeInviteRef.current,
            ownedSharedNoteIds: addOwnedSharedNoteId(
              ownedSharedNoteIdsRef.current,
              post.sourceNoteId ?? note.id
            ),
          },
          new Date().toISOString()
        );
        return post;
      },
      getSharedPostResponses: async (postId: string) => {
        const activeUser = requireUser();
        if (!isOnline) {
          const cachedResponses = await getCachedSharedPostResponses(activeUser.uid, postId);
          rememberSharedPostResponses(postId, cachedResponses);
          return cachedResponses;
        }

        const responses = await fetchSharedPostResponsesPageOnce(activeUser, postId);
        rememberSharedPostResponses(postId, responses);
        void reconcileCachedSharedPostResponsesPage(activeUser.uid, postId, responses).catch((error) => {
          console.warn('Failed to persist shared response cache:', error);
        });
        return responses;
      },
      getSharedPostResponsesPage: async (
        postId: string,
        options?: { limit?: number; beforeCreatedAt?: string | null }
      ) => {
        const activeUser = requireUser();
        if (!isOnline) {
          const cachedResponses = await getCachedSharedPostResponsesPage(
            activeUser.uid,
            postId,
            options
          );
          if (!options?.beforeCreatedAt) {
            rememberSharedPostResponses(postId, cachedResponses);
          }
          return cachedResponses;
        }

        const responses = await fetchSharedPostResponsesPageOnce(activeUser, postId, options);
        if (!options?.beforeCreatedAt) {
          rememberSharedPostResponses(postId, responses);
        }
        if (options?.beforeCreatedAt) {
          void reconcileCachedSharedPostResponsesPage(activeUser.uid, postId, responses, {
            beforeCreatedAt: options.beforeCreatedAt,
          }).catch((error) => {
            console.warn('Failed to persist shared response page cache:', error);
          });
        } else {
          void reconcileCachedSharedPostResponsesPage(activeUser.uid, postId, responses).catch(
            (error) => {
              console.warn('Failed to persist shared response cache:', error);
            }
          );
        }
        return responses;
      },
      getSharedPostThreadSummaries: async (postIds: string[]) => {
        const activeUser = requireUser();
        const normalizedPostIds = Array.from(
          new Set(postIds.map((postId) => postId.trim()).filter(Boolean))
        );
        if (normalizedPostIds.length === 0) {
          return [];
        }

        if (!isOnline) {
          return getCachedSharedThreadSummaries(activeUser.uid, normalizedPostIds);
        }

        const cachedSummaries = await getCachedSharedThreadSummaries(
          activeUser.uid,
          normalizedPostIds
        ).catch(() => []);
        const summaries = await fetchPostThreadSummaries(activeUser, normalizedPostIds);
        void replaceCachedSharedThreadSummaries(activeUser.uid, summaries).catch((error) => {
          console.warn('Failed to persist shared thread summary cache:', error);
        });
        if (summaries.length === 0 && cachedSummaries.length > 0) {
          return cachedSummaries;
        }
        return summaries;
      },
      subscribeToSharedPostResponses: (
        postId: string,
        options: SharedPostResponsesSubscriptionOptions
      ) => {
        const activeUser = requireUser();
        let disposed = false;
        void getCachedSharedPostResponsesPage(activeUser.uid, postId, {
          limit: options.initialPageSize,
        })
          .then((cachedResponses) => {
            if (!disposed && (cachedResponses.length > 0 || !isOnline)) {
              rememberSharedPostResponses(postId, cachedResponses);
              void options.onResponses(cachedResponses);
            }
          })
          .catch(() => undefined);

        if (!isOnline) {
          options.onStatus?.('disconnected');
          return () => {
            disposed = true;
          };
        }

        const unsubscribe = subscribeToPostResponses(activeUser, postId, {
          ...options,
          onResponses: async (responses) => {
            rememberSharedPostResponses(postId, responses);
            await reconcileCachedSharedPostResponsesPage(activeUser.uid, postId, responses).catch(
              (error) => {
                console.warn('Failed to persist shared response cache:', error);
              }
            );
            if (!disposed) {
              await options.onResponses(responses);
            }
          },
          onResponse: async (response) => {
            await upsertCachedSharedPostResponse(activeUser.uid, response).catch((error) => {
              console.warn('Failed to persist shared response cache:', error);
            });
            if (disposed) {
              return;
            }

            if (options.onResponse) {
              await options.onResponse(response);
            } else {
              await options.onResponses(
                await getCachedSharedPostResponsesPage(activeUser.uid, postId, {
                  limit: options.initialPageSize,
                })
              );
            }
          },
          onResponseDeleted: async (responseId) => {
            await deleteCachedSharedPostResponse(activeUser.uid, { postId, responseId }).catch(
              (error) => {
                console.warn('Failed to remove shared response cache:', error);
              }
            );
            if (disposed) {
              return;
            }

            if (options.onResponseDeleted) {
              await options.onResponseDeleted(responseId);
            } else {
              await options.onResponses(
                await getCachedSharedPostResponsesPage(activeUser.uid, postId, {
                  limit: options.initialPageSize,
                })
              );
            }
          },
          onReaction: async (reaction) => {
            await upsertCachedSharedPostResponseReaction(activeUser.uid, reaction).catch((error) => {
              console.warn('Failed to persist shared response reaction cache:', error);
            });
            if (disposed) {
              return;
            }

            if (options.onReaction) {
              await options.onReaction(reaction);
            } else {
              await options.onResponses(
                await getCachedSharedPostResponsesPage(activeUser.uid, postId, {
                  limit: options.initialPageSize,
                })
              );
            }
          },
          onReactionDeleted: async (reaction) => {
            if (reaction.responseId && reaction.authorUid) {
              await deleteCachedSharedPostResponseReaction(activeUser.uid, {
                postId: reaction.postId,
                responseId: reaction.responseId,
                authorUid: reaction.authorUid,
              }).catch((error) => {
                console.warn('Failed to remove shared response reaction cache:', error);
              });
            } else {
              await deleteCachedSharedPostResponseReactionById(activeUser.uid, {
                postId: reaction.postId,
                reactionId: reaction.id,
              }).catch((error) => {
                console.warn('Failed to remove shared response reaction cache:', error);
              });
            }
            if (disposed) {
              return;
            }

            if (options.onReactionDeleted) {
              await options.onReactionDeleted(reaction);
            } else {
              await options.onResponses(
                await getCachedSharedPostResponsesPage(activeUser.uid, postId, {
                  limit: options.initialPageSize,
                })
              );
            }
          },
        });

        return () => {
          disposed = true;
          unsubscribe();
        };
      },
      subscribeToSharedPostTyping: (
        postId: string,
        options: {
          onTypingUsers: (users: SharedPostTypingUser[]) => void;
          onError?: (error: unknown) => void;
        }
      ) => {
        const activeUser = requireUser();
        if (!isOnline) {
          options.onTypingUsers([]);
          return {
            setTyping: () => undefined,
            unsubscribe: () => undefined,
          };
        }

        return subscribeToPostTyping(activeUser, postId, options);
      },
      createSharedPostResponse: async (
        postId: string,
        input: { emoji?: string | null; text?: string | null; replyToResponseId?: string | null }
      ) => {
        requireOnline();
        const activeUser = requireUser();
        const response = await createPostResponse(activeUser, postId, input);
        void upsertCachedSharedPostResponse(activeUser.uid, response).catch((error) => {
          console.warn('Failed to persist shared response cache:', error);
        });
        return response;
      },
      createSharedPostResponseReaction: async (
        postId: string,
        responseId: string,
        emoji: string
      ) => {
        requireOnline();
        const activeUser = requireUser();
        const reaction = await createPostResponseReaction(activeUser, postId, responseId, emoji);
        void upsertCachedSharedPostResponseReaction(activeUser.uid, reaction).catch((error) => {
          console.warn('Failed to persist shared response reaction cache:', error);
        });
        return reaction;
      },
      deleteSharedPostResponseReaction: async (postId: string, responseId: string) => {
        requireOnline();
        const activeUser = requireUser();
        await deletePostResponseReaction(activeUser, postId, responseId);
        void deleteCachedSharedPostResponseReaction(activeUser.uid, {
          postId,
          responseId,
          authorUid: activeUser.uid,
        }).catch((error) => {
          console.warn('Failed to remove shared response reaction cache:', error);
        });
      },
      getSharedThreadReadStates: async () => {
        const activeUser = requireUser();
        return getCachedSharedThreadReadStates(activeUser.uid);
      },
      markSharedThreadRead: async (postId: string, lastReadResponseId: string | null) => {
        const activeUser = requireUser();
        return markCachedSharedThreadRead(activeUser.uid, postId, lastReadResponseId);
      },
      updateSharedNote: async (note: Note) => {
        requireOnline();
        const activeUser = requireUser();
        const sessionId = sharedFeedSessionRef.current;
        const matchingPostIds = await resolveOwnedPostIdsForNote(activeUser, note.id);

        await Promise.all(matchingPostIds.map((postId) => updatePost(activeUser, postId, note)));
        if (!isCurrentSharedFeedSession(sessionId, activeUser.uid)) {
          return;
        }
        const matchingPostIdSet = new Set(matchingPostIds);
        const updatedAt = new Date().toISOString();
        const nextSharedPosts = sharedPostsRef.current.map((post) => {
          if (!matchingPostIdSet.has(post.id)) {
            return post;
          }

          const nextType = note.type;
          const nextPhotoPath = nextType === 'photo' ? post.photoPath : null;
          const nextCaptureVariant: Note['captureVariant'] =
            nextType === 'photo'
              ? note.captureVariant === 'dual'
                ? 'dual'
                : note.captureVariant === 'single'
                  ? 'single'
                  : null
              : null;
          const nextPairedVideoPath = nextType === 'photo' && note.isLivePhoto ? post.pairedVideoPath ?? null : null;

          return {
            ...post,
            type: nextType,
            text:
              nextType === 'text'
                ? formatNoteTextWithEmoji(note.content.trim(), note.moodEmoji)
                : note.caption?.trim() ?? '',
            photoPath: nextPhotoPath,
            photoLocalUri: nextType === 'photo' ? getNotePhotoUri(note) : null,
            captureVariant: nextCaptureVariant,
            dualPrimaryPhotoPath:
              nextCaptureVariant === 'dual' ? post.dualPrimaryPhotoPath ?? null : null,
            dualSecondaryPhotoPath:
              nextCaptureVariant === 'dual' ? post.dualSecondaryPhotoPath ?? null : null,
            dualPrimaryPhotoLocalUri:
              nextCaptureVariant === 'dual' ? note.dualPrimaryPhotoLocalUri ?? null : null,
            dualSecondaryPhotoLocalUri:
              nextCaptureVariant === 'dual' ? note.dualSecondaryPhotoLocalUri ?? null : null,
            dualPrimaryFacing:
              nextCaptureVariant === 'dual' ? note.dualPrimaryFacing ?? null : null,
            dualSecondaryFacing:
              nextCaptureVariant === 'dual' ? note.dualSecondaryFacing ?? null : null,
            dualLayoutPreset:
              nextCaptureVariant === 'dual' ? note.dualLayoutPreset ?? null : null,
            isLivePhoto: Boolean(nextType === 'photo' && note.isLivePhoto && nextPairedVideoPath),
            pairedVideoPath: nextPairedVideoPath,
            pairedVideoLocalUri:
              nextType === 'photo' && note.isLivePhoto ? getNotePairedVideoUri(note) : null,
            doodleStrokesJson: note.doodleStrokesJson ?? null,
            hasStickers: Boolean(note.hasStickers && note.stickerPlacementsJson),
            stickerPlacementsJson: note.stickerPlacementsJson ?? null,
            noteColor: nextType === 'text' ? normalizeSavedTextNoteColor(note.noteColor) : null,
            placeName: note.locationName ?? null,
            latitude: note.latitude,
            longitude: note.longitude,
            updatedAt,
          };
        });
        commitSnapshotAndPersist(
          activeUser.uid,
          {
            friends: friendsRef.current,
            sharedPosts: nextSharedPosts,
            activeInvite: activeInviteRef.current,
            ownedSharedNoteIds: ownedSharedNoteIdsRef.current,
          },
          updatedAt
        );
      },
      deleteSharedNote: async (noteId: string) => {
        requireOnline();
        const activeUser = requireUser();
        const sessionId = sharedFeedSessionRef.current;
        const matchingPostIds = await resolveOwnedPostIdsForNote(activeUser, noteId);

        await Promise.all(matchingPostIds.map((postId) => deletePost(activeUser, postId)));
        if (!isCurrentSharedFeedSession(sessionId, activeUser.uid)) {
          return;
        }
        pruneDeletedNoteProjections(activeUser.uid, [noteId]);
      },
      deleteSharedNotes: async (noteIds: string[]) => {
        requireOnline();
        const activeUser = requireUser();
        const sessionId = sharedFeedSessionRef.current;
        await deleteOwnedSharedPostsForNotes(activeUser, noteIds);
        if (!isCurrentSharedFeedSession(sessionId, activeUser.uid)) {
          return;
        }
        pruneDeletedNoteProjections(activeUser.uid, noteIds);
      },
      deleteSharedPostById: async (postId: string) => {
        requireOnline();
        const activeUser = requireUser();
        const sessionId = sharedFeedSessionRef.current;
        await deletePost(activeUser, postId);
        if (!isCurrentSharedFeedSession(sessionId, activeUser.uid)) {
          return;
        }
        const nextSharedPosts = sharedPostsRef.current.filter(
          (post) => post.id !== postId && !(post.authorUid === activeUser.uid && post.id === postId)
        );
        await commitSnapshotAndPersist(
          activeUser.uid,
          {
            friends: friendsRef.current,
            sharedPosts: nextSharedPosts,
            activeInvite: activeInviteRef.current,
            ownedSharedNoteIds: ownedSharedNoteIdsRef.current,
          },
          new Date().toISOString()
        );
        void refreshAll();
      },
    }),
    [
      activeInvite,
      commitSnapshot,
      commitSnapshotAndPersist,
      dataSource,
      enabled,
      friends,
      friendPresence,
      friendGroups,
      fetchSharedPostResponsesPageOnce,
      phase,
      initialLoadComplete,
      isOnline,
      lastUpdatedAt,
      loading,
      persistSnapshot,
      ready,
      refreshAll,
      isCurrentSharedFeedSession,
      pruneDeletedNoteProjections,
      requireOnline,
      requireUser,
      resolveOwnedPostIdsForNote,
      presentedSharedPosts,
      ownedSharedNoteIds,
    ]
  );
}

export function SharedFeedProvider({ children }: { children: ReactNode }) {
  const value = useSharedFeedStoreValue();
  return <SharedFeedStoreContext.Provider value={value}>{children}</SharedFeedStoreContext.Provider>;
}

export function useSharedFeedStore() {
  const context = useContext(SharedFeedStoreContext);
  if (!context) {
    throw new Error('useSharedFeedStore must be used within a SharedFeedProvider');
  }

  return context;
}

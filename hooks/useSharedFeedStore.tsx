import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import i18n from '../constants/i18n';
import { Note } from '../services/database';
import {
  addFriendByUsername as addFriendByUsernameRemote,
  acceptFriendInvite as acceptInvite,
  createFriendInvite as createInvite,
  createSharedPost as createPost,
  deleteOwnedSharedPostsForNotes,
  deleteSharedPost as deletePost,
  findFriendByUsername as findFriendByUsernameRemote,
  FriendSearchResult,
  findOwnedSharedPostIdsForNote,
  FriendConnection,
  FriendInvite,
  getSharedFeedErrorMessage,
  refreshSharedFeed as fetchSharedFeed,
  removeFriend as deleteFriend,
  revokeFriendInvite as revokeInvite,
  SharedPost,
  subscribeToSharedFeed,
  updateSharedPost as updatePost,
} from '../services/sharedFeedService';
import {
  cacheSharedFeedSnapshot,
  clearSharedFeedCache,
  getCachedSharedFeedSnapshot,
} from '../services/sharedFeedCache';
import { getNotePairedVideoUri } from '../services/livePhotoStorage';
import { normalizeSavedTextNoteColor } from '../services/noteAppearance';
import { formatNoteTextWithEmoji } from '../services/noteTextPresentation';
import { getNotePhotoUri } from '../services/photoStorage';
import {
  downloadPairedVideoFromStorage,
  downloadPhotoFromStorage,
  SHARED_POST_MEDIA_BUCKET,
} from '../services/remoteMedia';
import { scheduleWidgetDataUpdate } from '../services/widgetService';
import { useAuth } from './useAuth';
import { useConnectivity } from './useConnectivity';

interface SharedFeedStoreValue {
  enabled: boolean;
  loading: boolean;
  ready: boolean;
  dataSource: 'live' | 'cache';
  lastUpdatedAt: string | null;
  friends: FriendConnection[];
  sharedPosts: SharedPost[];
  activeInvite: FriendInvite | null;
  refreshSharedFeed: () => Promise<void>;
  createFriendInvite: () => Promise<FriendInvite>;
  revokeFriendInvite: (inviteId: string) => Promise<void>;
  acceptFriendInvite: (inviteValue: string) => Promise<void>;
  findFriendByUsername: (username: string) => Promise<FriendSearchResult>;
  addFriendByUsername: (username: string) => Promise<void>;
  removeFriend: (friendUid: string) => Promise<void>;
  createSharedPost: (note: Note, audienceUserIds?: string[]) => Promise<SharedPost>;
  updateSharedNote: (note: Note) => Promise<void>;
  deleteSharedNote: (noteId: string) => Promise<void>;
  deleteSharedNotes: (noteIds: string[]) => Promise<void>;
  deleteSharedPostById: (postId: string) => Promise<void>;
}

const SharedFeedStoreContext = createContext<SharedFeedStoreValue | undefined>(undefined);

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

function useSharedFeedStoreValue(): SharedFeedStoreValue {
  const { user, isAuthAvailable, isReady } = useAuth();
  const { isOnline } = useConnectivity();
  const [friends, setFriends] = useState<FriendConnection[]>([]);
  const [sharedPosts, setSharedPosts] = useState<SharedPost[]>([]);
  const [activeInvite, setActiveInvite] = useState<FriendInvite | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [dataSource, setDataSource] = useState<'live' | 'cache'>('cache');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const friendsRef = useRef<FriendConnection[]>([]);
  const sharedPostsRef = useRef<SharedPost[]>([]);
  const activeInviteRef = useRef<FriendInvite | null>(null);
  const suppressActiveInviteRef = useRef(false);
  const createInvitePromiseRef = useRef<Promise<FriendInvite> | null>(null);
  const previousUserUidRef = useRef<string | null>(null);
  const sharedFeedSessionRef = useRef(0);

  const isCurrentSharedFeedSession = useCallback(
    (sessionId: number, userUid: string) =>
      sharedFeedSessionRef.current === sessionId && previousUserUidRef.current === userUid,
    []
  );

  const enabled = isAuthAvailable;

  const commitSnapshot = useCallback(
    (
      snapshot: {
        friends: FriendConnection[];
        sharedPosts: SharedPost[];
        activeInvite: FriendInvite | null;
      },
      source: 'live' | 'cache',
      updatedAt: string | null
    ) => {
      friendsRef.current = snapshot.friends;
      sharedPostsRef.current = snapshot.sharedPosts;
      activeInviteRef.current = snapshot.activeInvite;
      setFriends(snapshot.friends);
      setSharedPosts(snapshot.sharedPosts);
      setActiveInvite(snapshot.activeInvite);
      setDataSource(source);
      setLastUpdatedAt(updatedAt);
    },
    []
  );

  const applySnapshot = useCallback(
    (
      snapshot: {
        friends: FriendConnection[];
        sharedPosts: SharedPost[];
        activeInvite: FriendInvite | null;
      },
      source: 'live' | 'cache',
      updatedAt: string | null
    ) => {
      commitSnapshot(
        {
          ...snapshot,
          activeInvite:
            suppressActiveInviteRef.current && snapshot.activeInvite ? null : snapshot.activeInvite,
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
      snapshot?: { friends: FriendConnection[]; sharedPosts: SharedPost[]; activeInvite: FriendInvite | null }
    ) => {
      const nextSnapshot = snapshot ?? {
        friends: friendsRef.current,
        sharedPosts: sharedPostsRef.current,
        activeInvite: activeInviteRef.current,
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

      const hydratedPosts = await Promise.all(
        posts.map(async (post) => {
          if (post.type !== 'photo') {
            return post;
          }

          const nextPhotoLocalUri =
            post.photoLocalUri ??
            (post.photoPath
              ? await downloadPhotoFromStorage(
                  SHARED_POST_MEDIA_BUCKET,
                  post.photoPath,
                  post.id
                ).catch(() => null)
              : null);

          const nextPairedVideoLocalUri =
            post.pairedVideoLocalUri ??
            (post.isLivePhoto && post.pairedVideoPath
              ? await downloadPairedVideoFromStorage(
                  SHARED_POST_MEDIA_BUCKET,
                  post.pairedVideoPath,
                  `${post.id}-motion`
                ).catch(() => null)
              : null);

          if (
            nextPhotoLocalUri === post.photoLocalUri &&
            nextPairedVideoLocalUri === (post.pairedVideoLocalUri ?? null)
          ) {
            return post;
          }

          return {
            ...post,
            photoLocalUri: nextPhotoLocalUri,
            pairedVideoLocalUri: nextPairedVideoLocalUri,
          };
        })
      );

      if (!isCurrentSharedFeedSession(sessionId, userUid)) {
        return;
      }

      const hydratedPostMap = new Map(hydratedPosts.map((post) => [post.id, post]));
      let didChange = false;

      const mergedSharedPosts = sharedPostsRef.current.map((post) => {
        const hydratedPost = hydratedPostMap.get(post.id);
        if (!hydratedPost) {
          return post;
        }

        const nextPhotoLocalUri = hydratedPost.photoLocalUri ?? post.photoLocalUri ?? null;
        const nextPairedVideoLocalUri =
          hydratedPost.pairedVideoLocalUri ?? post.pairedVideoLocalUri ?? null;

        if (
          nextPhotoLocalUri === post.photoLocalUri &&
          nextPairedVideoLocalUri === (post.pairedVideoLocalUri ?? null)
        ) {
          return post;
        }

        didChange = true;
        return {
          ...post,
          photoLocalUri: nextPhotoLocalUri,
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
      };

      commitSnapshot(nextSnapshot, source, updatedAt);
      await persistSnapshot(userUid, nextSnapshot);
      scheduleSharedFeedWidgetRefresh();
    },
    [
      commitSnapshot,
      isCurrentSharedFeedSession,
      persistSnapshot,
      scheduleSharedFeedWidgetRefresh,
    ]
  );

  const commitSnapshotAndPersist = useCallback(
    (
      userUid: string,
      snapshot: {
        friends: FriendConnection[];
        sharedPosts: SharedPost[];
        activeInvite: FriendInvite | null;
      },
      updatedAt: string,
      source: 'live' | 'cache' = 'live'
    ) => {
      applySnapshot(snapshot, source, updatedAt);
      void persistSnapshot(userUid, snapshot).finally(() => {
        scheduleSharedFeedWidgetRefresh();
      });
    },
    [applySnapshot, persistSnapshot, scheduleSharedFeedWidgetRefresh]
  );

  const hydrateFromCache = useCallback(async (userUid: string, sessionId: number) => {
    const snapshot = await getCachedSharedFeedSnapshot(userUid);
    if (!isCurrentSharedFeedSession(sessionId, userUid)) {
      return false;
    }
    applySnapshot(snapshot, 'cache', snapshot.lastUpdatedAt);
    setReady(true);
    void hydrateSharedPostMedia(
      userUid,
      sessionId,
      'cache',
      snapshot.lastUpdatedAt,
      snapshot.sharedPosts
    );
    return true;
  }, [applySnapshot, hydrateSharedPostMedia, isCurrentSharedFeedSession]);

  const refreshAll = useCallback(async () => {
    if (!enabled || !user) {
      commitSnapshot(
        {
          friends: [],
          sharedPosts: [],
          activeInvite: null,
        },
        'cache',
        null
      );
      suppressActiveInviteRef.current = false;
      createInvitePromiseRef.current = null;
      setLoading(false);
      setReady(true);
      return;
    }

    if (!isOnline) {
      setLoading(false);
      setReady(true);
      return;
    }

    setLoading(true);
    const userUid = user.uid;
    const sessionId = sharedFeedSessionRef.current;
    try {
      const snapshot = await fetchSharedFeed(user);
      if (!isCurrentSharedFeedSession(sessionId, userUid)) {
        return;
      }
      const updatedAt = new Date().toISOString();
      commitSnapshotAndPersist(userUid, snapshot, updatedAt);
      void hydrateSharedPostMedia(userUid, sessionId, 'live', updatedAt, snapshot.sharedPosts);
    } finally {
      if (isCurrentSharedFeedSession(sessionId, userUid)) {
        setLoading(false);
        setReady(true);
      }
    }
  }, [
    commitSnapshotAndPersist,
    enabled,
    hydrateSharedPostMedia,
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
    sharedFeedSessionRef.current += 1;
    const sessionId = sharedFeedSessionRef.current;

    if (!isReady) {
      return;
    }

    if (!enabled || !user) {
      commitSnapshot(
        {
          friends: [],
          sharedPosts: [],
          activeInvite: null,
        },
        'cache',
        null
      );
      suppressActiveInviteRef.current = false;
      createInvitePromiseRef.current = null;
      setLoading(false);
      setReady(true);
      if (previousUserUidRef.current) {
        void clearSharedFeedCache(previousUserUidRef.current);
      }
      previousUserUidRef.current = null;
      return;
    }

    previousUserUidRef.current = user.uid;
    commitSnapshot(
      {
        friends: [],
        sharedPosts: [],
        activeInvite: null,
      },
      'cache',
      null
    );
    setLoading(true);
    setReady(false);
    void hydrateFromCache(user.uid, sessionId)
      .catch(() => undefined)
      .finally(() => {
        if (sharedFeedSessionRef.current === sessionId && !isOnline) {
          setLoading(false);
          setReady(true);
        }
      });

    if (!isOnline) {
      return;
    }

    const unsubscribe = subscribeToSharedFeed(user, {
      onSnapshot: (snapshot) => {
        if (sharedFeedSessionRef.current !== sessionId || previousUserUidRef.current !== user.uid) {
          return;
        }
        const updatedAt = new Date().toISOString();
        commitSnapshotAndPersist(user.uid, snapshot, updatedAt);
        void hydrateSharedPostMedia(
          user.uid,
          sessionId,
          'live',
          updatedAt,
          snapshot.sharedPosts
        );
        setLoading(false);
        setReady(true);
      },
      onError: (error) => {
        if (sharedFeedSessionRef.current !== sessionId || previousUserUidRef.current !== user.uid) {
          return;
        }
        console.warn('Shared feed subscription failed:', getSharedFeedErrorMessage(error));
        setLoading(false);
        setReady(true);
      },
    });

    return unsubscribe;
  }, [commitSnapshotAndPersist, enabled, hydrateFromCache, isOnline, isReady, user]);

  useEffect(() => {
    if (!enabled || !user || !isReady) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' || !isOnline) {
        return;
      }

      void refreshAll().catch(() => undefined);
    });

    return () => {
      subscription.remove();
    };
  }, [enabled, isOnline, isReady, refreshAll, user]);

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

  return useMemo<SharedFeedStoreValue>(
    () => ({
      enabled,
      loading,
      ready,
      dataSource,
      lastUpdatedAt,
      friends,
      sharedPosts,
      activeInvite,
      refreshSharedFeed: refreshAll,
      createFriendInvite: async () => {
        requireOnline();
        if (activeInviteRef.current) {
          return activeInviteRef.current;
        }

        if (createInvitePromiseRef.current) {
          return createInvitePromiseRef.current;
        }

        const activeUser = requireUser();
        const sessionId = sharedFeedSessionRef.current;
        const invitePromise = createInvite(activeUser)
          .then((invite) => {
            if (!isCurrentSharedFeedSession(sessionId, activeUser.uid)) {
              return invite;
            }

            suppressActiveInviteRef.current = false;
            commitSnapshotAndPersist(
              activeUser.uid,
              {
                friends: friendsRef.current,
                sharedPosts: sharedPostsRef.current,
                activeInvite: invite,
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
        suppressActiveInviteRef.current = true;
        commitSnapshotAndPersist(
          activeUser.uid,
          {
            friends: friendsRef.current,
            sharedPosts: sharedPostsRef.current,
            activeInvite: activeInviteRef.current?.id === inviteId ? null : activeInviteRef.current,
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
          },
          new Date().toISOString()
        );
        void refreshAll().catch(() => undefined);
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
          },
          new Date().toISOString()
        );
        void refreshAll().catch(() => undefined);
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
          },
          new Date().toISOString()
        );
        void refreshAll().catch(() => undefined);
      },
      createSharedPost: async (note: Note, audienceUserIds?: string[]) => {
        requireOnline();
        const activeUser = requireUser();
        const sessionId = sharedFeedSessionRef.current;
        const nextAudience = Array.from(
          new Set([
            activeUser.uid,
            ...(audienceUserIds?.length
              ? audienceUserIds
              : friendsRef.current.map((friend) => friend.userId)),
          ].filter(Boolean))
        );
        const post = await createPost(activeUser, note, nextAudience);
        if (!isCurrentSharedFeedSession(sessionId, activeUser.uid)) {
          return post;
        }
        const nextSharedPosts = [post, ...sharedPostsRef.current.filter((item) => item.id !== post.id)];
        commitSnapshotAndPersist(
          activeUser.uid,
          {
            friends: friendsRef.current,
            sharedPosts: nextSharedPosts,
            activeInvite: activeInviteRef.current,
          },
          new Date().toISOString()
        );
        return post;
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
        const matchingPostIdSet = new Set(matchingPostIds);
        const nextSharedPosts = sharedPostsRef.current.filter(
          (post) =>
            !matchingPostIdSet.has(post.id) &&
            !(post.authorUid === activeUser.uid && post.sourceNoteId === noteId)
        );
        commitSnapshotAndPersist(
          activeUser.uid,
          {
            friends: friendsRef.current,
            sharedPosts: nextSharedPosts,
            activeInvite: activeInviteRef.current,
          },
          new Date().toISOString()
        );
      },
      deleteSharedNotes: async (noteIds: string[]) => {
        requireOnline();
        const activeUser = requireUser();
        const sessionId = sharedFeedSessionRef.current;
        const deletedPostIds = await deleteOwnedSharedPostsForNotes(activeUser, noteIds);
        if (!isCurrentSharedFeedSession(sessionId, activeUser.uid)) {
          return;
        }
        const deletedPostIdSet = new Set(deletedPostIds);
        const nextNoteIdSet = new Set(noteIds.filter((noteId) => noteId.trim()));
        const nextSharedPosts = sharedPostsRef.current.filter(
          (post) =>
            !deletedPostIdSet.has(post.id) &&
            !(post.authorUid === activeUser.uid && post.sourceNoteId && nextNoteIdSet.has(post.sourceNoteId))
        );
        commitSnapshotAndPersist(
          activeUser.uid,
          {
            friends: friendsRef.current,
            sharedPosts: nextSharedPosts,
            activeInvite: activeInviteRef.current,
          },
          new Date().toISOString()
        );
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
        commitSnapshotAndPersist(
          activeUser.uid,
          {
            friends: friendsRef.current,
            sharedPosts: nextSharedPosts,
            activeInvite: activeInviteRef.current,
          },
          new Date().toISOString()
        );
      },
    }),
    [
      activeInvite,
      commitSnapshot,
      commitSnapshotAndPersist,
      dataSource,
      enabled,
      friends,
      isOnline,
      lastUpdatedAt,
      loading,
      persistSnapshot,
      ready,
      refreshAll,
      isCurrentSharedFeedSession,
      requireOnline,
      requireUser,
      resolveOwnedPostIdsForNote,
      sharedPosts,
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

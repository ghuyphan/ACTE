import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Note } from '../services/database';
import {
  acceptFriendInvite as acceptInvite,
  createFriendInvite as createInvite,
  createSharedPost as createPost,
  deleteSharedPost as deletePost,
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
  clearSharedFeedCache,
  getCachedSharedFeedSnapshot,
  replaceCachedActiveInvite,
} from '../services/sharedFeedCache';
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
  removeFriend: (friendUid: string) => Promise<void>;
  createSharedPost: (note: Note, audienceUserIds?: string[]) => Promise<SharedPost>;
  updateSharedNote: (note: Note) => Promise<void>;
  deleteSharedNote: (noteId: string) => Promise<void>;
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

  useEffect(() => {
    friendsRef.current = friends;
  }, [friends]);

  useEffect(() => {
    sharedPostsRef.current = sharedPosts;
  }, [sharedPosts]);

  useEffect(() => {
    activeInviteRef.current = activeInvite;
  }, [activeInvite]);

  const enabled = isAuthAvailable;

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
      const nextActiveInvite =
        suppressActiveInviteRef.current && snapshot.activeInvite ? null : snapshot.activeInvite;
      friendsRef.current = snapshot.friends;
      sharedPostsRef.current = snapshot.sharedPosts;
      activeInviteRef.current = nextActiveInvite;
      setFriends(snapshot.friends);
      setSharedPosts(snapshot.sharedPosts);
      setActiveInvite(nextActiveInvite);
      setDataSource(source);
      setLastUpdatedAt(updatedAt);
    },
    []
  );

  const hydrateFromCache = useCallback(async (userUid: string) => {
    const snapshot = await getCachedSharedFeedSnapshot(userUid);
    applySnapshot(snapshot, 'cache', snapshot.lastUpdatedAt);
    setReady(true);
  }, [applySnapshot]);

  const refreshAll = useCallback(async () => {
    if (!enabled || !user) {
      setFriends([]);
      setSharedPosts([]);
      setActiveInvite(null);
      friendsRef.current = [];
      sharedPostsRef.current = [];
      activeInviteRef.current = null;
      suppressActiveInviteRef.current = false;
      createInvitePromiseRef.current = null;
      setLoading(false);
      setReady(true);
      setDataSource('cache');
      setLastUpdatedAt(null);
      return;
    }

    if (!isOnline) {
      setLoading(false);
      setReady(true);
      return;
    }

    setLoading(true);
    try {
      const snapshot = await fetchSharedFeed(user);
      applySnapshot(snapshot, 'live', new Date().toISOString());
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, [applySnapshot, enabled, isOnline, user]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!enabled || !user) {
      setFriends([]);
      setSharedPosts([]);
      setActiveInvite(null);
      activeInviteRef.current = null;
      suppressActiveInviteRef.current = false;
      createInvitePromiseRef.current = null;
      setLoading(false);
      setReady(true);
      setDataSource('cache');
      setLastUpdatedAt(null);
      if (previousUserUidRef.current) {
        void clearSharedFeedCache(previousUserUidRef.current);
      }
      previousUserUidRef.current = null;
      return;
    }

    previousUserUidRef.current = user.uid;
    setLoading(true);
    setReady(false);
    void hydrateFromCache(user.uid)
      .catch(() => undefined)
      .finally(() => {
        if (!isOnline) {
          setLoading(false);
          setReady(true);
        }
      });

    if (!isOnline) {
      return;
    }

    const unsubscribe = subscribeToSharedFeed(user, {
      onSnapshot: (snapshot) => {
        applySnapshot(snapshot, 'live', new Date().toISOString());
        setLoading(false);
        setReady(true);
      },
      onError: (error) => {
        console.warn('Shared feed subscription failed:', getSharedFeedErrorMessage(error));
        setLoading(false);
        setReady(true);
      },
    });

    return unsubscribe;
  }, [applySnapshot, enabled, hydrateFromCache, isOnline, isReady, user]);

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
      throw new Error('Sign in to share moments.');
    }

    return user;
  }, [enabled, user]);

  const requireOnline = useCallback(() => {
    if (!isOnline) {
      throw new Error('You are offline. Cached shared moments are still visible, but sharing actions need a connection.');
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
        const invitePromise = createInvite(activeUser)
          .then((invite) => {
            suppressActiveInviteRef.current = false;
            activeInviteRef.current = invite;
            setActiveInvite(invite);
            setDataSource('live');
            setLastUpdatedAt(new Date().toISOString());
            void replaceCachedActiveInvite(activeUser.uid, invite).catch(() => undefined);
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
        await revokeInvite(activeUser, inviteId);
        suppressActiveInviteRef.current = true;
        setDataSource('live');
        setLastUpdatedAt(new Date().toISOString());
        setActiveInvite((current) => {
          const nextInvite = current?.id === inviteId ? null : current;
          activeInviteRef.current = nextInvite;
          void replaceCachedActiveInvite(activeUser.uid, nextInvite).catch(() => undefined);
          return nextInvite;
        });
      },
      acceptFriendInvite: async (inviteValue: string) => {
        requireOnline();
        const activeUser = requireUser();
        const connection = await acceptInvite(activeUser, inviteValue);
        const nextFriends = upsertFriendConnection(friendsRef.current, connection);
        friendsRef.current = nextFriends;
        setFriends(nextFriends);
        setDataSource('live');
        setLastUpdatedAt(new Date().toISOString());
        void refreshAll().catch(() => undefined);
      },
      removeFriend: async (friendUid: string) => {
        requireOnline();
        const activeUser = requireUser();
        await deleteFriend(activeUser, friendUid);
        const nextFriends = friendsRef.current.filter((friend) => friend.userId !== friendUid);
        const nextSharedPosts = sharedPostsRef.current.filter((post) => post.authorUid !== friendUid);
        friendsRef.current = nextFriends;
        sharedPostsRef.current = nextSharedPosts;
        setFriends(nextFriends);
        setSharedPosts(nextSharedPosts);
        setDataSource('live');
        setLastUpdatedAt(new Date().toISOString());
        void refreshAll().catch(() => undefined);
      },
      createSharedPost: async (note: Note, audienceUserIds?: string[]) => {
        requireOnline();
        const activeUser = requireUser();
        const nextAudience = Array.from(
          new Set([
            activeUser.uid,
            ...(audienceUserIds?.length
              ? audienceUserIds
              : friendsRef.current.map((friend) => friend.userId)),
          ].filter(Boolean))
        );
        const post = await createPost(activeUser, note, nextAudience);
        sharedPostsRef.current = [post, ...sharedPostsRef.current.filter((item) => item.id !== post.id)];
        setSharedPosts((current) => [post, ...current.filter((item) => item.id !== post.id)]);
        setDataSource('live');
        setLastUpdatedAt(new Date().toISOString());
        return post;
      },
      updateSharedNote: async (note: Note) => {
        requireOnline();
        const activeUser = requireUser();
        let matchingPostIds = sharedPostsRef.current
          .filter((post) => post.authorUid === activeUser.uid && post.sourceNoteId === note.id)
          .map((post) => post.id);

        if (matchingPostIds.length === 0 && !ready) {
          await refreshAll();
          matchingPostIds = sharedPostsRef.current
            .filter((post) => post.authorUid === activeUser.uid && post.sourceNoteId === note.id)
            .map((post) => post.id);
        }

        if (matchingPostIds.length === 0) {
          matchingPostIds = await findOwnedSharedPostIdsForNote(activeUser, note.id);
        }

        await Promise.all(matchingPostIds.map((postId) => updatePost(activeUser, postId, note)));
        setDataSource('live');
        setLastUpdatedAt(new Date().toISOString());
      },
      deleteSharedNote: async (noteId: string) => {
        requireOnline();
        const activeUser = requireUser();
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

        await Promise.all(matchingPostIds.map((postId) => deletePost(activeUser, postId)));
        setDataSource('live');
        setLastUpdatedAt(new Date().toISOString());
      },
      deleteSharedPostById: async (postId: string) => {
        requireOnline();
        const activeUser = requireUser();
        await deletePost(activeUser, postId);
        sharedPostsRef.current = sharedPostsRef.current.filter((post) => post.id !== postId);
        setSharedPosts((current) => current.filter((post) => post.id !== postId));
        setDataSource('live');
        setLastUpdatedAt(new Date().toISOString());
      },
    }),
    [activeInvite, dataSource, enabled, friends, isOnline, lastUpdatedAt, loading, ready, refreshAll, requireOnline, requireUser, sharedPosts]
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

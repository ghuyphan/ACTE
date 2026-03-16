import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Note } from '../services/database';
import {
  acceptFriendInvite as acceptInvite,
  createFriendInvite as createInvite,
  createSharedPost as createPost,
  FriendConnection,
  FriendInvite,
  refreshSharedFeed as fetchSharedFeed,
  removeFriend as deleteFriend,
  revokeFriendInvite as revokeInvite,
  SharedPost,
} from '../services/sharedFeedService';
import { useAuth } from './useAuth';

interface SharedFeedStoreValue {
  enabled: boolean;
  loading: boolean;
  ready: boolean;
  friends: FriendConnection[];
  sharedPosts: SharedPost[];
  activeInvite: FriendInvite | null;
  refreshSharedFeed: () => Promise<void>;
  createFriendInvite: () => Promise<FriendInvite>;
  revokeFriendInvite: (inviteId: string) => Promise<void>;
  acceptFriendInvite: (inviteValue: string) => Promise<void>;
  removeFriend: (friendUid: string) => Promise<void>;
  createSharedPost: (note: Note, audienceUserIds?: string[]) => Promise<SharedPost>;
}

const SharedFeedStoreContext = createContext<SharedFeedStoreValue | undefined>(undefined);

function useSharedFeedStoreValue(): SharedFeedStoreValue {
  const { user, isAuthAvailable, isReady } = useAuth();
  const [friends, setFriends] = useState<FriendConnection[]>([]);
  const [sharedPosts, setSharedPosts] = useState<SharedPost[]>([]);
  const [activeInvite, setActiveInvite] = useState<FriendInvite | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const friendsRef = useRef<FriendConnection[]>([]);

  useEffect(() => {
    friendsRef.current = friends;
  }, [friends]);

  const enabled = isAuthAvailable;

  const refreshAll = useCallback(async () => {
    if (!enabled || !user) {
      setFriends([]);
      setSharedPosts([]);
      setActiveInvite(null);
      setReady(true);
      return;
    }

    setLoading(true);
    try {
      const snapshot = await fetchSharedFeed(user);
      setFriends(snapshot.friends);
      setSharedPosts(snapshot.sharedPosts);
      setActiveInvite(snapshot.activeInvite);
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, [enabled, user]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    void refreshAll().catch(() => {
      setReady(true);
    });
  }, [isReady, refreshAll]);

  const requireUser = useCallback(() => {
    if (!enabled || !user) {
      throw new Error('Sign in to share moments.');
    }

    return user;
  }, [enabled, user]);

  return useMemo<SharedFeedStoreValue>(
    () => ({
      enabled,
      loading,
      ready,
      friends,
      sharedPosts,
      activeInvite,
      refreshSharedFeed: refreshAll,
      createFriendInvite: async () => {
        const activeUser = requireUser();
        const invite = await createInvite(activeUser);
        setActiveInvite(invite);
        return invite;
      },
      revokeFriendInvite: async (inviteId: string) => {
        const activeUser = requireUser();
        await revokeInvite(activeUser, inviteId);
        setActiveInvite((current) => (current?.id === inviteId ? null : current));
      },
      acceptFriendInvite: async (inviteValue: string) => {
        const activeUser = requireUser();
        await acceptInvite(activeUser, inviteValue);
        await refreshAll();
      },
      removeFriend: async (friendUid: string) => {
        const activeUser = requireUser();
        await deleteFriend(activeUser, friendUid);
        await refreshAll();
      },
      createSharedPost: async (note: Note, audienceUserIds?: string[]) => {
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
        setSharedPosts((current) => [post, ...current.filter((item) => item.id !== post.id)]);
        return post;
      },
    }),
    [activeInvite, enabled, friends, loading, ready, refreshAll, requireUser, sharedPosts]
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

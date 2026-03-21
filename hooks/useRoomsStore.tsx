import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ENABLE_SHARED_ROOMS } from '../constants/features';
import { AppUser } from '../utils/appUser';
import { useAuth } from './useAuth';
import { useConnectivity } from './useConnectivity';
import { Note } from '../services/database';
import { clearAllCachedRooms, RoomMember, RoomPost, RoomSummary } from '../services/roomCache';
import {
  createRoom,
  createRoomInvite,
  createRoomPost,
  getRoomDetails,
  joinRoomByInvite,
  loadCachedRoomDetails,
  loadCachedRooms,
  loadRoomsCacheLastUpdatedAt,
  refreshRooms,
  removeRoomMember,
  renameRoom,
  revokeRoomInvite,
  RoomDetails,
  RoomInvite,
  shareNoteToRoom as shareRoomNote,
} from '../services/roomService';

interface RoomsStoreValue {
  enabled: boolean;
  loading: boolean;
  rooms: RoomSummary[];
  roomsReady: boolean;
  dataSource: 'live' | 'cache';
  lastUpdatedAt: string | null;
  refreshRooms: () => Promise<void>;
  getRoomDetails: (roomId: string, forceRefresh?: boolean) => Promise<RoomDetails | null>;
  createRoom: (name: string) => Promise<RoomSummary>;
  joinRoomByInvite: (inviteValue: string) => Promise<RoomSummary>;
  createInvite: (roomId: string) => Promise<RoomInvite>;
  revokeInvite: (roomId: string, inviteId: string) => Promise<void>;
  createRoomPost: (
    roomId: string,
    input: { text?: string; placeName?: string | null; photoLocalUri?: string | null }
  ) => Promise<void>;
  shareNoteToRoom: (roomId: string, note: Note) => Promise<void>;
  renameRoom: (roomId: string, nextName: string) => Promise<RoomSummary>;
  removeMember: (roomId: string, memberUserId: string) => Promise<void>;
  getCachedMembers: (roomId: string) => RoomMember[];
  getCachedPosts: (roomId: string) => RoomPost[];
  getCachedInvite: (roomId: string) => RoomInvite | null;
}

const RoomsStoreContext = createContext<RoomsStoreValue | undefined>(undefined);

type DetailMap = Record<string, RoomDetails>;

function useRoomsStoreValue(): RoomsStoreValue {
  const { user, isAuthAvailable, isReady } = useAuth();
  const { isOnline } = useConnectivity();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [detailMap, setDetailMap] = useState<DetailMap>({});
  const [loading, setLoading] = useState(false);
  const [roomsReady, setRoomsReady] = useState(false);
  const [dataSource, setDataSource] = useState<'live' | 'cache'>('cache');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const previousUserUidRef = useRef<string | null>(null);

  const enabled = ENABLE_SHARED_ROOMS && isAuthAvailable;

  const hydrateFromCache = useCallback(async (activeUser: AppUser) => {
    const [cachedRooms, cachedAt] = await Promise.all([
      loadCachedRooms(activeUser.uid),
      loadRoomsCacheLastUpdatedAt(activeUser.uid),
    ]);
    setRooms(cachedRooms);
    setLastUpdatedAt(cachedAt);
    setDataSource('cache');
    setRoomsReady(true);
  }, []);

  const refreshAllRooms = useCallback(async () => {
    if (!enabled || !user) {
      setRooms([]);
      setRoomsReady(true);
      return;
    }

    if (!isOnline) {
      setLoading(false);
      setRoomsReady(true);
      return;
    }

    setLoading(true);
    try {
      const nextRooms = await refreshRooms(user);
      setRooms(nextRooms);
      setDataSource('live');
      setLastUpdatedAt(new Date().toISOString());
    } finally {
      setLoading(false);
      setRoomsReady(true);
    }
  }, [enabled, isOnline, user]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!enabled || !user) {
      setRooms([]);
      setDetailMap({});
      setDataSource('cache');
      setLastUpdatedAt(null);
      setRoomsReady(true);
      if (previousUserUidRef.current) {
        void clearAllCachedRooms(previousUserUidRef.current);
      }
      previousUserUidRef.current = null;
      return;
    }

    previousUserUidRef.current = user.uid;

    void hydrateFromCache(user)
      .catch(() => undefined)
      .finally(() => {
        if (isOnline) {
          void refreshAllRooms().catch(() => undefined);
        }
      });
  }, [enabled, hydrateFromCache, isOnline, isReady, refreshAllRooms, user]);

  const requireUser = useCallback(() => {
    if (!enabled || !user) {
      throw new Error('Sign in to use rooms.');
    }

    return user;
  }, [enabled, user]);

  const getOfflineRoomError = useCallback(() => {
    return new Error('You are offline. Cached rooms are still available, but room changes need a connection.');
  }, []);

  const syncRoomDetails = useCallback((details: RoomDetails) => {
    setDetailMap((prev) => ({
      ...prev,
      [details.room.id]: details,
    }));
    setDataSource('live');
    setLastUpdatedAt(new Date().toISOString());
    setRooms((prev) => {
      const next = prev.filter((item) => item.id !== details.room.id);
      return [details.room, ...next].sort((a, b) =>
        (b.lastPostAt ?? b.updatedAt).localeCompare(a.lastPostAt ?? a.updatedAt)
      );
    });
  }, []);

  return useMemo<RoomsStoreValue>(
    () => ({
      enabled,
      loading,
      rooms,
      roomsReady,
      dataSource,
      lastUpdatedAt,
      refreshRooms: refreshAllRooms,
      getRoomDetails: async (roomId: string, forceRefresh = false) => {
        const activeUser = requireUser();
        const existing = detailMap[roomId];
        const cached = existing ?? (await loadCachedRoomDetails(activeUser.uid, roomId));

        if (!forceRefresh && cached) {
          setDetailMap((prev) => ({ ...prev, [roomId]: cached }));
          setDataSource('cache');
          if (isOnline) {
            void getRoomDetails(activeUser, roomId)
              .then((details) => {
                syncRoomDetails(details);
              })
              .catch(() => undefined);
          }
          return cached;
        }

        if (!isOnline) {
          return cached ?? null;
        }

        const details = await getRoomDetails(activeUser, roomId);
        syncRoomDetails(details);
        return details;
      },
      createRoom: async (name: string) => {
        if (!isOnline) {
          throw getOfflineRoomError();
        }
        const activeUser = requireUser();
        const room = await createRoom(activeUser, name);
        setDataSource('live');
        setLastUpdatedAt(new Date().toISOString());
        setRooms((prev) => [room, ...prev.filter((item) => item.id !== room.id)]);
        return room;
      },
      joinRoomByInvite: async (inviteValue: string) => {
        if (!isOnline) {
          throw getOfflineRoomError();
        }
        const activeUser = requireUser();
        const room = await joinRoomByInvite(activeUser, inviteValue);
        setDataSource('live');
        setLastUpdatedAt(new Date().toISOString());
        setRooms((prev) => [room, ...prev.filter((item) => item.id !== room.id)]);
        return room;
      },
      createInvite: async (roomId: string) => {
        if (!isOnline) {
          throw getOfflineRoomError();
        }
        const activeUser = requireUser();
        const invite = await createRoomInvite(activeUser, roomId);
        setDataSource('live');
        setLastUpdatedAt(new Date().toISOString());
        setDetailMap((prev) => {
          const current = prev[roomId];
          if (!current) {
            return prev;
          }

          return {
            ...prev,
            [roomId]: {
              ...current,
              activeInvite: invite,
            },
          };
        });
        return invite;
      },
      revokeInvite: async (roomId: string, inviteId: string) => {
        if (!isOnline) {
          throw getOfflineRoomError();
        }
        const activeUser = requireUser();
        await revokeRoomInvite(activeUser, roomId, inviteId);
        setDataSource('live');
        setLastUpdatedAt(new Date().toISOString());
        setDetailMap((prev) => {
          const current = prev[roomId];
          if (!current) {
            return prev;
          }

          return {
            ...prev,
            [roomId]: {
              ...current,
              activeInvite: null,
            },
          };
        });
      },
      createRoomPost: async (roomId: string, input) => {
        if (!isOnline) {
          throw getOfflineRoomError();
        }
        const activeUser = requireUser();
        const details = await createRoomPost(activeUser, roomId, input);
        syncRoomDetails(details);
      },
      shareNoteToRoom: async (roomId: string, note: Note) => {
        if (!isOnline) {
          throw getOfflineRoomError();
        }
        const activeUser = requireUser();
        const details = await shareRoomNote(activeUser, roomId, note);
        syncRoomDetails(details);
      },
      renameRoom: async (roomId: string, nextName: string) => {
        if (!isOnline) {
          throw getOfflineRoomError();
        }
        const activeUser = requireUser();
        const nextRoom = await renameRoom(activeUser, roomId, nextName);
        setDataSource('live');
        setLastUpdatedAt(new Date().toISOString());
        setRooms((prev) => prev.map((item) => (item.id === roomId ? nextRoom : item)));
        setDetailMap((prev) => {
          const current = prev[roomId];
          if (!current) {
            return prev;
          }

          return {
            ...prev,
            [roomId]: {
              ...current,
              room: nextRoom,
            },
          };
        });
        return nextRoom;
      },
      removeMember: async (roomId: string, memberUserId: string) => {
        if (!isOnline) {
          throw getOfflineRoomError();
        }
        const activeUser = requireUser();
        await removeRoomMember(activeUser, roomId, memberUserId);
        const details = await getRoomDetails(activeUser, roomId);
        syncRoomDetails(details);
      },
      getCachedMembers: (roomId: string) => detailMap[roomId]?.members ?? [],
      getCachedPosts: (roomId: string) => detailMap[roomId]?.posts ?? [],
      getCachedInvite: (roomId: string) => detailMap[roomId]?.activeInvite ?? null,
    }),
    [dataSource, detailMap, enabled, getOfflineRoomError, isOnline, lastUpdatedAt, loading, refreshAllRooms, requireUser, rooms, roomsReady, syncRoomDetails]
  );
}

export function RoomsProvider({ children }: { children: ReactNode }) {
  const value = useRoomsStoreValue();
  return <RoomsStoreContext.Provider value={value}>{children}</RoomsStoreContext.Provider>;
}

export function useRoomsStore() {
  const context = useContext(RoomsStoreContext);
  if (!context) {
    throw new Error('useRoomsStore must be used within a RoomsProvider');
  }

  return context;
}

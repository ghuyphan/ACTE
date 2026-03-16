import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { useAuth } from './useAuth';
import { Note } from '../services/database';
import { ENABLE_SHARED_ROOMS } from '../constants/features';
import { clearAllCachedRooms } from '../services/roomCache';
import {
  createRoom,
  createRoomInvite,
  createRoomPost,
  getRoomDetails,
  joinRoomByInvite,
  loadCachedRoomDetails,
  loadCachedRooms,
  refreshRooms,
  removeRoomMember,
  renameRoom,
  revokeRoomInvite,
  RoomDetails,
  RoomInvite,
  shareNoteToRoom as shareRoomNote,
} from '../services/roomService';
import { RoomMember, RoomPost, RoomSummary } from '../services/roomCache';

interface RoomsStoreValue {
  enabled: boolean;
  loading: boolean;
  rooms: RoomSummary[];
  roomsReady: boolean;
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
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [detailMap, setDetailMap] = useState<DetailMap>({});
  const [loading, setLoading] = useState(false);
  const [roomsReady, setRoomsReady] = useState(false);

  const enabled = ENABLE_SHARED_ROOMS && isAuthAvailable;

  const hydrateFromCache = useCallback(async (activeUser: FirebaseAuthTypes.User) => {
    const cachedRooms = await loadCachedRooms(activeUser.uid);
    setRooms(cachedRooms);
    setRoomsReady(true);
  }, []);

  const refreshAllRooms = useCallback(async () => {
    if (!enabled || !user) {
      setRooms([]);
      setRoomsReady(true);
      return;
    }

    setLoading(true);
    try {
      const nextRooms = await refreshRooms(user);
      setRooms(nextRooms);
    } finally {
      setLoading(false);
      setRoomsReady(true);
    }
  }, [enabled, user]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!enabled || !user) {
      setRooms([]);
      setDetailMap({});
      setRoomsReady(true);
      void clearAllCachedRooms();
      return;
    }

    void hydrateFromCache(user)
      .catch(() => undefined)
      .finally(() => {
        void refreshAllRooms().catch(() => undefined);
      });
  }, [enabled, hydrateFromCache, isReady, refreshAllRooms, user]);

  const requireUser = useCallback(() => {
    if (!enabled || !user) {
      throw new Error('Sign in to use rooms.');
    }

    return user;
  }, [enabled, user]);

  const syncRoomDetails = useCallback((details: RoomDetails) => {
    setDetailMap((prev) => ({
      ...prev,
      [details.room.id]: details,
    }));
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
      refreshRooms: refreshAllRooms,
      getRoomDetails: async (roomId: string, forceRefresh = false) => {
        const activeUser = requireUser();

        if (!forceRefresh) {
          const existing = detailMap[roomId];
          if (existing) {
            return existing;
          }

          const cached = await loadCachedRoomDetails(activeUser.uid, roomId);
          if (cached) {
            setDetailMap((prev) => ({ ...prev, [roomId]: cached }));
          }
        }

        const details = await getRoomDetails(activeUser, roomId);
        syncRoomDetails(details);
        return details;
      },
      createRoom: async (name: string) => {
        const activeUser = requireUser();
        const room = await createRoom(activeUser, name);
        setRooms((prev) => [room, ...prev.filter((item) => item.id !== room.id)]);
        return room;
      },
      joinRoomByInvite: async (inviteValue: string) => {
        const activeUser = requireUser();
        const room = await joinRoomByInvite(activeUser, inviteValue);
        setRooms((prev) => [room, ...prev.filter((item) => item.id !== room.id)]);
        return room;
      },
      createInvite: async (roomId: string) => {
        const activeUser = requireUser();
        const invite = await createRoomInvite(activeUser, roomId);
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
        const activeUser = requireUser();
        await revokeRoomInvite(activeUser, roomId, inviteId);
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
        const activeUser = requireUser();
        const details = await createRoomPost(activeUser, roomId, input);
        syncRoomDetails(details);
      },
      shareNoteToRoom: async (roomId: string, note: Note) => {
        const activeUser = requireUser();
        const details = await shareRoomNote(activeUser, roomId, note);
        syncRoomDetails(details);
      },
      renameRoom: async (roomId: string, nextName: string) => {
        const activeUser = requireUser();
        const nextRoom = await renameRoom(activeUser, roomId, nextName);
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
        const activeUser = requireUser();
        await removeRoomMember(activeUser, roomId, memberUserId);
        const details = await getRoomDetails(activeUser, roomId);
        syncRoomDetails(details);
      },
      getCachedMembers: (roomId: string) => detailMap[roomId]?.members ?? [],
      getCachedPosts: (roomId: string) => detailMap[roomId]?.posts ?? [],
      getCachedInvite: (roomId: string) => detailMap[roomId]?.activeInvite ?? null,
    }),
    [detailMap, enabled, loading, refreshAllRooms, requireUser, rooms, roomsReady, syncRoomDetails]
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

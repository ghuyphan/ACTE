const mockRemoteRooms = new Map<string, any>();
const mockRemoteMembers = new Map<string, Map<string, any>>();
const mockRemotePosts = new Map<string, Map<string, any>>();
const mockRemoteInvites = new Map<string, Map<string, any>>();

const mockReplaceCachedRooms = jest.fn<Promise<void>, [string, unknown[]]>(async () => undefined);
const mockUpsertCachedRoom = jest.fn<Promise<void>, [string, unknown]>(async () => undefined);
const mockReplaceCachedRoomMembers = jest.fn<Promise<void>, [string, string, unknown[]]>(async () => undefined);
const mockReplaceCachedRoomPosts = jest.fn<Promise<void>, [string, string, unknown[]]>(async () => undefined);
const mockSetCachedRoomReadState = jest.fn<Promise<void>, [string, string, string]>(async () => undefined);
const mockGetCachedRooms = jest.fn<Promise<unknown[]>, [string]>(async () => []);
const mockGetCachedRoomMembers = jest.fn<Promise<unknown[]>, [string, string]>(async () => []);
const mockGetCachedRoomPosts = jest.fn<Promise<unknown[]>, [string, string]>(async () => []);
const mockGetCachedRoomInvite = jest.fn<Promise<unknown | null>, [string, string]>(async () => null);
const mockUpsertCachedRoomInvite = jest.fn<Promise<void>, [string, unknown]>(async () => undefined);
const mockClearCachedRoomInvite = jest.fn<Promise<void>, [string, string]>(async () => undefined);
const mockClearCachedRoom = jest.fn<Promise<void>, [string, string]>(async () => undefined);
const mockGetRoomsCacheLastUpdatedAt = jest.fn<Promise<string | null>, [string]>(async () => null);

const mockUploadPhotoToStorage = jest.fn<Promise<string | null>, [string, string, string | null | undefined]>(
  async (_bucket: string, path: string) => path
);
const mockDownloadPhotoFromStorage = jest.fn<Promise<string | null>, [string, string, string]>(
  async (_bucket: string, path: string) => `file:///rooms/${path}`
);

function mockEnsureMapEntry<T>(map: Map<string, Map<string, T>>, key: string) {
  if (!map.has(key)) {
    map.set(key, new Map<string, T>());
  }

  return map.get(key)!;
}

function getRows(table: string, state: any) {
  let rows: any[] = [];

  if (table === 'rooms') {
    rows = Array.from(mockRemoteRooms.values());
  } else if (table === 'room_members') {
    const roomId = state.filters.find((item: any) => item.field === 'room_id')?.value;
    const userId = state.filters.find((item: any) => item.field === 'user_id')?.value;

    if (roomId) {
      rows = Array.from(mockEnsureMapEntry(mockRemoteMembers, String(roomId)).entries()).map(([id, data]) => ({
        user_id: id,
        room_id: roomId,
        ...data,
      }));
    } else if (userId) {
      rows = Array.from(mockRemoteMembers.entries()).flatMap(([nextRoomId, members]) => {
        const member = members.get(String(userId));
        return member ? [{ room_id: nextRoomId, user_id: userId, ...member }] : [];
      });
    }
  } else if (table === 'room_posts') {
    const roomId = state.filters.find((item: any) => item.field === 'room_id')?.value;
    rows = roomId
      ? Array.from(mockEnsureMapEntry(mockRemotePosts, String(roomId)).entries()).map(([id, data]) => ({
          id,
          room_id: roomId,
          ...data,
        }))
      : [];
  } else if (table === 'room_invites') {
    const roomId = state.filters.find((item: any) => item.field === 'room_id')?.value;
    rows = roomId
      ? Array.from(mockEnsureMapEntry(mockRemoteInvites, String(roomId)).entries()).map(([id, data]) => ({
          id,
          room_id: roomId,
          ...data,
        }))
      : [];
  }

  for (const filter of state.filters) {
    rows = rows.filter((row) => row?.[filter.field] === filter.value);
  }

  if (state.orderField) {
    rows = [...rows].sort((left, right) => {
      const leftValue = String(left?.[state.orderField!] ?? '');
      const rightValue = String(right?.[state.orderField!] ?? '');
      return state.ascending ? leftValue.localeCompare(rightValue) : rightValue.localeCompare(leftValue);
    });
  }

  if (typeof state.limitValue === 'number') {
    rows = rows.slice(0, state.limitValue);
  }

  return rows;
}

function applyUpdate(table: string, state: any, values: Record<string, unknown>) {
  const rows = getRows(table, state);

  for (const row of rows) {
    if (table === 'rooms') {
      mockRemoteRooms.set(row.id, { ...row, ...values });
    } else if (table === 'room_members') {
      mockEnsureMapEntry(mockRemoteMembers, row.room_id).set(row.user_id, { ...row, ...values });
    } else if (table === 'room_invites') {
      mockEnsureMapEntry(mockRemoteInvites, row.room_id).set(row.id, { ...row, ...values });
    }
  }
}

function mockCreateQueryBuilder(table: string) {
  const state = {
    filters: [] as Array<{ field: string; value: unknown }>,
    orderField: null as string | null,
    ascending: true,
    limitValue: null as number | null,
    updateValues: null as Record<string, unknown> | null,
    isCountHead: false,
  };

  const builder: any = {
    select: (_fields?: string, options?: { count?: 'exact'; head?: boolean }) => {
      state.isCountHead = Boolean(options?.count === 'exact' && options.head);
      return builder;
    },
    eq: (field: string, value: unknown) => {
      state.filters.push({ field, value });
      return builder;
    },
    order: (field: string, options?: { ascending?: boolean }) => {
      state.orderField = field;
      state.ascending = options?.ascending ?? true;
      return builder;
    },
    limit: (value: number) => {
      state.limitValue = value;
      return builder;
    },
    insert: async (value: Record<string, unknown>) => {
      if (table === 'room_invites') {
        mockEnsureMapEntry(mockRemoteInvites, String(value.room_id)).set(String(value.id), value);
      } else if (table === 'room_posts') {
        mockEnsureMapEntry(mockRemotePosts, String(value.room_id)).set(String(value.id), value);
      }

      return { error: null };
    },
    update: (value: Record<string, unknown>) => {
      state.updateValues = value;
      return builder;
    },
    maybeSingle: async () => ({
      data: getRows(table, state)[0] ?? null,
      error: null,
    }),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
      try {
        if (state.updateValues) {
          applyUpdate(table, state, state.updateValues);
          return Promise.resolve(resolve({ data: null, error: null }));
        }

        const rows = getRows(table, state);
        if (state.isCountHead) {
          return Promise.resolve(resolve({ data: null, count: rows.length, error: null }));
        }

        return Promise.resolve(resolve({ data: rows, error: null }));
      } catch (error) {
        if (reject) {
          return Promise.resolve(reject(error));
        }

        return Promise.reject(error);
      }
    },
  };

  return builder;
}

jest.mock('../services/roomCache', () => ({
  getCachedRooms: (userUid: string) => mockGetCachedRooms(userUid),
  getCachedRoomMembers: (userUid: string, roomId: string) => mockGetCachedRoomMembers(userUid, roomId),
  getCachedRoomPosts: (userUid: string, roomId: string) => mockGetCachedRoomPosts(userUid, roomId),
  getCachedRoomInvite: (userUid: string, roomId: string) => mockGetCachedRoomInvite(userUid, roomId),
  getRoomsCacheLastUpdatedAt: (userUid: string) => mockGetRoomsCacheLastUpdatedAt(userUid),
  replaceCachedRooms: (userUid: string, rooms: unknown[]) => mockReplaceCachedRooms(userUid, rooms),
  upsertCachedRoom: (userUid: string, room: unknown) => mockUpsertCachedRoom(userUid, room),
  replaceCachedRoomMembers: (userUid: string, roomId: string, members: unknown[]) =>
    mockReplaceCachedRoomMembers(userUid, roomId, members),
  replaceCachedRoomPosts: (userUid: string, roomId: string, posts: unknown[]) =>
    mockReplaceCachedRoomPosts(userUid, roomId, posts),
  setCachedRoomReadState: (userUid: string, roomId: string, lastReadAt: string) =>
    mockSetCachedRoomReadState(userUid, roomId, lastReadAt),
  upsertCachedRoomInvite: (userUid: string, invite: unknown) => mockUpsertCachedRoomInvite(userUid, invite),
  clearCachedRoomInvite: (userUid: string, roomId: string) => mockClearCachedRoomInvite(userUid, roomId),
  clearCachedRoom: (userUid: string, roomId: string) => mockClearCachedRoom(userUid, roomId),
}));

jest.mock('../services/remoteMedia', () => ({
  ROOM_POST_MEDIA_BUCKET: 'room-post-media',
  uploadPhotoToStorage: (bucket: string, path: string, localUri?: string | null) =>
    mockUploadPhotoToStorage(bucket, path, localUri),
  downloadPhotoFromStorage: (bucket: string, path: string, fileName: string) =>
    mockDownloadPhotoFromStorage(bucket, path, fileName),
  deletePhotoFromStorage: jest.fn(async () => undefined),
}));

jest.mock('../utils/supabase', () => ({
  getSupabase: () => ({
    from: (table: string) => mockCreateQueryBuilder(table),
    rpc: async (name: string, params: Record<string, unknown>) => {
      if (name === 'create_room_with_owner') {
        const now = '2026-03-21T00:00:00.000Z';
        mockRemoteRooms.set(String(params.room_id), {
          id: params.room_id,
          name: params.room_name,
          owner_user_id: 'owner-1',
          created_at: now,
          updated_at: now,
          last_post_at: null,
          cover_photo_path: null,
        });
        mockEnsureMapEntry(mockRemoteMembers, String(params.room_id)).set('owner-1', {
          role: 'owner',
          display_name_snapshot: 'Owner',
          photo_url_snapshot: null,
          joined_at: now,
          last_read_at: now,
        });
        return { error: null };
      }

      if (name === 'join_room_by_invite') {
        const invite = mockEnsureMapEntry(mockRemoteInvites, String(params.room_id)).get(String(params.invite_id));
        if (!invite || invite.token !== params.invite_token) {
          return { error: new Error('Invite not found.') };
        }

        mockEnsureMapEntry(mockRemoteMembers, String(params.room_id)).set('member-1', {
          role: 'member',
          display_name_snapshot: 'Member',
          photo_url_snapshot: null,
          joined_at: '2026-03-21T01:00:00.000Z',
          last_read_at: null,
          joined_via_invite_id: params.invite_id,
          joined_via_invite_token: params.invite_token,
        });
        return { error: null };
      }

      if (name === 'remove_room_member') {
        mockEnsureMapEntry(mockRemoteMembers, String(params.room_id)).delete(String(params.member_user_id));
        return { error: null };
      }

      return { error: null };
    },
  }),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'uuid-12345678',
}));

jest.mock('expo-linking', () => ({
  createURL: (_path: string, options: { queryParams?: Record<string, string> }) =>
    `noto://rooms/join?roomId=${options.queryParams?.roomId ?? ''}&inviteId=${options.queryParams?.inviteId ?? ''}&invite=${options.queryParams?.invite ?? ''}`,
  parse: (value: string) => {
    const roomMatch = value.match(/roomId=([^&]+)/);
    const inviteIdMatch = value.match(/inviteId=([^&]+)/);
    const inviteMatch = value.match(/invite=([^&]+)/);
    return {
      queryParams: {
        roomId: roomMatch ? decodeURIComponent(roomMatch[1] ?? '') : undefined,
        inviteId: inviteIdMatch ? decodeURIComponent(inviteIdMatch[1] ?? '') : undefined,
        invite: inviteMatch ? decodeURIComponent(inviteMatch[1] ?? '') : undefined,
      },
    };
  },
}));

import {
  createRoom,
  createRoomInvite,
  getRoomDetails,
  joinRoomByInvite,
  refreshRooms,
  shareNoteToRoom,
} from '../services/roomService';

const ownerUser = {
  id: 'owner-1',
  uid: 'owner-1',
  displayName: 'Owner',
  email: 'owner@example.com',
  photoURL: null,
  providerData: [],
} as any;

const memberUser = {
  id: 'member-1',
  uid: 'member-1',
  displayName: 'Member',
  email: 'member@example.com',
  photoURL: null,
  providerData: [],
} as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockRemoteRooms.clear();
  mockRemoteMembers.clear();
  mockRemotePosts.clear();
  mockRemoteInvites.clear();
});

describe('roomService', () => {
  it('creates a room and lists it back for the owner', async () => {
    const room = await createRoom(ownerUser, 'Trip room');
    const rooms = await refreshRooms(ownerUser);

    expect(room.name).toBe('Trip room');
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toEqual(
      expect.objectContaining({
        id: room.id,
        name: 'Trip room',
        memberCount: 1,
        currentUserRole: 'owner',
      })
    );
    expect(mockReplaceCachedRooms).toHaveBeenCalled();
  });

  it('joins a room via invite link and loads its members', async () => {
    const room = await createRoom(ownerUser, 'Family room');
    const invite = await createRoomInvite(ownerUser, room.id);

    const joinedRoom = await joinRoomByInvite(memberUser, invite.url);
    const details = await getRoomDetails(ownerUser, room.id);

    expect(joinedRoom.id).toBe(room.id);
    expect(details.members.map((member) => member.userId)).toEqual(
      expect.arrayContaining([ownerUser.id, memberUser.id])
    );
    expect(mockEnsureMapEntry(mockRemoteMembers, room.id).get(memberUser.id)).toEqual(
      expect.objectContaining({
        joined_via_invite_id: invite.id,
      })
    );
  });

  it('shares a photo note to a room and hydrates the room posts', async () => {
    const room = await createRoom(ownerUser, 'Photo room');
    const note = {
      id: 'note-1',
      type: 'photo',
      content: 'file:///photos/note-1.jpg',
      photoLocalUri: 'file:///photos/note-1.jpg',
      locationName: 'Saigon',
      moodEmoji: null,
    } as any;

    const details = await shareNoteToRoom(ownerUser, room.id, note);

    expect(mockUploadPhotoToStorage).toHaveBeenCalledWith(
      'room-post-media',
      expect.stringContaining(`${room.id}/room-post-`),
      'file:///photos/note-1.jpg'
    );
    expect(details.posts[0]).toEqual(
      expect.objectContaining({
        roomId: room.id,
        type: 'photo',
        sourceNoteId: 'note-1',
        photoLocalUri: expect.stringContaining('file:///rooms/'),
      })
    );
    expect(mockReplaceCachedRoomPosts).toHaveBeenCalled();
  });
});

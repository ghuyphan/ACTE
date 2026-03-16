const mockRemoteRooms = new Map<string, any>();
const mockRemoteMembers = new Map<string, Map<string, any>>();
const mockRemotePosts = new Map<string, Map<string, any>>();
const mockRemoteInvites = new Map<string, Map<string, any>>();
const mockRemoteMembershipIndices = new Map<string, Map<string, any>>();

const mockReplaceCachedRooms = jest.fn<Promise<void>, [string, unknown[]]>(async () => undefined);
const mockUpsertCachedRoom = jest.fn<Promise<void>, [string, unknown]>(async () => undefined);
const mockReplaceCachedRoomMembers = jest.fn<Promise<void>, [string, string, unknown[]]>(async () => undefined);
const mockReplaceCachedRoomPosts = jest.fn<Promise<void>, [string, string, unknown[]]>(async () => undefined);
const mockSetCachedRoomReadState = jest.fn<Promise<void>, [string, string, string]>(async () => undefined);
const mockGetCachedRooms = jest.fn<Promise<unknown[]>, [string]>(async () => []);
const mockGetCachedRoomMembers = jest.fn<Promise<unknown[]>, [string, string]>(async () => []);
const mockGetCachedRoomPosts = jest.fn<Promise<unknown[]>, [string, string]>(async () => []);
const mockClearCachedRoom = jest.fn<Promise<void>, [string, string]>(async () => undefined);

function mockEnsureMapEntry<T>(map: Map<string, Map<string, T>>, key: string) {
  if (!map.has(key)) {
    map.set(key, new Map<string, T>());
  }

  return map.get(key)!;
}

function mockCreateDoc(path: string[], data: unknown) {
  return {
    id: path[path.length - 1]!,
    ref: { path },
    data: () => data,
  };
}

function mockGetSortedDocs(values: Array<{ id: string; data: any }>, field: string, direction: 'asc' | 'desc') {
  return [...values].sort((a, b) => {
    const left = String(a.data?.[field] ?? '');
    const right = String(b.data?.[field] ?? '');
    if (direction === 'desc') {
      return right.localeCompare(left);
    }
    return left.localeCompare(right);
  });
}

jest.mock('../services/roomCache', () => ({
  getCachedRooms: (userUid: string) => mockGetCachedRooms(userUid),
  getCachedRoomMembers: (userUid: string, roomId: string) => mockGetCachedRoomMembers(userUid, roomId),
  getCachedRoomPosts: (userUid: string, roomId: string) => mockGetCachedRoomPosts(userUid, roomId),
  replaceCachedRooms: (userUid: string, rooms: unknown[]) => mockReplaceCachedRooms(userUid, rooms),
  upsertCachedRoom: (userUid: string, room: unknown) => mockUpsertCachedRoom(userUid, room),
  replaceCachedRoomMembers: (userUid: string, roomId: string, members: unknown[]) =>
    mockReplaceCachedRoomMembers(userUid, roomId, members),
  replaceCachedRoomPosts: (userUid: string, roomId: string, posts: unknown[]) =>
    mockReplaceCachedRoomPosts(userUid, roomId, posts),
  setCachedRoomReadState: (userUid: string, roomId: string, lastReadAt: string) =>
    mockSetCachedRoomReadState(userUid, roomId, lastReadAt),
  clearCachedRoom: (userUid: string, roomId: string) => mockClearCachedRoom(userUid, roomId),
}));

jest.mock('../services/photoStorage', () => ({
  readPhotoAsBase64: jest.fn(async () => 'photo-base64'),
  writePhotoFromBase64: jest.fn(async (id: string) => `file:///rooms/${id}.jpg`),
}));

jest.mock('../utils/firebase', () => ({
  getFirestore: () => ({}),
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

jest.mock('@react-native-firebase/firestore', () => ({
  __esModule: true,
  collection: (_firestore: unknown, ...path: string[]) => ({ kind: 'collection', path }),
  doc: (_firestore: unknown, ...path: string[]) => ({ kind: 'doc', path, id: path[path.length - 1] }),
  query: (ref: any, ...constraints: any[]) => ({ kind: 'query', ref, constraints }),
  where: (field: string, op: string, value: unknown) => ({ type: 'where', field, op, value }),
  orderBy: (field: string, direction: 'asc' | 'desc' = 'asc') => ({ type: 'orderBy', field, direction }),
  limit: (value: number) => ({ type: 'limit', value }),
  serverTimestamp: () => 'SERVER_TIMESTAMP',
  setDoc: async (ref: any, data: any) => {
    const path = ref.path as string[];
    if (path.length === 2 && path[0] === 'rooms') {
      mockRemoteRooms.set(path[1]!, data);
      return;
    }
    if (path.length === 4 && path[0] === 'rooms' && path[2] === 'members') {
      mockEnsureMapEntry(mockRemoteMembers, path[1]!).set(path[3]!, data);
      return;
    }
    if (path.length === 4 && path[0] === 'rooms' && path[2] === 'posts') {
      mockEnsureMapEntry(mockRemotePosts, path[1]!).set(path[3]!, data);
      return;
    }
    if (path.length === 4 && path[0] === 'rooms' && path[2] === 'invites') {
      mockEnsureMapEntry(mockRemoteInvites, path[1]!).set(path[3]!, data);
      return;
    }
    if (path.length === 4 && path[0] === 'users' && path[2] === 'roomMemberships') {
      mockEnsureMapEntry(mockRemoteMembershipIndices, path[1]!).set(path[3]!, data);
    }
  },
  updateDoc: async (ref: any, data: any) => {
    const path = ref.path as string[];
    if (path.length === 2 && path[0] === 'rooms') {
      mockRemoteRooms.set(path[1]!, { ...(mockRemoteRooms.get(path[1]!) ?? {}), ...data });
      return;
    }
    if (path.length === 4 && path[0] === 'rooms' && path[2] === 'members') {
      const roomMembers = mockEnsureMapEntry(mockRemoteMembers, path[1]!);
      roomMembers.set(path[3]!, { ...(roomMembers.get(path[3]!) ?? {}), ...data });
      return;
    }
    if (path.length === 4 && path[0] === 'rooms' && path[2] === 'invites') {
      const invites = mockEnsureMapEntry(mockRemoteInvites, path[1]!);
      invites.set(path[3]!, { ...(invites.get(path[3]!) ?? {}), ...data });
    }
  },
  deleteDoc: async (ref: any) => {
    const path = ref.path as string[];
    if (path.length === 4 && path[0] === 'rooms' && path[2] === 'members') {
      mockEnsureMapEntry(mockRemoteMembers, path[1]!).delete(path[3]!);
      return;
    }
    if (path.length === 4 && path[0] === 'users' && path[2] === 'roomMemberships') {
      mockEnsureMapEntry(mockRemoteMembershipIndices, path[1]!).delete(path[3]!);
    }
  },
  getDoc: async (ref: any) => {
    const path = ref.path as string[];
    let value: unknown;
    if (path.length === 2 && path[0] === 'rooms') {
      value = mockRemoteRooms.get(path[1]!);
    } else if (path.length === 4 && path[0] === 'rooms' && path[2] === 'members') {
      value = mockEnsureMapEntry(mockRemoteMembers, path[1]!).get(path[3]!);
    }

    return {
      exists: () => value !== undefined,
      data: () => value,
    };
  },
  getDocs: async (refOrQuery: any) => {
    const target = refOrQuery.kind === 'query' ? refOrQuery.ref : refOrQuery;
    const constraints = refOrQuery.kind === 'query' ? refOrQuery.constraints : [];
    const orderConstraint = constraints.find((item: any) => item.type === 'orderBy');
    const limitConstraint = constraints.find((item: any) => item.type === 'limit');
    const whereConstraint = constraints.find((item: any) => item.type === 'where');

    let docs: Array<{ id: string; data: any }> = [];
    if (target.kind === 'collection') {
      const path = target.path as string[];
      if (path.length === 3 && path[0] === 'users' && path[2] === 'roomMemberships') {
        docs = Array.from(mockEnsureMapEntry(mockRemoteMembershipIndices, path[1]!).entries()).map(([id, data]) => ({
          id,
          data,
        }));
      } else if (path.length === 3 && path[0] === 'rooms' && path[2] === 'members') {
        docs = Array.from(mockEnsureMapEntry(mockRemoteMembers, path[1]!).entries()).map(([id, data]) => ({
          id,
          data,
        }));
      } else if (path.length === 3 && path[0] === 'rooms' && path[2] === 'posts') {
        docs = Array.from(mockEnsureMapEntry(mockRemotePosts, path[1]!).entries()).map(([id, data]) => ({
          id,
          data,
        }));
      } else if (path.length === 3 && path[0] === 'rooms' && path[2] === 'invites') {
        docs = Array.from(mockEnsureMapEntry(mockRemoteInvites, path[1]!).entries()).map(([id, data]) => ({
          id,
          data,
        }));
      }
    } else if (target.kind === 'collectionGroup' && target.collectionId === 'invites' && whereConstraint) {
      docs = Array.from(mockRemoteInvites.entries()).flatMap(([roomId, inviteMap]) =>
        Array.from(inviteMap.entries())
          .filter(([, data]) => data?.[whereConstraint.field] === whereConstraint.value)
          .map(([id, data]) => ({
            id,
            data: { ...data, roomId },
          }))
      );
    }

    if (orderConstraint) {
      docs = mockGetSortedDocs(docs, orderConstraint.field, orderConstraint.direction);
    }

    if (limitConstraint) {
      docs = docs.slice(0, limitConstraint.value);
    }

    return {
      docs: docs.map((item) => mockCreateDoc(['mock', item.id], item.data)),
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
  uid: 'owner-1',
  displayName: 'Owner',
  email: 'owner@example.com',
  photoURL: null,
} as any;

const memberUser = {
  uid: 'member-1',
  displayName: 'Member',
  email: 'member@example.com',
  photoURL: null,
} as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockRemoteRooms.clear();
  mockRemoteMembers.clear();
  mockRemotePosts.clear();
  mockRemoteInvites.clear();
  mockRemoteMembershipIndices.clear();
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
      expect.arrayContaining(['owner-1', 'member-1'])
    );
  });

  it('shares a personal note into a room as a copied post', async () => {
    const room = await createRoom(ownerUser, 'Weekend');

    const details = await shareNoteToRoom(ownerUser, room.id, {
      id: 'note-1',
      type: 'text',
      content: 'Bring the spicy dipping sauce',
      photoLocalUri: null,
      photoRemoteBase64: null,
      locationName: 'Pho Hoa',
      latitude: 10.77,
      longitude: 106.69,
      radius: 150,
      isFavorite: false,
      createdAt: '2026-03-10T00:00:00.000Z',
      updatedAt: null,
    });

    expect(details.posts).toHaveLength(1);
    expect(details.posts[0]).toEqual(
      expect.objectContaining({
        origin: 'shared_note',
        sourceNoteId: 'note-1',
        placeName: 'Pho Hoa',
        text: 'Bring the spicy dipping sauce',
      })
    );
  });
});

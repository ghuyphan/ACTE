const mockUsers = new Map<string, any>();
const mockFriendInvites = new Map<string, any>();
const mockSharedPosts = new Map<string, any>();
const mockFriends = new Map<string, Map<string, any>>();

function mockEnsureFriendMap(userUid: string) {
  if (!mockFriends.has(userUid)) {
    mockFriends.set(userUid, new Map<string, any>());
  }

  return mockFriends.get(userUid)!;
}

function mockCreateSnapshot(path: string[], data: unknown) {
  return {
    id: path[path.length - 1]!,
    ref: { path },
    exists: () => data !== undefined,
    data: () => data,
  };
}

function mockSortDocs(
  docs: Array<{ id: string; data: Record<string, any> }>,
  field: string,
  direction: 'asc' | 'desc'
) {
  return [...docs].sort((left, right) => {
    const a = String(left.data?.[field] ?? '');
    const b = String(right.data?.[field] ?? '');
    return direction === 'desc' ? b.localeCompare(a) : a.localeCompare(b);
  });
}

jest.mock('../services/photoStorage', () => ({
  readPhotoAsBase64: jest.fn(async () => 'photo-base64'),
  writePhotoFromBase64: jest.fn(async (id: string) => `file:///shared/${id}.jpg`),
}));

jest.mock('../utils/firebase', () => ({
  getFirestore: () => ({}),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'uuid-12345678',
}));

jest.mock('expo-linking', () => ({
  createURL: (_path: string, options: { queryParams?: Record<string, string> }) =>
    `noto://friends/join?inviteId=${options.queryParams?.inviteId ?? ''}&invite=${options.queryParams?.invite ?? ''}`,
  parse: (value: string) => {
    const inviteIdMatch = value.match(/inviteId=([^&]+)/);
    const inviteMatch = value.match(/invite=([^&]+)/);
    return {
      queryParams: {
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
  setDoc: async (ref: any, data: any, options?: { merge?: boolean }) => {
    const path = ref.path as string[];

    if (path.length === 2 && path[0] === 'users') {
      const current = mockUsers.get(path[1]!);
      mockUsers.set(path[1]!, options?.merge ? { ...(current ?? {}), ...data } : data);
      return;
    }

    if (path.length === 2 && path[0] === 'friendInvites') {
      mockFriendInvites.set(path[1]!, data);
      return;
    }

    if (path.length === 2 && path[0] === 'sharedPosts') {
      mockSharedPosts.set(path[1]!, data);
      return;
    }

    if (path.length === 4 && path[0] === 'users' && path[2] === 'friends') {
      const current = mockEnsureFriendMap(path[1]!).get(path[3]!);
      mockEnsureFriendMap(path[1]!).set(path[3]!, options?.merge ? { ...(current ?? {}), ...data } : data);
    }
  },
  updateDoc: async (ref: any, data: any) => {
    const path = ref.path as string[];

    if (path.length === 2 && path[0] === 'friendInvites') {
      mockFriendInvites.set(path[1]!, { ...(mockFriendInvites.get(path[1]!) ?? {}), ...data });
      return;
    }

    if (path.length === 2 && path[0] === 'sharedPosts') {
      mockSharedPosts.set(path[1]!, { ...(mockSharedPosts.get(path[1]!) ?? {}), ...data });
      return;
    }

    if (path.length === 4 && path[0] === 'users' && path[2] === 'friends') {
      mockEnsureFriendMap(path[1]!).set(path[3]!, {
        ...(mockEnsureFriendMap(path[1]!).get(path[3]!) ?? {}),
        ...data,
      });
    }
  },
  deleteDoc: async (ref: any) => {
    const path = ref.path as string[];

    if (path.length === 4 && path[0] === 'users' && path[2] === 'friends') {
      mockEnsureFriendMap(path[1]!).delete(path[3]!);
    }
  },
  getDoc: async (ref: any) => {
    const path = ref.path as string[];
    let value: unknown;

    if (path.length === 2 && path[0] === 'users') {
      value = mockUsers.get(path[1]!);
    } else if (path.length === 2 && path[0] === 'friendInvites') {
      value = mockFriendInvites.get(path[1]!);
    } else if (path.length === 4 && path[0] === 'users' && path[2] === 'friends') {
      value = mockEnsureFriendMap(path[1]!).get(path[3]!);
    }

    return mockCreateSnapshot(path, value);
  },
  getDocs: async (refOrQuery: any) => {
    const target = refOrQuery.kind === 'query' ? refOrQuery.ref : refOrQuery;
    const constraints = refOrQuery.kind === 'query' ? refOrQuery.constraints : [];
    const whereConstraint = constraints.find((item: any) => item.type === 'where');
    const orderConstraint = constraints.find((item: any) => item.type === 'orderBy');
    const limitConstraint = constraints.find((item: any) => item.type === 'limit');

    let docs: Array<{ id: string; data: Record<string, any> }> = [];

    if (target.kind === 'collection') {
      const path = target.path as string[];

      if (path.length === 1 && path[0] === 'friendInvites') {
        docs = Array.from(mockFriendInvites.entries()).map(([id, data]) => ({ id, data }));
      } else if (path.length === 1 && path[0] === 'sharedPosts') {
        docs = Array.from(mockSharedPosts.entries()).map(([id, data]) => ({ id, data }));
      } else if (path.length === 3 && path[0] === 'users' && path[2] === 'friends') {
        docs = Array.from(mockEnsureFriendMap(path[1]!).entries()).map(([id, data]) => ({ id, data }));
      }
    }

    if (whereConstraint) {
      docs = docs.filter(({ data }) => {
        if (whereConstraint.op === '==') {
          return data?.[whereConstraint.field] === whereConstraint.value;
        }

        if (whereConstraint.op === 'array-contains') {
          return Array.isArray(data?.[whereConstraint.field]) &&
            data[whereConstraint.field].includes(whereConstraint.value);
        }

        return true;
      });
    }

    if (orderConstraint) {
      docs = mockSortDocs(docs, orderConstraint.field, orderConstraint.direction);
    }

    if (limitConstraint) {
      docs = docs.slice(0, limitConstraint.value);
    }

    return {
      docs: docs.map((item) => mockCreateSnapshot(['mock', item.id], item.data)),
    };
  },
}));

import {
  acceptFriendInvite,
  createFriendInvite,
  createSharedPost,
  refreshSharedFeed,
  removeFriend,
} from '../services/sharedFeedService';

const ownerUser = {
  uid: 'owner-1',
  displayName: 'Owner',
  email: 'owner@example.com',
  photoURL: 'https://example.com/owner.jpg',
} as any;

const friendUser = {
  uid: 'friend-1',
  displayName: 'Friend',
  email: 'friend@example.com',
  photoURL: 'https://example.com/friend.jpg',
} as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockUsers.clear();
  mockFriendInvites.clear();
  mockSharedPosts.clear();
  mockFriends.clear();

  mockUsers.set(ownerUser.uid, {
    displayName: ownerUser.displayName,
    photoURL: ownerUser.photoURL,
  });
  mockUsers.set(friendUser.uid, {
    displayName: friendUser.displayName,
    photoURL: friendUser.photoURL,
  });
});

describe('sharedFeedService', () => {
  it('creates a friend invite and accepts it into bilateral friendships', async () => {
    const invite = await createFriendInvite(ownerUser);
    const connection = await acceptFriendInvite(friendUser, invite.url);

    expect(invite.url).toContain(`inviteId=${invite.id}`);
    expect(connection.userId).toBe(ownerUser.uid);
    expect(mockEnsureFriendMap(friendUser.uid).get(ownerUser.uid)).toEqual(
      expect.objectContaining({
        userId: ownerUser.uid,
        createdByInviteId: invite.id,
      })
    );
    expect(mockEnsureFriendMap(ownerUser.uid).get(friendUser.uid)).toEqual(
      expect.objectContaining({
        userId: friendUser.uid,
        createdByInviteId: invite.id,
      })
    );
    expect(mockFriendInvites.get(invite.id)).toEqual(
      expect.objectContaining({
        acceptedByUid: friendUser.uid,
      })
    );
  });

  it('publishes shared photo posts and returns them in descending feed order', async () => {
    mockEnsureFriendMap(ownerUser.uid).set(friendUser.uid, {
      userId: friendUser.uid,
      displayNameSnapshot: friendUser.displayName,
      photoURLSnapshot: friendUser.photoURL,
      friendedAt: '2026-03-16T00:00:00.000Z',
      lastSharedAt: null,
      createdByInviteId: 'invite-1',
    });
    mockEnsureFriendMap(friendUser.uid).set(ownerUser.uid, {
      userId: ownerUser.uid,
      displayNameSnapshot: ownerUser.displayName,
      photoURLSnapshot: ownerUser.photoURL,
      friendedAt: '2026-03-16T00:00:00.000Z',
      lastSharedAt: null,
      createdByInviteId: 'invite-1',
    });

    const dateNowSpy = jest.spyOn(Date, 'now');
    dateNowSpy.mockReturnValueOnce(1_710_000_000_000);
    const firstPost = await createSharedPost(
      ownerUser,
      {
        id: 'note-photo-1',
        type: 'photo',
        content: 'file:///photos/one.jpg',
        photoLocalUri: 'file:///photos/one.jpg',
        photoRemoteBase64: null,
        locationName: 'Coffee shop',
        latitude: 10.77,
        longitude: 106.69,
        radius: 150,
        isFavorite: false,
        createdAt: '2026-03-15T00:00:00.000Z',
        updatedAt: null,
      },
      [ownerUser.uid, friendUser.uid]
    );
    dateNowSpy.mockReturnValueOnce(1_710_000_000_500);
    const secondPost = await createSharedPost(
      friendUser,
      {
        id: 'note-text-1',
        type: 'text',
        content: 'Late-night noodles',
        photoLocalUri: null,
        photoRemoteBase64: null,
        locationName: 'District 1',
        latitude: 10.78,
        longitude: 106.68,
        radius: 150,
        isFavorite: false,
        createdAt: '2026-03-16T00:00:00.000Z',
        updatedAt: null,
      },
      [friendUser.uid, ownerUser.uid]
    );
    dateNowSpy.mockRestore();
    mockSharedPosts.set(firstPost.id, {
      ...(mockSharedPosts.get(firstPost.id) ?? {}),
      createdAt: '2026-03-16T00:00:00.000Z',
    });
    mockSharedPosts.set(secondPost.id, {
      ...(mockSharedPosts.get(secondPost.id) ?? {}),
      createdAt: '2026-03-16T00:00:01.000Z',
    });

    const feed = await refreshSharedFeed(ownerUser);

    expect(firstPost.photoLocalUri).toContain('shared-post-');
    expect(mockSharedPosts.get(firstPost.id)).toEqual(
      expect.objectContaining({
        photoRemoteBase64: 'photo-base64',
      })
    );
    expect(feed.sharedPosts).toHaveLength(2);
    expect(feed.sharedPosts[0]).toEqual(
      expect.objectContaining({
        authorUid: friendUser.uid,
        text: 'Late-night noodles',
      })
    );
    expect(feed.sharedPosts[1]).toEqual(
      expect.objectContaining({
        authorUid: ownerUser.uid,
        placeName: 'Coffee shop',
      })
    );
  });

  it('removes both sides of a friendship', async () => {
    mockEnsureFriendMap(ownerUser.uid).set(friendUser.uid, { userId: friendUser.uid });
    mockEnsureFriendMap(friendUser.uid).set(ownerUser.uid, { userId: ownerUser.uid });

    await removeFriend(ownerUser, friendUser.uid);

    expect(mockEnsureFriendMap(ownerUser.uid).has(friendUser.uid)).toBe(false);
    expect(mockEnsureFriendMap(friendUser.uid).has(ownerUser.uid)).toBe(false);
  });
});

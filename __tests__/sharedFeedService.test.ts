const mockFriendInvites = new Map<string, any>();
const mockSharedPosts = new Map<string, any>();
const mockFriendships = new Map<string, Map<string, any>>();
const mockPublicProfiles = new Map<string, { displayNameSnapshot: string | null; photoURLSnapshot: string | null }>();
let mockUuidCounter = 0;
let mockSessionUserId = 'owner-1';

function mockEnsureFriendMap(userId: string) {
  if (!mockFriendships.has(userId)) {
    mockFriendships.set(userId, new Map<string, any>());
  }

  return mockFriendships.get(userId)!;
}

function getFriendshipRows(userId: string) {
  return Array.from(mockEnsureFriendMap(userId).entries()).map(([friendId, data]) => ({
    friend_user_id: friendId,
    ...data,
  }));
}

function mockCreateQueryBuilder(table: string) {
  const state = {
    filters: [] as Array<{ type: 'eq' | 'in' | 'contains'; field: string; value: unknown }>,
    orderField: null as string | null,
    orderAscending: true,
    limitValue: null as number | null,
    updateValues: null as Record<string, unknown> | null,
    shouldDelete: false,
  };

  const builder: any = {
    select: () => builder,
    eq: (field: string, value: unknown) => {
      state.filters.push({ type: 'eq', field, value });
      return builder;
    },
    in: (field: string, value: unknown) => {
      state.filters.push({ type: 'in', field, value });
      return builder;
    },
    contains: (field: string, value: unknown) => {
      state.filters.push({ type: 'contains', field, value });
      return builder;
    },
    order: (field: string, options?: { ascending?: boolean }) => {
      state.orderField = field;
      state.orderAscending = options?.ascending ?? true;
      return builder;
    },
    limit: (value: number) => {
      state.limitValue = value;
      return builder;
    },
    upsert: async (value: Record<string, unknown>) => {
      if (table === 'friend_invites') {
        mockFriendInvites.set(String(value.id), value);
      }

      return { error: null };
    },
    insert: async (value: Record<string, unknown>) => {
      if (table === 'shared_posts') {
        mockSharedPosts.set(String(value.id), value);
      }

      return { error: null };
    },
    update: (value: Record<string, unknown>) => {
      state.updateValues = value;
      return builder;
    },
    delete: () => {
      state.shouldDelete = true;
      return builder;
    },
    maybeSingle: async () => {
      const rows = executeSelect(table, state);
      return {
        data: rows[0] ?? null,
        error: null,
      };
    },
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
      try {
        if (state.updateValues) {
          applyUpdate(table, state, state.updateValues);
          return Promise.resolve(resolve({ data: null, error: null }));
        }

        if (state.shouldDelete) {
          applyDelete(table, state);
          return Promise.resolve(resolve({ data: null, error: null }));
        }

        return Promise.resolve(resolve({ data: executeSelect(table, state), error: null }));
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

function executeSelect(table: string, state: any) {
  let rows: any[] = [];

  if (table === 'friendships') {
    const userId = state.filters.find((item: any) => item.type === 'eq' && item.field === 'user_id')?.value;
    rows = userId ? getFriendshipRows(String(userId)).map((row) => ({ user_id: userId, ...row })) : [];
  } else if (table === 'friend_invites') {
    rows = Array.from(mockFriendInvites.values());
  } else if (table === 'shared_posts') {
    rows = Array.from(mockSharedPosts.values());
  }

  for (const filter of state.filters) {
    if (filter.type === 'eq') {
      rows = rows.filter((row) => row?.[filter.field] === filter.value);
    } else if (filter.type === 'in') {
      const values = Array.isArray(filter.value) ? filter.value : [];
      rows = rows.filter((row) => values.includes(row?.[filter.field]));
    } else if (filter.type === 'contains') {
      const required = Array.isArray(filter.value) ? filter.value : [];
      rows = rows.filter((row) => {
        const target = Array.isArray(row?.[filter.field]) ? row[filter.field] : [];
        return required.every((value: unknown) => target.includes(value));
      });
    }
  }

  if (state.orderField) {
    rows = [...rows].sort((left, right) => {
      const leftValue = String(left?.[state.orderField!] ?? '');
      const rightValue = String(right?.[state.orderField!] ?? '');
      return state.orderAscending ? leftValue.localeCompare(rightValue) : rightValue.localeCompare(leftValue);
    });
  }

  if (typeof state.limitValue === 'number') {
    rows = rows.slice(0, state.limitValue);
  }

  return rows;
}

function applyUpdate(table: string, state: any, nextValues: Record<string, unknown>) {
  if (table === 'friend_invites') {
    for (const invite of executeSelect(table, state)) {
      mockFriendInvites.set(invite.id, { ...invite, ...nextValues });
    }
    return;
  }

  if (table === 'friendships') {
    const userId = state.filters.find((item: any) => item.type === 'eq' && item.field === 'user_id')?.value;
    const friendIds = state.filters.find((item: any) => item.type === 'in' && item.field === 'friend_user_id')?.value;
    if (!userId || !Array.isArray(friendIds)) {
      return;
    }

    for (const friendId of friendIds) {
      const current = mockEnsureFriendMap(String(userId)).get(String(friendId)) ?? {};
      mockEnsureFriendMap(String(userId)).set(String(friendId), { ...current, ...nextValues });
    }
  }
}

function applyDelete(table: string, state: any) {
  if (table !== 'shared_posts') {
    return;
  }

  const rows = executeSelect(table, state);
  for (const row of rows) {
    mockSharedPosts.delete(row.id);
  }
}

const mockUploadPhotoToStorage = jest.fn<Promise<string | null>, [string, string, string | null | undefined]>(
  async (_bucket: string, path: string) => path
);
const mockUploadVideoToStorage = jest.fn<Promise<string | null>, [string, string, string | null | undefined]>(
  async (_bucket: string, path: string) => path
);
const mockDownloadPhotoFromStorage = jest.fn<Promise<string | null>, [string, string, string]>(
  async (_bucket: string, path: string) => `file:///shared/${path}`
);
const mockDeletePhotoFromStorage = jest.fn<Promise<void>, [string, string | null]>(async () => undefined);
const mockDeleteVideoFromStorage = jest.fn<Promise<void>, [string, string | null]>(async () => undefined);
const mockCacheSharedFeedSnapshot = jest.fn<Promise<void>, [string, unknown]>(async () => undefined);
const mockSendSocialNotificationEvent = jest.fn<Promise<void>, [unknown]>(async () => undefined);
jest.mock('../services/remoteMedia', () => ({
  SHARED_POST_MEDIA_BUCKET: 'shared-post-media',
  uploadPhotoToStorage: (bucket: string, path: string, localUri?: string | null) =>
    mockUploadPhotoToStorage(bucket, path, localUri),
  uploadPairedVideoToStorage: (bucket: string, path: string, localUri?: string | null) =>
    mockUploadVideoToStorage(bucket, path, localUri),
  downloadPhotoFromStorage: (bucket: string, path: string, fileName: string) =>
    mockDownloadPhotoFromStorage(bucket, path, fileName),
  deletePhotoFromStorage: (bucket: string, path: string | null) =>
    mockDeletePhotoFromStorage(bucket, path),
  deletePairedVideoFromStorage: (bucket: string, path: string | null) =>
    mockDeleteVideoFromStorage(bucket, path),
}));

jest.mock('../services/publicProfileService', () => ({
  getPublicUserProfile: async (userUid: string) =>
    mockPublicProfiles.get(userUid) ?? {
      displayNameSnapshot: null,
      photoURLSnapshot: null,
    },
  upsertPublicUserProfile: jest.fn(async (input: { userUid: string; displayName: string | null; photoURL: string | null }) => {
    mockPublicProfiles.set(input.userUid, {
      displayNameSnapshot: input.displayName,
      photoURLSnapshot: input.photoURL,
    });
  }),
}));

jest.mock('../services/sharedFeedCache', () => ({
  cacheSharedFeedSnapshot: (userUid: string, snapshot: unknown) => mockCacheSharedFeedSnapshot(userUid, snapshot),
}));

jest.mock('../services/socialPushService', () => ({
  sendSocialNotificationEvent: (event: unknown) => mockSendSocialNotificationEvent(event),
}));

jest.mock('../utils/supabase', () => ({
  getCurrentSupabaseSession: async () => ({
    user: {
      id: mockSessionUserId,
    },
  }),
  getSupabase: () => ({
    from: (table: string) => mockCreateQueryBuilder(table),
    rpc: async (name: string, params: Record<string, unknown>) => {
      if (name === 'accept_friend_invite') {
        const invite = Array.from(mockFriendInvites.values()).find(
          (item) =>
            item.token === params.invite_token &&
            (!params.invite_id || item.id === params.invite_id)
        );

        if (!invite) {
          return { data: null, error: new Error('Invite not found.') };
        }

        invite.accepted_at = '2026-03-21T00:00:00.000Z';
        invite.accepted_by_user_id = 'friend-1';

        const inviterProfile = mockPublicProfiles.get(invite.inviter_user_id) ?? {
          displayNameSnapshot: null,
          photoURLSnapshot: null,
        };
        const receiverProfile = mockPublicProfiles.get('friend-1') ?? {
          displayNameSnapshot: null,
          photoURLSnapshot: null,
        };

        mockEnsureFriendMap('friend-1').set(invite.inviter_user_id, {
          display_name_snapshot: inviterProfile.displayNameSnapshot,
          photo_url_snapshot: inviterProfile.photoURLSnapshot,
          friended_at: invite.created_at,
          last_shared_at: null,
          created_by_invite_id: invite.id,
        });
        mockEnsureFriendMap(invite.inviter_user_id).set('friend-1', {
          display_name_snapshot: receiverProfile.displayNameSnapshot,
          photo_url_snapshot: receiverProfile.photoURLSnapshot,
          friended_at: invite.created_at,
          last_shared_at: null,
          created_by_invite_id: invite.id,
        });

        return {
          data: [
            {
              user_id: 'friend-1',
              friend_user_id: invite.inviter_user_id,
              display_name_snapshot: inviterProfile.displayNameSnapshot,
              photo_url_snapshot: inviterProfile.photoURLSnapshot,
              friended_at: invite.created_at,
              last_shared_at: null,
              created_by_invite_id: invite.id,
            },
          ],
          error: null,
        };
      }

      if (name === 'remove_friend') {
        const currentUserId = mockSessionUserId;
        const friendUserId = String(params.friend_user_id);

        for (const [postId, post] of mockSharedPosts.entries()) {
          if (!Array.isArray(post.audience_user_ids)) {
            continue;
          }

          if (post.author_user_id === currentUserId) {
            mockSharedPosts.set(postId, {
              ...post,
              audience_user_ids: post.audience_user_ids.filter((userId: string) => userId !== friendUserId),
              updated_at: '2026-03-27T00:00:00.000Z',
            });
            continue;
          }

          if (post.author_user_id === friendUserId) {
            mockSharedPosts.set(postId, {
              ...post,
              audience_user_ids: post.audience_user_ids.filter((userId: string) => userId !== currentUserId),
              updated_at: '2026-03-27T00:00:00.000Z',
            });
          }
        }

        for (const [userId, friends] of mockFriendships.entries()) {
          friends.delete(String(params.friend_user_id));
          if (String(params.friend_user_id) === userId) {
            continue;
          }
          const target = mockFriendships.get(String(params.friend_user_id));
          target?.delete(userId);
        }

        return { data: null, error: null };
      }

      return { data: null, error: null };
    },
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    })),
    removeChannel: jest.fn(async () => 'ok'),
  }),
  getSupabaseErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : typeof error === 'string' ? error : '',
  isSupabaseNetworkError: () => false,
  isSupabasePolicyError: () => false,
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => `uuid-${++mockUuidCounter}`,
  digestStringAsync: async (_algorithm: string, value: string) =>
    `digest-${value.replace(/[^a-z0-9]/gi, '').toLowerCase()}`,
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
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

import {
  acceptFriendInvite,
  createFriendInvite,
  createSharedPost,
  removeFriend,
  refreshSharedFeed,
} from '../services/sharedFeedService';

const ownerUser = {
  id: 'owner-1',
  uid: 'owner-1',
  displayName: 'Owner',
  email: 'owner@example.com',
  photoURL: 'https://example.com/owner.jpg',
  providerData: [],
} as any;

const friendUser = {
  id: 'friend-1',
  uid: 'friend-1',
  displayName: 'Friend',
  email: 'friend@example.com',
  photoURL: 'https://example.com/friend.jpg',
  providerData: [],
} as any;

const secondFriendUser = {
  id: 'friend-2',
  uid: 'friend-2',
  displayName: 'Second Friend',
  email: 'friend-2@example.com',
  photoURL: 'https://example.com/friend-2.jpg',
  providerData: [],
} as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockUuidCounter = 0;
  mockSessionUserId = 'owner-1';
  mockFriendInvites.clear();
  mockSharedPosts.clear();
  mockFriendships.clear();
  mockPublicProfiles.clear();
  mockPublicProfiles.set(ownerUser.id, {
    displayNameSnapshot: ownerUser.displayName,
    photoURLSnapshot: ownerUser.photoURL,
  });
  mockPublicProfiles.set(friendUser.id, {
    displayNameSnapshot: friendUser.displayName,
    photoURLSnapshot: friendUser.photoURL,
  });
  mockPublicProfiles.set(secondFriendUser.id, {
    displayNameSnapshot: secondFriendUser.displayName,
    photoURLSnapshot: secondFriendUser.photoURL,
  });
});

describe('sharedFeedService', () => {
  it('creates and accepts a friend invite into bilateral friendships', async () => {
    const invite = await createFriendInvite(ownerUser);
    const connection = await acceptFriendInvite(friendUser, invite.url);

    expect(invite.url).toContain(`inviteId=${invite.id}`);
    expect(invite.expiresAt).toMatch(/^20/);
    expect(connection.userId).toBe(ownerUser.id);
    expect(mockEnsureFriendMap(friendUser.id).get(ownerUser.id)).toEqual(
      expect.objectContaining({
        created_by_invite_id: invite.id,
      })
    );
    expect(mockEnsureFriendMap(ownerUser.id).get(friendUser.id)).toEqual(
      expect.objectContaining({
        display_name_snapshot: friendUser.displayName,
      })
    );
    expect(mockSendSocialNotificationEvent).toHaveBeenCalledWith({
      type: 'friend_accepted',
      friendUserId: ownerUser.id,
    });
  });

  it('creates a shared photo post and returns it in the refreshed feed', async () => {
    mockEnsureFriendMap(ownerUser.id).set(friendUser.id, {
      display_name_snapshot: friendUser.displayName,
      photo_url_snapshot: friendUser.photoURL,
      friended_at: '2026-03-20T00:00:00.000Z',
      last_shared_at: null,
      created_by_invite_id: 'invite-1',
    });
    mockEnsureFriendMap(friendUser.id).set(ownerUser.id, {
      display_name_snapshot: ownerUser.displayName,
      photo_url_snapshot: ownerUser.photoURL,
      friended_at: '2026-03-20T00:00:00.000Z',
      last_shared_at: null,
      created_by_invite_id: 'invite-1',
    });

    const note = {
      id: 'note-1',
      type: 'photo',
      content: 'file:///photos/note-1.jpg',
      photoLocalUri: 'file:///photos/note-1.jpg',
      doodleStrokesJson: null,
      locationName: 'Saigon',
      latitude: 10.77,
      longitude: 106.69,
      moodEmoji: null,
    } as any;

    const post = await createSharedPost(ownerUser, note, [friendUser.id]);
    mockSessionUserId = friendUser.id;
    const snapshot = await refreshSharedFeed(friendUser);

    expect(post.authorUid).toBe(ownerUser.id);
    expect(mockUploadPhotoToStorage).toHaveBeenCalledWith(
      'shared-post-media',
      expect.stringContaining(`${ownerUser.id}/shared-post-`),
      'file:///photos/note-1.jpg'
    );
    expect(snapshot.sharedPosts).toHaveLength(1);
    expect(snapshot.sharedPosts[0]).toEqual(
      expect.objectContaining({
        authorUid: ownerUser.id,
        audienceUserIds: [ownerUser.id, friendUser.id],
        type: 'photo',
        photoPath: expect.stringContaining(`${ownerUser.id}/shared-post-`),
        photoLocalUri: null,
        latitude: 10.77,
        longitude: 106.69,
      })
    );
    expect(mockCacheSharedFeedSnapshot).toHaveBeenCalled();
    expect(mockSendSocialNotificationEvent).toHaveBeenCalledWith({
      type: 'shared_post_created',
      postId: post.id,
    });
  });

  it('preserves the paired motion clip extension when sharing a live photo note', async () => {
    mockEnsureFriendMap(ownerUser.id).set(friendUser.id, {
      display_name_snapshot: friendUser.displayName,
      photo_url_snapshot: friendUser.photoURL,
      friended_at: '2026-03-20T00:00:00.000Z',
      last_shared_at: null,
      created_by_invite_id: 'invite-1',
    });
    mockEnsureFriendMap(friendUser.id).set(ownerUser.id, {
      display_name_snapshot: ownerUser.displayName,
      photo_url_snapshot: ownerUser.photoURL,
      friended_at: '2026-03-20T00:00:00.000Z',
      last_shared_at: null,
      created_by_invite_id: 'invite-1',
    });

    const note = {
      id: 'note-live',
      type: 'photo',
      content: 'file:///photos/note-live.jpg',
      photoLocalUri: 'file:///photos/note-live.jpg',
      isLivePhoto: true,
      pairedVideoLocalUri: 'file:///photos/note-live-motion.mov',
      doodleStrokesJson: null,
      locationName: 'Saigon',
      latitude: 10.77,
      longitude: 106.69,
      moodEmoji: null,
    } as any;

    await createSharedPost(ownerUser, note, [friendUser.id]);

    expect(mockUploadVideoToStorage).toHaveBeenCalledWith(
      'shared-post-media',
      expect.stringMatching(new RegExp(`${ownerUser.id}/shared-post-.*\\.motion\\.mov$`)),
      'file:///photos/note-live-motion.mov'
    );
  });

  it('revokes old shared audiences and hides author-only leftovers after removing a friend', async () => {
    mockEnsureFriendMap(ownerUser.id).set(friendUser.id, {
      display_name_snapshot: friendUser.displayName,
      photo_url_snapshot: friendUser.photoURL,
      friended_at: '2026-03-20T00:00:00.000Z',
      last_shared_at: null,
      created_by_invite_id: 'invite-1',
    });
    mockEnsureFriendMap(friendUser.id).set(ownerUser.id, {
      display_name_snapshot: ownerUser.displayName,
      photo_url_snapshot: ownerUser.photoURL,
      friended_at: '2026-03-20T00:00:00.000Z',
      last_shared_at: null,
      created_by_invite_id: 'invite-1',
    });
    mockEnsureFriendMap(ownerUser.id).set(secondFriendUser.id, {
      display_name_snapshot: secondFriendUser.displayName,
      photo_url_snapshot: secondFriendUser.photoURL,
      friended_at: '2026-03-21T00:00:00.000Z',
      last_shared_at: null,
      created_by_invite_id: 'invite-2',
    });
    mockEnsureFriendMap(secondFriendUser.id).set(ownerUser.id, {
      display_name_snapshot: ownerUser.displayName,
      photo_url_snapshot: ownerUser.photoURL,
      friended_at: '2026-03-21T00:00:00.000Z',
      last_shared_at: null,
      created_by_invite_id: 'invite-2',
    });

    mockSharedPosts.set('shared-owned-direct', {
      id: 'shared-owned-direct',
      author_user_id: ownerUser.id,
      author_display_name: ownerUser.displayName,
      author_photo_url_snapshot: ownerUser.photoURL,
      audience_user_ids: [ownerUser.id, friendUser.id],
      type: 'text',
      text: 'Direct share',
      photo_path: null,
      doodle_strokes_json: null,
      sticker_placements_json: null,
      note_color: null,
      place_name: 'District 1',
      source_note_id: 'note-1',
      latitude: null,
      longitude: null,
      created_at: '2026-03-24T00:00:00.000Z',
      updated_at: null,
    });
    mockSharedPosts.set('shared-owned-group', {
      id: 'shared-owned-group',
      author_user_id: ownerUser.id,
      author_display_name: ownerUser.displayName,
      author_photo_url_snapshot: ownerUser.photoURL,
      audience_user_ids: [ownerUser.id, friendUser.id, secondFriendUser.id],
      type: 'text',
      text: 'Group share',
      photo_path: null,
      doodle_strokes_json: null,
      sticker_placements_json: null,
      note_color: null,
      place_name: 'District 2',
      source_note_id: 'note-2',
      latitude: null,
      longitude: null,
      created_at: '2026-03-25T00:00:00.000Z',
      updated_at: null,
    });
    mockSharedPosts.set('shared-friend-direct', {
      id: 'shared-friend-direct',
      author_user_id: friendUser.id,
      author_display_name: friendUser.displayName,
      author_photo_url_snapshot: friendUser.photoURL,
      audience_user_ids: [friendUser.id, ownerUser.id],
      type: 'text',
      text: 'Friend direct share',
      photo_path: null,
      doodle_strokes_json: null,
      sticker_placements_json: null,
      note_color: null,
      place_name: 'District 3',
      source_note_id: 'note-3',
      latitude: null,
      longitude: null,
      created_at: '2026-03-26T00:00:00.000Z',
      updated_at: null,
    });

    await removeFriend(ownerUser, friendUser.id);

    expect(mockSharedPosts.get('shared-owned-direct')).toEqual(
      expect.objectContaining({
        audience_user_ids: [ownerUser.id],
      })
    );
    expect(mockSharedPosts.get('shared-owned-group')).toEqual(
      expect.objectContaining({
        audience_user_ids: [ownerUser.id, secondFriendUser.id],
      })
    );
    expect(mockSharedPosts.get('shared-friend-direct')).toEqual(
      expect.objectContaining({
        audience_user_ids: [friendUser.id],
      })
    );

    mockSessionUserId = ownerUser.id;
    const ownerSnapshot = await refreshSharedFeed(ownerUser);
    expect(ownerSnapshot.sharedPosts.map((post) => post.id)).toEqual(['shared-owned-group']);

    mockSessionUserId = friendUser.id;
    const friendSnapshot = await refreshSharedFeed(friendUser);
    expect(friendSnapshot.sharedPosts).toEqual([]);
  });
});

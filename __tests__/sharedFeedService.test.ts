const mockFriendInvites = new Map<string, any>();
const mockSharedPosts = new Map<string, any>();
const mockSharedPostTombstones = new Map<string, any>();
const mockStickerAssets = new Map<string, any>();
const mockStickerAssetRefs = new Map<string, any>();
const mockFriendships = new Map<string, Map<string, any>>();
const mockPublicProfiles = new Map<
  string,
  { username: string | null; displayNameSnapshot: string | null; photoURLSnapshot: string | null }
>();
const mockCachedActiveInvites = new Map<string, any>();
let mockUuidCounter = 0;
let mockSessionUserId = 'owner-1';
let mockSharedPostsInsertError: unknown = null;
const mockUndeletableSharedPostIds = new Set<string>();
const mockDeleteResponseOmittedSharedPostIds = new Set<string>();

function mockHashInviteToken(token: string) {
  return `digest-${token.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;
}

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
        const token =
          typeof value.token === 'string' && value.token.trim() ? value.token.trim() : '';
        const tokenHash =
          typeof value.token_hash === 'string' && value.token_hash.trim()
            ? value.token_hash.trim()
            : token
            ? mockHashInviteToken(token)
            : null;
        mockFriendInvites.set(String(value.id), {
          ...value,
          token: tokenHash,
          token_hash: tokenHash,
        });
      }

      if (table === 'shared_post_tombstones') {
        const rows = Array.isArray(value) ? value : [value];
        for (const row of rows) {
          mockSharedPostTombstones.set(String(row.post_id), row);
        }
      }

      if (table === 'sticker_asset_refs') {
        const rows = Array.isArray(value) ? value : [value];
        for (const row of rows) {
          mockStickerAssetRefs.set(
            `${row.container_type}:${row.container_id}:${row.asset_id}`,
            row
          );
        }
      }

      return { error: null };
    },
    insert: async (value: Record<string, unknown>) => {
      if (table === 'shared_posts' && mockSharedPostsInsertError) {
        return { error: mockSharedPostsInsertError };
      }
      if (table === 'shared_posts') {
        mockSharedPosts.set(String(value.id), value);
      }

      if (table === 'sticker_assets') {
        const nextId = `remote-sticker-${mockStickerAssets.size + 1}`;
        mockStickerAssets.set(nextId, {
          id: nextId,
          created_at: '2026-03-25T00:00:00.000Z',
          ...value,
        });
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
          const deletedRows = applyDelete(table, state);
          return Promise.resolve(resolve({ data: deletedRows, error: null }));
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
  } else if (table === 'shared_post_tombstones') {
    rows = Array.from(mockSharedPostTombstones.values());
  } else if (table === 'sticker_assets') {
    rows = Array.from(mockStickerAssets.values());
  } else if (table === 'sticker_asset_refs') {
    rows = Array.from(mockStickerAssetRefs.values());
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
    return;
  }

  if (table === 'sticker_assets') {
    for (const asset of executeSelect(table, state)) {
      mockStickerAssets.set(asset.id, { ...asset, ...nextValues });
    }
  }
}

function applyDelete(table: string, state: any) {
  if (table !== 'shared_posts') {
    if (table !== 'shared_post_tombstones' && table !== 'sticker_asset_refs') {
      return [];
    }
  }

  const rows = executeSelect(table, state);
  const deletedRows =
    table === 'shared_posts'
      ? rows.filter((row) => !mockUndeletableSharedPostIds.has(String(row.id)))
      : rows;
  const returnedRows =
    table === 'shared_posts'
      ? deletedRows.filter((row) => !mockDeleteResponseOmittedSharedPostIds.has(String(row.id)))
      : deletedRows;
  for (const row of deletedRows) {
    if (table === 'shared_posts') {
      mockSharedPosts.delete(row.id);
    } else if (table === 'sticker_asset_refs') {
      mockStickerAssetRefs.delete(`${row.container_type}:${row.container_id}:${row.asset_id}`);
    } else {
      mockSharedPostTombstones.delete(row.post_id);
    }
  }

  return returnedRows;
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
const mockGetNoteDoodle = jest.fn<Promise<{ noteId: string; strokesJson: string; updatedAt: string } | null>, [string]>(
  async () => null
);
const mockGetNoteStickers = jest.fn<
  Promise<{ note_id: string; placements_json: string; updated_at: string } | null>,
  [string]
>(async () => null);
const mockSerializeStickerPlacementsForStorage = jest.fn<
  Promise<string>,
  [unknown[], string, string, Record<string, unknown>?]
>(async (placements) => JSON.stringify(placements));
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
  normalizeUsernameInput: (value: string) => value.trim().replace(/^@+/, '').toLowerCase(),
  getPublicUserProfile: async (userUid: string) =>
    mockPublicProfiles.get(userUid) ?? {
      username: null,
      displayNameSnapshot: null,
      photoURLSnapshot: null,
    },
  upsertPublicUserProfile: jest.fn(async (input: { userUid: string; displayName: string | null; photoURL: string | null }) => {
    const current = mockPublicProfiles.get(input.userUid);
    mockPublicProfiles.set(input.userUid, {
      username: current?.username ?? null,
      displayNameSnapshot: current?.displayNameSnapshot ?? input.displayName,
      photoURLSnapshot: input.photoURL,
    });
  }),
}));

jest.mock('../services/sharedFeedCache', () => ({
  cacheSharedFeedSnapshot: async (userUid: string, snapshot: any) => {
    if (snapshot?.activeInvite) {
      mockCachedActiveInvites.set(userUid, snapshot.activeInvite);
    } else {
      mockCachedActiveInvites.delete(userUid);
    }
    return mockCacheSharedFeedSnapshot(userUid, snapshot);
  },
  getCachedActiveInvite: async (userUid: string) => mockCachedActiveInvites.get(userUid) ?? null,
  replaceCachedActiveInvite: async (userUid: string, invite: unknown) => {
    if (invite) {
      mockCachedActiveInvites.set(userUid, invite);
    } else {
      mockCachedActiveInvites.delete(userUid);
    }
  },
}));

jest.mock('../services/socialPushService', () => ({
  sendSocialNotificationEvent: (event: unknown) => mockSendSocialNotificationEvent(event),
}));

jest.mock('../services/noteDoodles', () => {
  const actual = jest.requireActual('../services/noteDoodles');
  return {
    ...actual,
    getNoteDoodle: (noteId: string) => mockGetNoteDoodle(noteId),
  };
});

jest.mock('../services/noteStickers', () => {
  const actual = jest.requireActual('../services/noteStickers');
  return {
    ...actual,
    getNoteStickers: (noteId: string) => mockGetNoteStickers(noteId),
    serializeStickerPlacementsForStorage: (
      placements: unknown[],
      bucket: string,
      ownerUid: string,
      options?: Record<string, unknown>
    ) => mockSerializeStickerPlacementsForStorage(placements, bucket, ownerUid, options),
  };
});

jest.mock('../services/inviteTokenStorage', () => ({
  setStoredInviteToken: jest.fn(async () => undefined),
  clearStoredInviteToken: jest.fn(async () => undefined),
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
      if (name === 'find_user_by_username') {
        const currentUserId = mockSessionUserId;
        const normalizedUsername = String(params.search_username ?? '').trim().replace(/^@+/, '').toLowerCase();
        const targetEntry = Array.from(mockPublicProfiles.entries()).find(
          ([, profile]) => (profile.username ?? '').toLowerCase() === normalizedUsername
        );

        if (!targetEntry) {
          return { data: null, error: new Error('User not found.') };
        }

        const [targetUserId, profile] = targetEntry;

        return {
          data: [
            {
              user_id: targetUserId,
              username: profile.username,
              display_name: profile.displayNameSnapshot,
              photo_url: profile.photoURLSnapshot,
              is_self: targetUserId === currentUserId,
              already_friends: mockEnsureFriendMap(currentUserId).has(targetUserId),
            },
          ],
          error: null,
        };
      }

      if (name === 'add_friend_by_username') {
        const currentUserId = mockSessionUserId;
        const normalizedUsername = String(params.search_username ?? '').trim().replace(/^@+/, '').toLowerCase();
        const targetEntry = Array.from(mockPublicProfiles.entries()).find(
          ([, profile]) => (profile.username ?? '').toLowerCase() === normalizedUsername
        );

        if (!targetEntry) {
          return { data: null, error: new Error('User not found.') };
        }

        const [targetUserId, targetProfile] = targetEntry;
        if (targetUserId === currentUserId) {
          return { data: null, error: new Error('You cannot add yourself.') };
        }

        if (mockEnsureFriendMap(currentUserId).has(targetUserId)) {
          return { data: null, error: new Error('You are already friends.') };
        }

        const currentProfile = mockPublicProfiles.get(currentUserId) ?? {
          username: null,
          displayNameSnapshot: null,
          photoURLSnapshot: null,
        };
        const friendedAt = '2026-04-11T00:00:00.000Z';

        mockEnsureFriendMap(currentUserId).set(targetUserId, {
          display_name_snapshot: targetProfile.displayNameSnapshot,
          photo_url_snapshot: targetProfile.photoURLSnapshot,
          friended_at: friendedAt,
          last_shared_at: null,
          created_by_invite_id: null,
        });
        mockEnsureFriendMap(targetUserId).set(currentUserId, {
          display_name_snapshot: currentProfile.displayNameSnapshot,
          photo_url_snapshot: currentProfile.photoURLSnapshot,
          friended_at: friendedAt,
          last_shared_at: null,
          created_by_invite_id: null,
        });

        return {
          data: [
            {
              user_id: currentUserId,
              friend_user_id: targetUserId,
              display_name_snapshot: targetProfile.displayNameSnapshot,
              photo_url_snapshot: targetProfile.photoURLSnapshot,
              friended_at: friendedAt,
              last_shared_at: null,
              created_by_invite_id: null,
            },
          ],
          error: null,
        };
      }

      if (name === 'accept_friend_invite') {
        const inviteToken = String(params.invite_token ?? '').trim();
        const inviteTokenHash = mockHashInviteToken(inviteToken);
        const invite = Array.from(mockFriendInvites.values()).find(
          (item) =>
            (item.token === inviteToken ||
              item.token === inviteTokenHash ||
              item.token_hash === inviteToken ||
              item.token_hash === inviteTokenHash) &&
            (!params.invite_id || item.id === params.invite_id)
        );

        if (!invite) {
          return { data: null, error: new Error('Invite not found.') };
        }

        invite.accepted_at = '2026-03-21T00:00:00.000Z';
        invite.accepted_by_user_id = 'friend-1';

        const inviterProfile = mockPublicProfiles.get(invite.inviter_user_id) ?? {
          username: null,
          displayNameSnapshot: null,
          photoURLSnapshot: null,
        };
        const receiverProfile = mockPublicProfiles.get('friend-1') ?? {
          username: null,
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
  requireSupabase: () => ({
    from: (table: string) => mockCreateQueryBuilder(table),
    rpc: async (name: string, params: Record<string, unknown>) => {
      if (name === 'find_user_by_username') {
        const currentUserId = mockSessionUserId;
        const normalizedUsername = String(params.search_username ?? '').trim().replace(/^@+/, '').toLowerCase();
        const targetEntry = Array.from(mockPublicProfiles.entries()).find(
          ([, profile]) => (profile.username ?? '').toLowerCase() === normalizedUsername
        );

        if (!targetEntry) {
          return { data: null, error: new Error('User not found.') };
        }

        const [targetUserId, profile] = targetEntry;

        return {
          data: [
            {
              user_id: targetUserId,
              username: profile.username,
              display_name: profile.displayNameSnapshot,
              photo_url: profile.photoURLSnapshot,
              is_self: targetUserId === currentUserId,
              already_friends: mockEnsureFriendMap(currentUserId).has(targetUserId),
            },
          ],
          error: null,
        };
      }

      if (name === 'add_friend_by_username') {
        const currentUserId = mockSessionUserId;
        const normalizedUsername = String(params.search_username ?? '').trim().replace(/^@+/, '').toLowerCase();
        const targetEntry = Array.from(mockPublicProfiles.entries()).find(
          ([, profile]) => (profile.username ?? '').toLowerCase() === normalizedUsername
        );

        if (!targetEntry) {
          return { data: null, error: new Error('User not found.') };
        }

        const [targetUserId, targetProfile] = targetEntry;
        if (targetUserId === currentUserId) {
          return { data: null, error: new Error('You cannot add yourself.') };
        }

        if (mockEnsureFriendMap(currentUserId).has(targetUserId)) {
          return { data: null, error: new Error('You are already friends.') };
        }

        const currentProfile = mockPublicProfiles.get(currentUserId) ?? {
          username: null,
          displayNameSnapshot: null,
          photoURLSnapshot: null,
        };
        const friendedAt = '2026-04-11T00:00:00.000Z';

        mockEnsureFriendMap(currentUserId).set(targetUserId, {
          display_name_snapshot: targetProfile.displayNameSnapshot,
          photo_url_snapshot: targetProfile.photoURLSnapshot,
          friended_at: friendedAt,
          last_shared_at: null,
          created_by_invite_id: null,
        });
        mockEnsureFriendMap(targetUserId).set(currentUserId, {
          display_name_snapshot: currentProfile.displayNameSnapshot,
          photo_url_snapshot: currentProfile.photoURLSnapshot,
          friended_at: friendedAt,
          last_shared_at: null,
          created_by_invite_id: null,
        });

        return {
          data: [
            {
              user_id: currentUserId,
              friend_user_id: targetUserId,
              display_name_snapshot: targetProfile.displayNameSnapshot,
              photo_url_snapshot: targetProfile.photoURLSnapshot,
              friended_at: friendedAt,
              last_shared_at: null,
              created_by_invite_id: null,
            },
          ],
          error: null,
        };
      }

      if (name === 'accept_friend_invite') {
        const inviteToken = String(params.invite_token ?? '').trim();
        const inviteTokenHash = mockHashInviteToken(inviteToken);
        const invite = Array.from(mockFriendInvites.values()).find(
          (item) =>
            (item.token === inviteToken ||
              item.token === inviteTokenHash ||
              item.token_hash === inviteToken ||
              item.token_hash === inviteTokenHash) &&
            (!params.invite_id || item.id === params.invite_id)
        );

        if (!invite) {
          return { data: null, error: new Error('Invite not found.') };
        }

        invite.accepted_at = '2026-03-21T00:00:00.000Z';
        invite.accepted_by_user_id = 'friend-1';

        const inviterProfile = mockPublicProfiles.get(invite.inviter_user_id) ?? {
          username: null,
          displayNameSnapshot: null,
          photoURLSnapshot: null,
        };
        const receiverProfile = mockPublicProfiles.get('friend-1') ?? {
          username: null,
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
  isSupabaseStorageObjectMissingError: (error: unknown) => {
    const code =
      typeof error === 'object' && error && 'code' in error
        ? String((error as { code?: unknown }).code ?? '')
        : '';
    const message = String(
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error && 'message' in error
          ? (error as { message?: unknown }).message ?? ''
          : ''
    ).toLowerCase();

    return (
      code === '404' ||
      code === 'NoSuchKey' ||
      message.includes('object not found') ||
      (message.includes('not found') &&
        (message.includes('object') ||
          message.includes('storage') ||
          message.includes('bucket') ||
          message.includes('key')))
    );
  },
  isSupabasePolicyError: () => false,
  isSupabaseSchemaMismatchError: () => false,
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
  addFriendByUsername,
  createFriendInvite,
  createSharedPost,
  deleteSharedPost,
  findFriendByUsername,
  removeFriend,
  refreshSharedFeed,
} from '../services/sharedFeedService';

const ownerUser = {
  id: 'owner-1',
  uid: 'owner-1',
  displayName: 'Owner',
  username: 'owner',
  email: 'owner@example.com',
  photoURL: 'https://example.com/owner.jpg',
  providerData: [],
} as any;

const friendUser = {
  id: 'friend-1',
  uid: 'friend-1',
  displayName: 'Friend',
  username: 'friend',
  email: 'friend@example.com',
  photoURL: 'https://example.com/friend.jpg',
  providerData: [],
} as any;

const secondFriendUser = {
  id: 'friend-2',
  uid: 'friend-2',
  displayName: 'Second Friend',
  username: 'second.friend',
  email: 'friend-2@example.com',
  photoURL: 'https://example.com/friend-2.jpg',
  providerData: [],
} as any;

  beforeEach(() => {
  jest.clearAllMocks();
  mockUuidCounter = 0;
  mockSessionUserId = 'owner-1';
  mockSharedPostsInsertError = null;
  mockUndeletableSharedPostIds.clear();
  mockDeleteResponseOmittedSharedPostIds.clear();
    mockFriendInvites.clear();
    mockSharedPosts.clear();
    mockSharedPostTombstones.clear();
    mockStickerAssets.clear();
    mockStickerAssetRefs.clear();
    mockFriendships.clear();
  mockPublicProfiles.clear();
  mockCachedActiveInvites.clear();
  mockGetNoteDoodle.mockReset();
  mockGetNoteDoodle.mockResolvedValue(null);
  mockGetNoteStickers.mockReset();
  mockGetNoteStickers.mockResolvedValue(null);
  mockSerializeStickerPlacementsForStorage.mockReset();
  mockSerializeStickerPlacementsForStorage.mockImplementation(async (placements) => JSON.stringify(placements));
  mockPublicProfiles.set(ownerUser.id, {
    username: ownerUser.username,
    displayNameSnapshot: ownerUser.username,
    photoURLSnapshot: ownerUser.photoURL,
  });
  mockPublicProfiles.set(friendUser.id, {
    username: friendUser.username,
    displayNameSnapshot: friendUser.username,
    photoURLSnapshot: friendUser.photoURL,
  });
  mockPublicProfiles.set(secondFriendUser.id, {
    username: secondFriendUser.username,
    displayNameSnapshot: secondFriendUser.username,
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
        display_name_snapshot: friendUser.username,
      })
    );
    expect(mockSendSocialNotificationEvent).toHaveBeenCalledWith({
      type: 'friend_accepted',
      friendUserId: ownerUser.id,
    });
  });

  it('accepts an invite pasted from share text instead of only a raw deeplink', async () => {
    const invite = await createFriendInvite(ownerUser);
    const connection = await acceptFriendInvite(
      friendUser,
      `Join me on Noto.\n${invite.url}`
    );

    expect(connection.userId).toBe(ownerUser.id);
    expect(mockEnsureFriendMap(friendUser.id).get(ownerUser.id)).toEqual(
      expect.objectContaining({
        created_by_invite_id: invite.id,
      })
    );
  });

  it('accepts an invite when pasted text includes trailing punctuation', async () => {
    const invite = await createFriendInvite(ownerUser);
    const connection = await acceptFriendInvite(
      friendUser,
      `"${invite.url}!"`
    );

    expect(connection.userId).toBe(ownerUser.id);
  });

  it('accepts an invite code pasted from chat copy', async () => {
    const invite = await createFriendInvite(ownerUser);
    const connection = await acceptFriendInvite(
      friendUser,
      `Join me on Noto.\nInvite code: ${invite.token}`
    );

    expect(connection.userId).toBe(ownerUser.id);
  });

  it('finds and adds a friend by exact username', async () => {
    const result = await findFriendByUsername(ownerUser, '@friend');
    expect(result).toEqual(
      expect.objectContaining({
        userId: friendUser.id,
        username: friendUser.username,
        alreadyFriends: false,
      })
    );

    const connection = await addFriendByUsername(ownerUser, friendUser.username);
    expect(connection.userId).toBe(friendUser.id);
    expect(mockEnsureFriendMap(ownerUser.id).get(friendUser.id)).toEqual(
      expect.objectContaining({
        display_name_snapshot: friendUser.username,
      })
    );
    expect(mockEnsureFriendMap(friendUser.id).get(ownerUser.id)).toEqual(
      expect.objectContaining({
        display_name_snapshot: ownerUser.username,
      })
    );
  });

  it('creates a shared photo post and returns it in the refreshed feed', async () => {
    mockEnsureFriendMap(ownerUser.id).set(friendUser.id, {
      display_name_snapshot: friendUser.username,
      photo_url_snapshot: friendUser.photoURL,
      friended_at: '2026-03-20T00:00:00.000Z',
      last_shared_at: null,
      created_by_invite_id: 'invite-1',
    });
    mockEnsureFriendMap(friendUser.id).set(ownerUser.id, {
      display_name_snapshot: ownerUser.username,
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
      display_name_snapshot: friendUser.username,
      photo_url_snapshot: friendUser.photoURL,
      friended_at: '2026-03-20T00:00:00.000Z',
      last_shared_at: null,
      created_by_invite_id: 'invite-1',
    });
    mockEnsureFriendMap(friendUser.id).set(ownerUser.id, {
      display_name_snapshot: ownerUser.username,
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

  it('hydrates stored doodles and stickers before creating a shared post', async () => {
    mockEnsureFriendMap(ownerUser.id).set(friendUser.id, {
      display_name_snapshot: friendUser.username,
      photo_url_snapshot: friendUser.photoURL,
      friended_at: '2026-03-20T00:00:00.000Z',
      last_shared_at: null,
      created_by_invite_id: 'invite-1',
    });
    mockEnsureFriendMap(friendUser.id).set(ownerUser.id, {
      display_name_snapshot: ownerUser.username,
      photo_url_snapshot: ownerUser.photoURL,
      friended_at: '2026-03-20T00:00:00.000Z',
      last_shared_at: null,
      created_by_invite_id: 'invite-1',
    });
    mockGetNoteDoodle.mockResolvedValue({
      noteId: 'note-decorated',
      strokesJson: JSON.stringify([{ color: '#111111', points: [0.1, 0.1, 0.2, 0.2] }]),
      updatedAt: '2026-03-25T00:00:00.000Z',
    });
    mockGetNoteStickers.mockResolvedValue({
      note_id: 'note-decorated',
      placements_json: JSON.stringify([
        {
          id: 'placement-1',
          assetId: 'asset-1',
          x: 0.5,
          y: 0.5,
          scale: 1,
          rotation: 0,
          zIndex: 1,
          opacity: 1,
          outlineEnabled: true,
          motionLocked: false,
          renderMode: 'stamp',
          asset: {
            id: 'asset-1',
            ownerUid: ownerUser.id,
            localUri: 'file:///stickers/asset-1.jpg',
            remotePath: null,
            mimeType: 'image/jpeg',
            width: 300,
            height: 240,
            createdAt: '2026-03-25T00:00:00.000Z',
            updatedAt: null,
            source: 'import',
          },
        },
      ]),
      updated_at: '2026-03-25T00:00:00.000Z',
    });

    const note = {
      id: 'note-decorated',
      type: 'text',
      content: 'Decorated note',
      doodleStrokesJson: null,
      stickerPlacementsJson: null,
      hasDoodle: false,
      hasStickers: false,
      locationName: 'Saigon',
      latitude: 10.77,
      longitude: 106.69,
      moodEmoji: null,
      noteColor: null,
    } as any;

    const post = await createSharedPost(ownerUser, note, [friendUser.id]);

    expect(mockGetNoteDoodle).toHaveBeenCalledWith('note-decorated');
    expect(mockGetNoteStickers).toHaveBeenCalledWith('note-decorated');
    expect(post.doodleStrokesJson).toContain('#111111');
    expect(post.hasStickers).toBe(true);
    expect(post.stickerPlacementsJson).toContain('"renderMode":"stamp"');
  });

  it('cleans up uploaded shared media when post creation fails', async () => {
    mockEnsureFriendMap(ownerUser.id).set(friendUser.id, {
      display_name_snapshot: friendUser.username,
      photo_url_snapshot: friendUser.photoURL,
      friended_at: '2026-03-20T00:00:00.000Z',
      last_shared_at: null,
      created_by_invite_id: 'invite-1',
    });
    mockEnsureFriendMap(friendUser.id).set(ownerUser.id, {
      display_name_snapshot: ownerUser.username,
      photo_url_snapshot: ownerUser.photoURL,
      friended_at: '2026-03-20T00:00:00.000Z',
      last_shared_at: null,
      created_by_invite_id: 'invite-1',
    });
    mockSharedPostsInsertError = new Error('insert failed');

    const note = {
      id: 'note-fail',
      type: 'photo',
      content: 'file:///photos/note-fail.jpg',
      photoLocalUri: 'file:///photos/note-fail.jpg',
      doodleStrokesJson: null,
      locationName: 'Saigon',
      latitude: 10.77,
      longitude: 106.69,
      moodEmoji: null,
    } as any;

    await expect(createSharedPost(ownerUser, note, [friendUser.id])).rejects.toThrow('insert failed');

    expect(mockDeletePhotoFromStorage).toHaveBeenCalledWith(
      'shared-post-media',
      expect.stringContaining(`${ownerUser.id}/shared-post-`)
    );
  });

  it('clears shared post sticker refs without deleting the reusable sticker asset', async () => {
    mockSharedPosts.set('shared-sticker', {
      id: 'shared-sticker',
      author_user_id: ownerUser.id,
      author_display_name: ownerUser.username,
      author_photo_url_snapshot: ownerUser.photoURL,
      audience_user_ids: [ownerUser.id, friendUser.id],
      type: 'text',
      text: 'Sticker note',
      photo_path: null,
      paired_video_path: null,
      doodle_strokes_json: null,
      sticker_placements_json: JSON.stringify([
        {
          id: 'placement-1',
          assetId: 'asset-1',
          x: 0.5,
          y: 0.5,
          scale: 1,
          rotation: 0,
          zIndex: 1,
          opacity: 1,
          asset: {
            id: 'asset-1',
            localUri: 'file:///stickers/asset-1.png',
            remotePath: 'owner-1/shared-post-sticker-1.png',
            mimeType: 'image/png',
          },
        },
      ]),
      note_color: null,
      place_name: 'District 1',
      source_note_id: 'note-1',
      latitude: null,
      longitude: null,
      created_at: '2026-03-24T00:00:00.000Z',
      updated_at: null,
    });
    mockStickerAssetRefs.set('shared_post:shared-sticker:remote-sticker-1', {
      asset_id: 'remote-sticker-1',
      owner_user_id: ownerUser.id,
      container_type: 'shared_post',
      container_id: 'shared-sticker',
    });

    await deleteSharedPost(ownerUser, 'shared-sticker');

    expect(mockSharedPosts.has('shared-sticker')).toBe(false);
    expect(mockSharedPostTombstones.get('shared-sticker')).toEqual(
      expect.objectContaining({
        post_id: 'shared-sticker',
        author_user_id: ownerUser.id,
      })
    );
    expect(mockDeletePhotoFromStorage).not.toHaveBeenCalledWith(
      'shared-post-media',
      'owner-1/shared-post-sticker-1.png'
    );
    expect(mockStickerAssetRefs.size).toBe(0);
  });

  it('fails shared post deletion when the row is fetched but not actually deleted', async () => {
    mockSharedPosts.set('shared-stuck', {
      id: 'shared-stuck',
      author_user_id: ownerUser.id,
      author_display_name: ownerUser.username,
      author_photo_url_snapshot: ownerUser.photoURL,
      audience_user_ids: [ownerUser.id, friendUser.id],
      type: 'text',
      text: 'Still there',
      photo_path: null,
      paired_video_path: null,
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
    mockUndeletableSharedPostIds.add('shared-stuck');

    await expect(deleteSharedPost(ownerUser, 'shared-stuck')).rejects.toThrow(
      'Remote shared post delete did not remove expected rows: shared-stuck'
    );

    expect(mockSharedPosts.has('shared-stuck')).toBe(true);
    expect(mockSharedPostTombstones.has('shared-stuck')).toBe(false);
  });

  it('accepts shared post deletion when the row is gone but omitted from the delete response', async () => {
    mockSharedPosts.set('shared-hidden-delete', {
      id: 'shared-hidden-delete',
      author_user_id: ownerUser.id,
      author_display_name: ownerUser.username,
      author_photo_url_snapshot: ownerUser.photoURL,
      audience_user_ids: [ownerUser.id, friendUser.id],
      type: 'text',
      text: 'Gone remotely',
      photo_path: null,
      paired_video_path: null,
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
    mockDeleteResponseOmittedSharedPostIds.add('shared-hidden-delete');

    await deleteSharedPost(ownerUser, 'shared-hidden-delete');

    expect(mockSharedPosts.has('shared-hidden-delete')).toBe(false);
    expect(mockSharedPostTombstones.get('shared-hidden-delete')).toEqual(
      expect.objectContaining({
        post_id: 'shared-hidden-delete',
        author_user_id: ownerUser.id,
      })
    );
  });

  it('keeps shared post deletion successful when shared media cleanup fails after row deletion', async () => {
    mockSharedPosts.set('shared-photo-error', {
      id: 'shared-photo-error',
      author_user_id: ownerUser.id,
      author_display_name: ownerUser.username,
      author_photo_url_snapshot: ownerUser.photoURL,
      audience_user_ids: [ownerUser.id, friendUser.id],
      type: 'photo',
      text: '',
      photo_path: 'owner-1/shared-photo-error',
      paired_video_path: null,
      doodle_strokes_json: null,
      sticker_placements_json: null,
      note_color: null,
      place_name: 'District 1',
      source_note_id: 'note-2',
      latitude: null,
      longitude: null,
      created_at: '2026-03-24T00:00:00.000Z',
      updated_at: null,
    });
    mockDeletePhotoFromStorage.mockRejectedValueOnce(new Error('shared media delete failed'));

    await deleteSharedPost(ownerUser, 'shared-photo-error');

    expect(mockSharedPosts.has('shared-photo-error')).toBe(false);
    expect(mockSharedPostTombstones.get('shared-photo-error')).toEqual(
      expect.objectContaining({
        post_id: 'shared-photo-error',
        author_user_id: ownerUser.id,
      })
    );
  });

  it('revokes old shared audiences and hides author-only leftovers after removing a friend', async () => {
    mockEnsureFriendMap(ownerUser.id).set(friendUser.id, {
      display_name_snapshot: friendUser.username,
      photo_url_snapshot: friendUser.photoURL,
      friended_at: '2026-03-20T00:00:00.000Z',
      last_shared_at: null,
      created_by_invite_id: 'invite-1',
    });
    mockEnsureFriendMap(friendUser.id).set(ownerUser.id, {
      display_name_snapshot: ownerUser.username,
      photo_url_snapshot: ownerUser.photoURL,
      friended_at: '2026-03-20T00:00:00.000Z',
      last_shared_at: null,
      created_by_invite_id: 'invite-1',
    });
    mockEnsureFriendMap(ownerUser.id).set(secondFriendUser.id, {
      display_name_snapshot: secondFriendUser.username,
      photo_url_snapshot: secondFriendUser.photoURL,
      friended_at: '2026-03-21T00:00:00.000Z',
      last_shared_at: null,
      created_by_invite_id: 'invite-2',
    });
    mockEnsureFriendMap(secondFriendUser.id).set(ownerUser.id, {
      display_name_snapshot: ownerUser.username,
      photo_url_snapshot: ownerUser.photoURL,
      friended_at: '2026-03-21T00:00:00.000Z',
      last_shared_at: null,
      created_by_invite_id: 'invite-2',
    });

    mockSharedPosts.set('shared-owned-direct', {
      id: 'shared-owned-direct',
      author_user_id: ownerUser.id,
      author_display_name: ownerUser.username,
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
      author_display_name: ownerUser.username,
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
      author_display_name: friendUser.username,
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
    expect(friendSnapshot.sharedPosts.map((post) => post.id)).not.toContain('shared-owned-direct');
    expect(friendSnapshot.sharedPosts.map((post) => post.id)).not.toContain('shared-owned-group');
    expect(friendSnapshot.sharedPosts.map((post) => post.id)).not.toContain('shared-friend-direct');
  });
});

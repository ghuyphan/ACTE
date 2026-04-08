import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';

const mockAuthState = {
  isReady: true,
  isAuthAvailable: true,
  user: {
    id: 'me',
    uid: 'me',
    displayName: 'Me',
    email: 'me@example.com',
    photoURL: null,
    providerData: [],
  } as any,
};

const mockConnectivityState = {
  isOnline: true,
};

let mockCachedSnapshot: {
  friends: any[];
  sharedPosts: any[];
  activeInvite: any;
  lastUpdatedAt: string | null;
} = {
  friends: [] as any[],
  sharedPosts: [] as any[],
  activeInvite: null,
  lastUpdatedAt: null as string | null,
};

let mockRefreshSnapshot: {
  friends: any[];
  sharedPosts: any[];
  activeInvite: any;
} = {
  friends: [] as any[],
  sharedPosts: [] as any[],
  activeInvite: null,
};

const mockAcceptFriendInvite = jest.fn();
const mockCreateFriendInvite = jest.fn();
const mockCreateSharedPost = jest.fn();
const mockDeleteOwnedSharedPostsForNotes = jest.fn();
const mockDeleteSharedPost = jest.fn();
const mockFindOwnedSharedPostIdsForNote = jest.fn();
const mockRefreshSharedFeed = jest.fn();
const mockRemoveFriend = jest.fn();
const mockRevokeFriendInvite = jest.fn();
const mockSubscribeToSharedFeed = jest.fn();
const mockUpdateSharedPost = jest.fn();
const mockGetCachedSharedFeedSnapshot = jest.fn();
const mockCacheSharedFeedSnapshot = jest.fn();
const mockClearSharedFeedCache = jest.fn();
const mockReplaceCachedActiveInvite = jest.fn();
let latestSharedFeedSubscriptionHandlers:
  | {
      onSnapshot: (snapshot: { friends: any[]; sharedPosts: any[]; activeInvite: any }) => void;
      onError?: (error: unknown) => void;
    }
  | null = null;
let appStateListener: ((state: AppStateStatus) => void) | null = null;

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('../hooks/useConnectivity', () => ({
  useConnectivity: () => mockConnectivityState,
}));

jest.mock('../services/sharedFeedCache', () => ({
  cacheSharedFeedSnapshot: (...args: unknown[]) => mockCacheSharedFeedSnapshot(...args),
  getCachedSharedFeedSnapshot: (...args: unknown[]) => mockGetCachedSharedFeedSnapshot(...args),
  clearSharedFeedCache: (...args: unknown[]) => mockClearSharedFeedCache(...args),
  replaceCachedActiveInvite: (...args: unknown[]) => mockReplaceCachedActiveInvite(...args),
}));

jest.mock('../services/sharedFeedService', () => ({
  acceptFriendInvite: (...args: unknown[]) => mockAcceptFriendInvite(...args),
  createFriendInvite: (...args: unknown[]) => mockCreateFriendInvite(...args),
  createSharedPost: (...args: unknown[]) => mockCreateSharedPost(...args),
  deleteOwnedSharedPostsForNotes: (...args: unknown[]) => mockDeleteOwnedSharedPostsForNotes(...args),
  deleteSharedPost: (...args: unknown[]) => mockDeleteSharedPost(...args),
  findOwnedSharedPostIdsForNote: (...args: unknown[]) => mockFindOwnedSharedPostIdsForNote(...args),
  getSharedFeedErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'unknown error',
  refreshSharedFeed: (...args: unknown[]) => mockRefreshSharedFeed(...args),
  removeFriend: (...args: unknown[]) => mockRemoveFriend(...args),
  revokeFriendInvite: (...args: unknown[]) => mockRevokeFriendInvite(...args),
  subscribeToSharedFeed: (...args: unknown[]) => mockSubscribeToSharedFeed(...args),
  updateSharedPost: (...args: unknown[]) => mockUpdateSharedPost(...args),
}));

import { SharedFeedProvider, useSharedFeedStore } from '../hooks/useSharedFeed';

const wrapper = ({ children }: { children: ReactNode }) => (
  <SharedFeedProvider>{children}</SharedFeedProvider>
);

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createSharedPost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'shared-note-1',
    authorUid: 'me',
    authorDisplayName: 'Me',
    authorPhotoURLSnapshot: null,
    audienceUserIds: ['me', 'friend-1'],
    type: 'text',
    text: 'Original shared text',
    photoPath: null,
    photoLocalUri: null,
    isLivePhoto: false,
    pairedVideoPath: null,
    pairedVideoLocalUri: null,
    doodleStrokesJson: null,
    hasStickers: false,
    stickerPlacementsJson: null,
    noteColor: null,
    placeName: 'District 1',
    sourceNoteId: 'note-1',
    latitude: 10.77,
    longitude: 106.69,
    createdAt: '2026-03-23T00:00:00.000Z',
    updatedAt: null,
    ...overrides,
  } as any;
}

function createNote(overrides: Record<string, unknown> = {}) {
  return {
    id: 'note-1',
    type: 'text',
    content: 'Updated note text',
    locationName: 'Cafe',
    latitude: 10.77,
    longitude: 106.69,
    radius: 150,
    isFavorite: false,
    createdAt: '2026-03-23T00:00:00.000Z',
    updatedAt: '2026-03-24T00:00:00.000Z',
    moodEmoji: '🙂',
    noteColor: null,
    hasDoodle: false,
    doodleStrokesJson: null,
    hasStickers: false,
    stickerPlacementsJson: null,
    photoLocalUri: null,
    photoRemoteBase64: null,
    isLivePhoto: false,
    pairedVideoLocalUri: null,
    pairedVideoRemotePath: null,
    ...overrides,
  } as any;
}

describe('useSharedFeedStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    appStateListener = null;
    mockAuthState.isReady = true;
    mockAuthState.isAuthAvailable = true;
    mockAuthState.user = {
      id: 'me',
      uid: 'me',
      displayName: 'Me',
      email: 'me@example.com',
      photoURL: null,
      providerData: [],
    } as any;
    mockConnectivityState.isOnline = true;
    mockCachedSnapshot = {
      friends: [],
      sharedPosts: [],
      activeInvite: null,
      lastUpdatedAt: null,
    };
    mockRefreshSnapshot = {
      friends: [],
      sharedPosts: [],
      activeInvite: null,
    };
    mockGetCachedSharedFeedSnapshot.mockImplementation(async () => mockCachedSnapshot);
    mockRefreshSharedFeed.mockImplementation(async () => mockRefreshSnapshot);
    latestSharedFeedSubscriptionHandlers = null;
    mockSubscribeToSharedFeed.mockImplementation((_user: unknown, handlers: any) => {
      latestSharedFeedSubscriptionHandlers = handlers;
      return () => undefined;
    });
    mockCreateFriendInvite.mockResolvedValue({
      id: 'invite-1',
      inviterUid: 'me',
      inviterDisplayNameSnapshot: 'Me',
      inviterPhotoURLSnapshot: null,
      token: 'token-1',
      createdAt: '2026-03-23T00:00:00.000Z',
      revokedAt: null,
      acceptedByUid: null,
      acceptedAt: null,
      expiresAt: null,
      url: 'noto://friends/join?inviteId=invite-1&invite=token-1',
    });
    mockAcceptFriendInvite.mockResolvedValue({
      userId: 'friend-1',
      displayNameSnapshot: 'Lan',
      photoURLSnapshot: null,
      friendedAt: '2026-03-21T00:00:00.000Z',
      lastSharedAt: null,
      createdByInviteId: 'invite-1',
    });
    mockRemoveFriend.mockResolvedValue(undefined);
    mockCreateSharedPost.mockResolvedValue(null);
    mockDeleteOwnedSharedPostsForNotes.mockResolvedValue([]);
    mockDeleteSharedPost.mockResolvedValue(undefined);
    mockFindOwnedSharedPostIdsForNote.mockResolvedValue([]);
    mockRevokeFriendInvite.mockResolvedValue(undefined);
    mockUpdateSharedPost.mockResolvedValue(undefined);
    mockCacheSharedFeedSnapshot.mockResolvedValue(undefined);
    mockClearSharedFeedCache.mockResolvedValue(undefined);
    mockReplaceCachedActiveInvite.mockResolvedValue(undefined);
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener: (state: AppStateStatus) => void) => {
      appStateListener = listener;
      return {
        remove: jest.fn(() => {
          if (appStateListener === listener) {
            appStateListener = null;
          }
        }),
      } as any;
    });
  });

  it('hydrates the active invite from cache', async () => {
    mockCachedSnapshot = {
      friends: [],
      sharedPosts: [],
      activeInvite: {
        id: 'invite-1',
        inviterUid: 'me',
        inviterDisplayNameSnapshot: 'Me',
        inviterPhotoURLSnapshot: null,
        token: 'token-1',
        createdAt: '2026-03-23T00:00:00.000Z',
        revokedAt: null,
        acceptedByUid: null,
        acceptedAt: null,
        expiresAt: null,
        url: 'noto://friends/join?inviteId=invite-1&invite=token-1',
      },
      lastUpdatedAt: '2026-03-23T00:00:00.000Z',
    };

    const { result } = renderHook(() => useSharedFeedStore(), { wrapper });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
      expect(result.current.activeInvite).toEqual(
        expect.objectContaining({
          id: 'invite-1',
          token: 'token-1',
        })
      );
    });
  });

  it('persists live shared-feed snapshots from subscription updates', async () => {
    const { result } = renderHook(() => useSharedFeedStore(), { wrapper });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    await act(async () => {
      latestSharedFeedSubscriptionHandlers?.onSnapshot({
        friends: [
          {
            userId: 'friend-1',
            displayNameSnapshot: 'Lan',
            photoURLSnapshot: null,
            friendedAt: '2026-03-21T00:00:00.000Z',
            lastSharedAt: null,
            createdByInviteId: 'invite-1',
          },
        ],
        sharedPosts: [createSharedPost()],
        activeInvite: null,
      });
    });

    await waitFor(() => {
      expect(mockCacheSharedFeedSnapshot).toHaveBeenCalledWith(
        'me',
        expect.objectContaining({
          sharedPosts: [expect.objectContaining({ id: 'shared-note-1' })],
        })
      );
    });
  });

  it('does not apply a stale cached snapshot after switching accounts', async () => {
    const deferredCache = createDeferred<typeof mockCachedSnapshot>();
    mockGetCachedSharedFeedSnapshot.mockImplementationOnce(() => deferredCache.promise);

    const { result, rerender } = renderHook(() => useSharedFeedStore(), { wrapper });

    mockAuthState.user = {
      id: 'other-user',
      uid: 'other-user',
      displayName: 'Other',
      email: 'other@example.com',
      photoURL: null,
      providerData: [],
    } as any;
    mockCachedSnapshot = {
      friends: [],
      sharedPosts: [createSharedPost({ id: 'fresh-post', authorUid: 'other-user' })],
      activeInvite: null,
      lastUpdatedAt: '2026-03-24T00:00:00.000Z',
    };

    rerender({});

    await act(async () => {
      deferredCache.resolve({
        friends: [],
        sharedPosts: [createSharedPost({ id: 'stale-post', authorUid: 'me' })],
        activeInvite: null,
        lastUpdatedAt: '2026-03-23T00:00:00.000Z',
      });
      await deferredCache.promise;
    });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
      expect(result.current.sharedPosts).toEqual([
        expect.objectContaining({ id: 'fresh-post', authorUid: 'other-user' }),
      ]);
    });
  });

  it('persists invite cache updates when creating and revoking an invite', async () => {
    const { result } = renderHook(() => useSharedFeedStore(), { wrapper });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    let invite: any;
    await act(async () => {
      invite = await result.current.createFriendInvite();
    });

    expect(invite).toEqual(
      expect.objectContaining({
        id: 'invite-1',
      })
    );
    expect(mockCacheSharedFeedSnapshot).toHaveBeenCalledWith(
      'me',
      expect.objectContaining({
        friends: expect.any(Array),
        sharedPosts: expect.any(Array),
        activeInvite: expect.objectContaining({
          id: 'invite-1',
        }),
      })
    );

    await act(async () => {
      await result.current.revokeFriendInvite('invite-1');
    });

    expect(mockCacheSharedFeedSnapshot).toHaveBeenLastCalledWith(
      'me',
      expect.objectContaining({
        friends: expect.any(Array),
        sharedPosts: expect.any(Array),
        activeInvite: null,
      })
    );
    expect(mockReplaceCachedActiveInvite).not.toHaveBeenCalled();
  });

  it('keeps a revoked invite hidden even if a stale snapshot still includes it', async () => {
    mockCachedSnapshot = {
      friends: [],
      sharedPosts: [],
      activeInvite: {
        id: 'invite-1',
        inviterUid: 'me',
        inviterDisplayNameSnapshot: 'Me',
        inviterPhotoURLSnapshot: null,
        token: 'token-1',
        createdAt: '2026-03-23T00:00:00.000Z',
        revokedAt: null,
        acceptedByUid: null,
        acceptedAt: null,
        expiresAt: null,
        url: 'noto://friends/join?inviteId=invite-1&invite=token-1',
      },
      lastUpdatedAt: '2026-03-23T00:00:00.000Z',
    };

    const { result } = renderHook(() => useSharedFeedStore(), { wrapper });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
      expect(result.current.activeInvite).not.toBeNull();
    });

    await act(async () => {
      await result.current.revokeFriendInvite('invite-1');
    });

    expect(result.current.activeInvite).toBeNull();

    act(() => {
      latestSharedFeedSubscriptionHandlers?.onSnapshot({
        friends: [],
        sharedPosts: [],
        activeInvite: {
          id: 'invite-1',
          inviterUid: 'me',
          inviterDisplayNameSnapshot: 'Me',
          inviterPhotoURLSnapshot: null,
          token: 'token-1',
          createdAt: '2026-03-23T00:00:00.000Z',
          revokedAt: null,
          acceptedByUid: null,
          acceptedAt: null,
          expiresAt: null,
          url: 'noto://friends/join?inviteId=invite-1&invite=token-1',
        },
      });
    });

    expect(result.current.activeInvite).toBeNull();
  });

  it('adds the new friend to local state as soon as an invite is accepted', async () => {
    mockRefreshSnapshot = {
      friends: [
        {
          userId: 'friend-1',
          displayNameSnapshot: 'Lan',
          photoURLSnapshot: null,
          friendedAt: '2026-03-21T00:00:00.000Z',
          lastSharedAt: null,
          createdByInviteId: 'invite-1',
        },
      ],
      sharedPosts: [],
      activeInvite: null,
    };

    const { result } = renderHook(() => useSharedFeedStore(), { wrapper });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    await act(async () => {
      await result.current.acceptFriendInvite('noto://friends/join?invite=token');
    });

    expect(mockAcceptFriendInvite).toHaveBeenCalledWith(
      mockAuthState.user,
      'noto://friends/join?invite=token'
    );
    expect(result.current.friends).toEqual([
      expect.objectContaining({
        userId: 'friend-1',
        displayNameSnapshot: 'Lan',
      }),
    ]);
  });

  it('removes the friend and their shared posts from local state immediately', async () => {
    mockCachedSnapshot = {
      friends: [
        {
          userId: 'friend-1',
          displayNameSnapshot: 'Lan',
          photoURLSnapshot: null,
          friendedAt: '2026-03-21T00:00:00.000Z',
          lastSharedAt: null,
          createdByInviteId: 'invite-1',
        },
        {
          userId: 'friend-2',
          displayNameSnapshot: 'Minh',
          photoURLSnapshot: null,
          friendedAt: '2026-03-22T00:00:00.000Z',
          lastSharedAt: null,
          createdByInviteId: 'invite-2',
        },
      ],
      sharedPosts: [
        {
          id: 'shared-friend',
          authorUid: 'friend-1',
          authorDisplayName: 'Lan',
          audienceUserIds: ['me', 'friend-1'],
          type: 'text',
          text: 'Friend post',
          photoPath: null,
          photoLocalUri: null,
          placeName: 'District 3',
          sourceNoteId: null,
          createdAt: '2026-03-22T00:00:00.000Z',
          updatedAt: null,
        },
        {
          id: 'shared-owned',
          authorUid: 'me',
          authorDisplayName: 'Me',
          audienceUserIds: ['me', 'friend-1'],
          type: 'text',
          text: 'My post',
          photoPath: null,
          photoLocalUri: null,
          placeName: 'District 1',
          sourceNoteId: null,
          createdAt: '2026-03-23T00:00:00.000Z',
          updatedAt: null,
        },
        {
          id: 'shared-owned-group',
          authorUid: 'me',
          authorDisplayName: 'Me',
          audienceUserIds: ['me', 'friend-1', 'friend-2'],
          type: 'text',
          text: 'My group post',
          photoPath: null,
          photoLocalUri: null,
          placeName: 'District 7',
          sourceNoteId: null,
          createdAt: '2026-03-24T00:00:00.000Z',
          updatedAt: null,
        },
      ],
      activeInvite: null,
      lastUpdatedAt: '2026-03-23T00:00:00.000Z',
    };
    mockRefreshSnapshot = {
      friends: [
        {
          userId: 'friend-2',
          displayNameSnapshot: 'Minh',
          photoURLSnapshot: null,
          friendedAt: '2026-03-22T00:00:00.000Z',
          lastSharedAt: null,
          createdByInviteId: 'invite-2',
        },
      ],
      sharedPosts: [
        {
          id: 'shared-owned-group',
          authorUid: 'me',
          authorDisplayName: 'Me',
          audienceUserIds: ['me', 'friend-2'],
          type: 'text',
          text: 'My group post',
          photoPath: null,
          photoLocalUri: null,
          placeName: 'District 7',
          sourceNoteId: null,
          createdAt: '2026-03-24T00:00:00.000Z',
          updatedAt: null,
        },
      ],
      activeInvite: null,
    };

    const { result } = renderHook(() => useSharedFeedStore(), { wrapper });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
      expect(result.current.friends).toHaveLength(2);
      expect(result.current.sharedPosts).toHaveLength(3);
    });

    await act(async () => {
      await result.current.removeFriend('friend-1');
    });

    expect(mockRemoveFriend).toHaveBeenCalledWith(mockAuthState.user, 'friend-1');
    expect(result.current.friends).toEqual([
      expect.objectContaining({
        userId: 'friend-2',
      }),
    ]);
    expect(result.current.sharedPosts).toEqual([
      expect.objectContaining({
        id: 'shared-owned-group',
        authorUid: 'me',
        audienceUserIds: ['me', 'friend-2'],
      }),
    ]);
    expect(mockCacheSharedFeedSnapshot).toHaveBeenCalledWith(
      'me',
      expect.objectContaining({
        friends: [
          expect.objectContaining({
            userId: 'friend-2',
          }),
        ],
        sharedPosts: [
          expect.objectContaining({
            id: 'shared-owned-group',
            audienceUserIds: ['me', 'friend-2'],
          }),
        ],
      })
    );
  });

  it('removes owned shared posts for deleted notes from local state immediately', async () => {
    mockCachedSnapshot = {
      friends: [],
      sharedPosts: [
        {
          id: 'shared-note-1',
          authorUid: 'me',
          authorDisplayName: 'Me',
          audienceUserIds: ['me', 'friend-1'],
          type: 'text',
          text: 'Note 1',
          photoPath: null,
          photoLocalUri: null,
          placeName: 'District 1',
          sourceNoteId: 'note-1',
          createdAt: '2026-03-23T00:00:00.000Z',
          updatedAt: null,
        },
        {
          id: 'shared-note-2',
          authorUid: 'me',
          authorDisplayName: 'Me',
          audienceUserIds: ['me', 'friend-1'],
          type: 'text',
          text: 'Note 2',
          photoPath: null,
          photoLocalUri: null,
          placeName: 'District 2',
          sourceNoteId: 'note-2',
          createdAt: '2026-03-24T00:00:00.000Z',
          updatedAt: null,
        },
        {
          id: 'shared-other',
          authorUid: 'friend-1',
          authorDisplayName: 'Lan',
          audienceUserIds: ['me', 'friend-1'],
          type: 'text',
          text: 'Friend post',
          photoPath: null,
          photoLocalUri: null,
          placeName: 'District 3',
          sourceNoteId: 'note-9',
          createdAt: '2026-03-25T00:00:00.000Z',
          updatedAt: null,
        },
      ],
      activeInvite: null,
      lastUpdatedAt: '2026-03-25T00:00:00.000Z',
    };
    mockDeleteOwnedSharedPostsForNotes.mockResolvedValue([]);

    const { result } = renderHook(() => useSharedFeedStore(), { wrapper });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
      expect(result.current.sharedPosts).toHaveLength(3);
    });

    await act(async () => {
      await result.current.deleteSharedNotes(['note-1', 'note-2']);
    });

    expect(mockDeleteOwnedSharedPostsForNotes).toHaveBeenCalledWith(mockAuthState.user, ['note-1', 'note-2']);
    expect(result.current.sharedPosts).toEqual([
      expect.objectContaining({
        id: 'shared-other',
        authorUid: 'friend-1',
      }),
    ]);
    expect(mockCacheSharedFeedSnapshot).toHaveBeenCalledWith(
      'me',
      expect.objectContaining({
        sharedPosts: [
          expect.objectContaining({
            id: 'shared-other',
          }),
        ],
      })
    );
  });

  it('persists a newly created shared post into the offline cache', async () => {
    const { result } = renderHook(() => useSharedFeedStore(), { wrapper });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    mockCreateSharedPost.mockResolvedValueOnce(createSharedPost());

    await act(async () => {
      await result.current.createSharedPost(createNote(), ['friend-1']);
    });

    expect(result.current.sharedPosts).toEqual([
      expect.objectContaining({
        id: 'shared-note-1',
        text: 'Original shared text',
      }),
    ]);
    expect(mockCacheSharedFeedSnapshot).toHaveBeenCalledWith(
      'me',
      expect.objectContaining({
        sharedPosts: [
          expect.objectContaining({
            id: 'shared-note-1',
          }),
        ],
      })
    );
  });

  it('updates the local shared post and cached snapshot when the source note changes', async () => {
    mockCachedSnapshot = {
      friends: [],
      sharedPosts: [createSharedPost()],
      activeInvite: null,
      lastUpdatedAt: '2026-03-23T00:00:00.000Z',
    };
    mockUpdateSharedPost.mockResolvedValue(undefined);

    const { result } = renderHook(() => useSharedFeedStore(), { wrapper });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
      expect(result.current.sharedPosts).toHaveLength(1);
    });

    const nextNote = createNote({
      content: 'Edited note text',
      updatedAt: '2026-03-25T00:00:00.000Z',
    });

    await act(async () => {
      await result.current.updateSharedNote(nextNote);
    });

    expect(mockUpdateSharedPost).toHaveBeenCalledWith(mockAuthState.user, 'shared-note-1', nextNote);
    expect(result.current.sharedPosts).toEqual([
      expect.objectContaining({
        id: 'shared-note-1',
        text: 'Edited note text',
        updatedAt: expect.any(String),
      }),
    ]);
    expect(mockCacheSharedFeedSnapshot).toHaveBeenCalledWith(
      'me',
      expect.objectContaining({
        sharedPosts: [
          expect.objectContaining({
            id: 'shared-note-1',
            text: 'Edited note text',
          }),
        ],
      })
    );
  });

  it('refreshes the shared feed when the app becomes active again', async () => {
    const { result } = renderHook(() => useSharedFeedStore(), { wrapper });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    expect(mockRefreshSharedFeed).not.toHaveBeenCalled();

    await act(async () => {
      appStateListener?.('background');
    });

    expect(mockRefreshSharedFeed).not.toHaveBeenCalled();

    await act(async () => {
      appStateListener?.('active');
    });

    await waitFor(() => {
      expect(mockRefreshSharedFeed).toHaveBeenCalledTimes(1);
    });
  });
});

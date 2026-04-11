import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useHomeFeedPagination } from '../hooks/app/useHomeFeedPagination';

const mockGetNotesPageForScope = jest.fn();
const mockGetCachedSharedPostsPage = jest.fn();

jest.mock('../services/database', () => ({
  getNotesPageForScope: (scope: string, options: { limit: number; offset?: number }) =>
    mockGetNotesPageForScope(scope, options),
}));

jest.mock('../services/sharedFeedCache', () => ({
  getCachedSharedPostsPage: (
    userUid: string,
    options: { limit: number; offset?: number; excludeAuthorUid?: string | null }
  ) => mockGetCachedSharedPostsPage(userUid, options),
}));

describe('useHomeFeedPagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads the first note and friend-post pages and merges them by recency', async () => {
    const notes = [
      {
        id: 'note-1',
        type: 'text',
        content: 'Newest local note',
        locationName: 'District 1',
        latitude: 10.7,
        longitude: 106.6,
        radius: 150,
        isFavorite: false,
        createdAt: '2026-04-10T00:00:00.000Z',
        updatedAt: null,
      },
      {
        id: 'note-2',
        type: 'text',
        content: 'Older local note',
        locationName: 'District 3',
        latitude: 10.8,
        longitude: 106.7,
        radius: 150,
        isFavorite: false,
        createdAt: '2026-04-08T00:00:00.000Z',
        updatedAt: null,
      },
    ];
    const sharedPosts = [
      {
        id: 'shared-owned',
        authorUid: 'me',
        authorDisplayName: 'You',
        type: 'text',
        text: 'Owned shared note',
        placeName: 'District 2',
        createdAt: '2026-04-11T00:00:00.000Z',
      },
      {
        id: 'shared-friend-1',
        authorUid: 'friend-1',
        authorDisplayName: 'Lan',
        type: 'text',
        text: 'Newest friend memory',
        placeName: 'District 5',
        createdAt: '2026-04-09T00:00:00.000Z',
      },
      {
        id: 'shared-friend-2',
        authorUid: 'friend-2',
        authorDisplayName: 'Minh',
        type: 'text',
        text: 'Older friend memory',
        placeName: 'District 7',
        createdAt: '2026-04-07T00:00:00.000Z',
      },
    ];

    mockGetNotesPageForScope.mockImplementation(async (_scope: string, options: { limit: number }) =>
      notes.slice(0, options.limit)
    );
    mockGetCachedSharedPostsPage.mockImplementation(
      async (_userUid: string, options: { limit: number; excludeAuthorUid?: string | null }) =>
        sharedPosts
          .filter((post) => post.authorUid !== options.excludeAuthorUid)
          .slice(0, options.limit)
    );

    const { result } = renderHook(() =>
      useHomeFeedPagination({
        notesScope: '__local__',
        sharedCacheUserUid: 'me',
        notesSignal: notes,
        sharedSignal: sharedPosts,
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items.map((item) => `${item.kind}:${item.id}`)).toEqual([
      'note:note-1',
      'shared-post:shared-friend-1',
      'note:note-2',
      'shared-post:shared-friend-2',
    ]);
    expect(mockGetCachedSharedPostsPage).toHaveBeenCalledWith('me', expect.objectContaining({
      excludeAuthorUid: 'me',
    }));
  });

  it('loads additional note pages until a focused note is available', async () => {
    const notes = Array.from({ length: 30 }, (_, index) => ({
      id: `note-${index + 1}`,
      type: 'text' as const,
      content: `Note ${index + 1}`,
      locationName: `Place ${index + 1}`,
      latitude: 10 + index,
      longitude: 106 + index,
      radius: 150,
      isFavorite: false,
      createdAt: new Date(Date.UTC(2026, 3, 30 - index)).toISOString(),
      updatedAt: null,
    }));
    const sharedSignal: any[] = [];

    mockGetNotesPageForScope.mockImplementation(async (_scope: string, options: { limit: number }) =>
      notes.slice(0, options.limit)
    );
    mockGetCachedSharedPostsPage.mockResolvedValue([]);

    const { result } = renderHook(() =>
      useHomeFeedPagination({
        notesScope: '__local__',
        sharedCacheUserUid: null,
        notesSignal: notes,
        sharedSignal,
      })
    );

    await waitFor(() => {
      expect(result.current.items).toHaveLength(24);
    });

    let targetIndex = -1;
    await act(async () => {
      targetIndex = await result.current.ensureTargetLoaded({
        kind: 'note',
        id: 'note-30',
      });
    });

    expect(targetIndex).toBe(29);
    expect(result.current.items).toHaveLength(30);
    expect(mockGetNotesPageForScope).toHaveBeenNthCalledWith(
      1,
      '__local__',
      expect.objectContaining({ limit: 25 })
    );
    expect(mockGetNotesPageForScope).toHaveBeenNthCalledWith(
      2,
      '__local__',
      expect.objectContaining({ limit: 49 })
    );
  });
});

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useHomeFeedPagination } from '../hooks/app/useHomeFeedPagination';
import type { Note } from '../services/database';
import type { SharedPost } from '../services/sharedFeedService';

const mockGetNotesPageForScope = jest.fn();

jest.mock('../services/database', () => ({
  getNotesPageForScope: (scope: string, options: { limit: number; offset?: number }) =>
    mockGetNotesPageForScope(scope, options),
}));

describe('useHomeFeedPagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads the first note and friend-post pages and merges them by recency', async () => {
    const notes: Note[] = [
      {
        id: 'note-1',
        type: 'text',
        content: 'Newest local note',
        locationName: 'District 1',
        latitude: 10.7,
        longitude: 106.6,
        radius: 150,
        isFavorite: false,
        hasDoodle: false,
        doodleStrokesJson: null,
        hasStickers: false,
        stickerPlacementsJson: null,
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
        hasDoodle: false,
        doodleStrokesJson: null,
        hasStickers: false,
        stickerPlacementsJson: null,
        createdAt: '2026-04-08T00:00:00.000Z',
        updatedAt: null,
      },
    ];
    const sharedPosts: SharedPost[] = [
      {
        id: 'shared-owned',
        authorUid: 'me',
        authorDisplayName: 'You',
        authorPhotoURLSnapshot: null,
        audienceUserIds: [],
        type: 'text',
        text: 'Owned shared note',
        photoPath: null,
        photoLocalUri: null,
        isLivePhoto: false,
        pairedVideoPath: null,
        pairedVideoLocalUri: null,
        doodleStrokesJson: null,
        hasStickers: false,
        stickerPlacementsJson: null,
        noteColor: null,
        placeName: 'District 2',
        sourceNoteId: null,
        latitude: null,
        longitude: null,
        createdAt: '2026-04-11T00:00:00.000Z',
        updatedAt: null,
      },
      {
        id: 'shared-friend-1',
        authorUid: 'friend-1',
        authorDisplayName: 'Lan',
        authorPhotoURLSnapshot: null,
        audienceUserIds: [],
        type: 'text',
        text: 'Newest friend memory',
        photoPath: null,
        photoLocalUri: null,
        isLivePhoto: false,
        pairedVideoPath: null,
        pairedVideoLocalUri: null,
        doodleStrokesJson: null,
        hasStickers: false,
        stickerPlacementsJson: null,
        noteColor: null,
        placeName: 'District 5',
        sourceNoteId: null,
        latitude: null,
        longitude: null,
        createdAt: '2026-04-09T00:00:00.000Z',
        updatedAt: null,
      },
      {
        id: 'shared-friend-2',
        authorUid: 'friend-2',
        authorDisplayName: 'Minh',
        authorPhotoURLSnapshot: null,
        audienceUserIds: [],
        type: 'text',
        text: 'Older friend memory',
        photoPath: null,
        photoLocalUri: null,
        isLivePhoto: false,
        pairedVideoPath: null,
        pairedVideoLocalUri: null,
        doodleStrokesJson: null,
        hasStickers: false,
        stickerPlacementsJson: null,
        noteColor: null,
        placeName: 'District 7',
        sourceNoteId: null,
        latitude: null,
        longitude: null,
        createdAt: '2026-04-07T00:00:00.000Z',
        updatedAt: null,
      },
    ];

    mockGetNotesPageForScope.mockImplementation(async (_scope: string, options: { limit: number }) =>
      notes.slice(0, options.limit)
    );
    const { result } = renderHook(() =>
      useHomeFeedPagination({
        notesScope: '__local__',
        sharedCacheUserUid: 'me',
        seedNotes: notes,
        seedNoteCount: notes.length,
        seedSharedPosts: sharedPosts,
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
    expect(mockGetNotesPageForScope).not.toHaveBeenCalled();
  });

  it('loads additional note pages until a focused note is available', async () => {
    const notes: Note[] = Array.from({ length: 30 }, (_, index) => ({
      id: `note-${index + 1}`,
      type: 'text' as const,
      content: `Note ${index + 1}`,
      locationName: `Place ${index + 1}`,
      latitude: 10 + index,
      longitude: 106 + index,
      radius: 150,
      isFavorite: false,
      hasDoodle: false,
      doodleStrokesJson: null,
      hasStickers: false,
      stickerPlacementsJson: null,
      createdAt: new Date(Date.UTC(2026, 3, 30 - index)).toISOString(),
      updatedAt: null,
    }));
    const seedNotes = notes.slice(0, 24);
    const sharedSignal: any[] = [];

    mockGetNotesPageForScope.mockImplementation(async (_scope: string, options: { limit: number }) =>
      notes.slice(0, options.limit)
    );
    const { result } = renderHook(() =>
      useHomeFeedPagination({
        notesScope: '__local__',
        sharedCacheUserUid: null,
        seedNotes,
        seedNoteCount: notes.length,
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
    expect(mockGetNotesPageForScope).toHaveBeenCalledTimes(1);
    expect(mockGetNotesPageForScope).toHaveBeenCalledWith(
      '__local__',
      expect.objectContaining({ limit: 49 })
    );
  });
});

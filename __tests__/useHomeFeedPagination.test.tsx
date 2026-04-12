import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useHomeFeedPagination } from '../hooks/app/useHomeFeedPagination';
import type { Note } from '../services/database';
import type { SharedPost } from '../services/sharedFeedService';

const mockLoadNextNotesPage = jest.fn();

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

    const { result } = renderHook(() =>
      useHomeFeedPagination({
        notesScope: '__local__',
        sharedCacheUserUid: 'me',
        seedNotes: notes,
        seedNoteCount: notes.length,
        loadNextNotesPage: mockLoadNextNotesPage,
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
    expect(mockLoadNextNotesPage).not.toHaveBeenCalled();
  });

  it('does not try to load more when the seeded window already contains every note', async () => {
    const notes: Note[] = Array.from({ length: 5 }, (_, index) => ({
      id: `note-${index + 1}`,
      type: 'text',
      content: `Note ${index + 1}`,
      locationName: `District ${index + 1}`,
      latitude: 10.7 + index,
      longitude: 106.6 + index,
      radius: 150,
      isFavorite: false,
      hasDoodle: false,
      doodleStrokesJson: null,
      hasStickers: false,
      stickerPlacementsJson: null,
      createdAt: new Date(Date.UTC(2026, 3, 10 - index)).toISOString(),
      updatedAt: null,
    }));

    const { result } = renderHook(() =>
      useHomeFeedPagination({
        notesScope: '__local__',
        sharedCacheUserUid: null,
        seedNotes: notes,
        seedNoteCount: notes.length,
        loadNextNotesPage: mockLoadNextNotesPage,
        notesSignal: notes,
        sharedSignal: [],
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasMore).toBe(false);
      expect(result.current.items).toHaveLength(5);
    });

    await act(async () => {
      await result.current.loadNextPage();
    });

    expect(mockLoadNextNotesPage).not.toHaveBeenCalled();
  });

  it('keeps seeded notes visible while shared feed loading finishes', async () => {
    const notes: Note[] = Array.from({ length: 5 }, (_, index) => ({
      id: `note-${index + 1}`,
      type: 'text',
      content: `Note ${index + 1}`,
      locationName: `District ${index + 1}`,
      latitude: 10.7 + index,
      longitude: 106.6 + index,
      radius: 150,
      isFavorite: false,
      hasDoodle: false,
      doodleStrokesJson: null,
      hasStickers: false,
      stickerPlacementsJson: null,
      createdAt: new Date(Date.UTC(2026, 3, 10 - index)).toISOString(),
      updatedAt: null,
    }));
    const sharedSignal: SharedPost[] = [];
    const baseProps = {
      notesScope: '__local__',
      sharedCacheUserUid: 'me',
      seedNotes: notes,
      seedNoteCount: notes.length,
      loadNextNotesPage: mockLoadNextNotesPage,
      seedSharedPosts: sharedSignal,
      notesSignal: notes,
      sharedSignal,
    } as const;

    const { result, rerender } = renderHook(
      (props: {
        notesScope: string;
        sharedCacheUserUid: string | null;
        seedNotes: Note[];
        seedNoteCount: number;
        loadNextNotesPage: () => Promise<Note[]>;
        seedSharedPosts: SharedPost[];
        sharedLoading: boolean;
        notesSignal: Note[];
        sharedSignal: SharedPost[];
      }) =>
        useHomeFeedPagination({
          ...props,
          notesLoading: false,
        }),
      {
        initialProps: {
          ...baseProps,
          sharedLoading: true,
        },
      }
    );

    expect(result.current.items).toHaveLength(5);
    expect(result.current.hasMore).toBe(false);

    act(() => {
      rerender({
        ...baseProps,
        sharedLoading: false,
      });
    });

    expect(result.current.items).toHaveLength(5);
    expect(result.current.hasMore).toBe(false);
    expect(mockLoadNextNotesPage).not.toHaveBeenCalled();
  });

  it('asks the notes store for the next page when the visible window grows past seeded notes', async () => {
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
    mockLoadNextNotesPage.mockImplementation(async () => notes);

    const { result } = renderHook(() =>
      useHomeFeedPagination({
        notesScope: '__local__',
        sharedCacheUserUid: null,
        seedNotes,
        seedNoteCount: notes.length,
        loadNextNotesPage: mockLoadNextNotesPage,
        notesSignal: seedNotes,
        sharedSignal: [],
      })
    );

    await waitFor(() => {
      expect(result.current.items).toHaveLength(24);
    });

    await act(async () => {
      await result.current.loadNextPage();
    });

    expect(mockLoadNextNotesPage).toHaveBeenCalledTimes(1);
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
    mockLoadNextNotesPage.mockImplementation(async () => notes);

    const { result } = renderHook(() =>
      useHomeFeedPagination({
        notesScope: '__local__',
        sharedCacheUserUid: null,
        seedNotes,
        seedNoteCount: notes.length,
        loadNextNotesPage: mockLoadNextNotesPage,
        notesSignal: seedNotes,
        sharedSignal: [],
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
    expect(mockLoadNextNotesPage).toHaveBeenCalledTimes(1);
  });
});

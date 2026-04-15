import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ReactNode } from 'react';
import { NotesProvider, useNotesStore } from '../hooks/useNotes';
import type { Note } from '../services/database';

const mockSyncGeofenceRegions = jest.fn();
const mockClearGeofenceRegions = jest.fn();
const mockSkipImmediateReminderForNewNote = jest.fn();
const mockScheduleWidgetDataUpdate = jest.fn();
const mockCleanupOrphanMediaFiles = jest.fn();
const mockGetInfoAsync = jest.fn();
const mockDeleteAsync = jest.fn();
const mockGetAllNotesForScope = jest.fn();
const mockGetNotesPageForScope = jest.fn();
const mockGetActiveNotesScope = jest.fn(() => '__local__');
const mockUseAuth = jest.fn(() => ({
  user: null,
  isReady: true,
}));
const mockDbCreateNote = jest.fn(async (input: any) => {
  const nextNote: Note = {
    id: input.id ?? `note-${mockIdCounter++}`,
    type: input.type,
    content: input.content,
    locationName: input.locationName ?? null,
    latitude: input.latitude,
    longitude: input.longitude,
    radius: input.radius ?? 150,
    isFavorite: false,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
  mockNotesDb = [nextNote, ...mockNotesDb];
  return nextNote;
});

let mockNotesDb: Note[] = [];
let mockIdCounter = 1;

jest.mock('../utils/fileSystem', () => ({
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
}));

jest.mock('../services/geofenceService', () => ({
  syncGeofenceRegions: (...args: unknown[]) => mockSyncGeofenceRegions(...args),
  clearGeofenceRegions: (...args: unknown[]) => mockClearGeofenceRegions(...args),
  skipImmediateReminderForNewNote: (...args: unknown[]) => mockSkipImmediateReminderForNewNote(...args),
}));

jest.mock('../services/widgetService', () => ({
  scheduleWidgetDataUpdate: (...args: unknown[]) => mockScheduleWidgetDataUpdate(...args),
}));

jest.mock('../services/mediaIntegrity', () => ({
  cleanupOrphanMediaFiles: (...args: unknown[]) => mockCleanupOrphanMediaFiles(...args),
}));

jest.mock('../services/database', () => ({
  getActiveNotesScope: () => mockGetActiveNotesScope(),
  getAllNotes: jest.fn(async () => [...mockNotesDb]),
  getAllNotesForScope: (scope: string) => mockGetAllNotesForScope(scope),
  getNotesPageForScope: (scope: string, options: { limit: number; offset?: number }) =>
    mockGetNotesPageForScope(scope, options),
  getNoteById: jest.fn(async (id: string) => mockNotesDb.find((note) => note.id === id) ?? null),
  createNote: (input: any) => mockDbCreateNote(input),
  updateNote: jest.fn(async (id: string, updates: Partial<Note>) => {
    mockNotesDb = mockNotesDb.map((note) =>
      note.id === id
        ? {
            ...note,
            ...updates,
            updatedAt: new Date().toISOString(),
          }
        : note
    );
  }),
  toggleFavorite: jest.fn(async (id: string) => {
    let nextFavorite = false;
    mockNotesDb = mockNotesDb.map((note) => {
      if (note.id !== id) {
        return note;
      }
      nextFavorite = !note.isFavorite;
      return { ...note, isFavorite: nextFavorite };
    });
    return nextFavorite;
  }),
  searchNotes: jest.fn(async (query: string) =>
    mockNotesDb.filter(
      (note) =>
        note.content.toLowerCase().includes(query.toLowerCase()) ||
        note.locationName?.toLowerCase().includes(query.toLowerCase())
    )
  ),
  deleteNote: jest.fn(async (id: string) => {
    mockNotesDb = mockNotesDb.filter((note) => note.id !== id);
  }),
  deleteAllNotes: jest.fn(async () => {
    mockNotesDb = [];
  }),
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

function TestWrapper({ children }: { children: ReactNode }) {
  return <NotesProvider>{children}</NotesProvider>;
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mockIdCounter = 1;
  mockNotesDb = [];
  jest.clearAllMocks();
  mockCleanupOrphanMediaFiles.mockResolvedValue(undefined);
  mockGetInfoAsync.mockResolvedValue({ exists: true });
  mockDeleteAsync.mockResolvedValue(undefined);
  mockSyncGeofenceRegions.mockResolvedValue(true);
  mockClearGeofenceRegions.mockResolvedValue(undefined);
  mockSkipImmediateReminderForNewNote.mockResolvedValue(undefined);
  mockScheduleWidgetDataUpdate.mockResolvedValue(undefined);
  mockGetAllNotesForScope.mockImplementation(async () => [...mockNotesDb]);
  mockGetNotesPageForScope.mockImplementation(async (_scope: string, options: { limit: number }) =>
    mockNotesDb.slice(0, options.limit)
  );
  mockGetActiveNotesScope.mockReturnValue('__local__');
});

describe('useNotesStore', () => {
  it('creates text and photo notes then refreshes and searches', async () => {
    const { result } = renderHook(() => useNotesStore(), { wrapper: TestWrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createNote({
        type: 'text',
        content: 'Best iced coffee',
        locationName: 'District 1',
        latitude: 10.1,
        longitude: 106.1,
      });
      await result.current.createNote({
        type: 'photo',
        content: 'file:///photo-1.jpg',
        locationName: 'District 3',
        latitude: 10.2,
        longitude: 106.2,
      });
    });

    expect(result.current.notes).toHaveLength(2);
    const searchResult = await result.current.searchNotes('coffee');
    expect(searchResult).toHaveLength(1);

    await act(async () => {
      await result.current.refreshNotes(false);
    });

    expect(result.current.notes).toHaveLength(2);
    await waitFor(() => {
      expect(mockScheduleWidgetDataUpdate).toHaveBeenCalled();
    });
  });

  it('surfaces the newest notes first, then hydrates the full archive in the background', async () => {
    mockNotesDb = Array.from({ length: 30 }, (_, index) => ({
      id: `note-${index + 1}`,
      type: 'text' as const,
      content: `Note ${index + 1}`,
      locationName: `Place ${index + 1}`,
      latitude: 10 + index,
      longitude: 106 + index,
      radius: 150,
      isFavorite: false,
      createdAt: new Date(Date.now() - index * 1000).toISOString(),
      updatedAt: null,
    }));

    const deferredAllNotes = createDeferred<Note[]>();
    mockGetNotesPageForScope.mockImplementation(async (_scope: string, options: { limit: number }) =>
      mockNotesDb.slice(0, options.limit)
    );
    mockGetAllNotesForScope.mockImplementation(() => deferredAllNotes.promise);

    const { result } = renderHook(() => useNotesStore(), { wrapper: TestWrapper });

    expect(result.current.initialLoadComplete).toBe(false);

    await waitFor(() => {
      expect(result.current.initialLoadComplete).toBe(true);
      expect(result.current.notes).toHaveLength(24);
      expect(result.current.loading).toBe(true);
    });

    await act(async () => {
      deferredAllNotes.resolve([...mockNotesDb]);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.notes).toHaveLength(30);
    });
  });

  it('does not fail note creation when the skip-enter flag is still pending', async () => {
    const deferred = createDeferred<void>();
    mockSkipImmediateReminderForNewNote.mockImplementation(() => deferred.promise);

    const { result } = renderHook(() => useNotesStore(), { wrapper: TestWrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockSyncGeofenceRegions.mockClear();

    await act(async () => {
      await result.current.createNote({
        type: 'text',
        content: 'Reminder ordering',
        locationName: 'District 1',
        latitude: 10.1,
        longitude: 106.1,
      });
    });

    expect(result.current.notes[0]?.id).toBe('note-1');
    expect(result.current.notes).toHaveLength(1);
    expect(mockSkipImmediateReminderForNewNote).toHaveBeenCalledWith('note-1');
    expect(mockSyncGeofenceRegions).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve();
    });
  });

  it('prioritizes a newly created note in the next widget refresh', async () => {
    const { result } = renderHook(() => useNotesStore(), { wrapper: TestWrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockScheduleWidgetDataUpdate.mockClear();

    await act(async () => {
      await result.current.createNote({
        type: 'text',
        content: 'Freshly created memory',
        locationName: 'District 1',
        latitude: 10.1,
        longitude: 106.1,
      });
    });

    await waitFor(() => {
      expect(mockScheduleWidgetDataUpdate).toHaveBeenCalledWith(
        {
          notes: [
            expect.objectContaining({
              id: 'note-1',
              content: 'Freshly created memory',
            }),
          ],
          includeLocationLookup: false,
          preferredNoteId: 'note-1',
        },
        {
          debounceMs: 120,
        }
      );
    });
  });

  it('ignores a stale note creation after switching scopes', async () => {
    const deferredCreate = createDeferred<Note>();
    mockDbCreateNote.mockImplementationOnce(() => deferredCreate.promise);

    mockUseAuth.mockReturnValue({
      user: { uid: 'user-1' } as any,
      isReady: true,
    });

    const userTwoNote: Note = {
      id: 'note-user-2',
      type: 'text',
      content: 'User two note',
      locationName: 'User two place',
      latitude: 10.2,
      longitude: 106.2,
      radius: 150,
      isFavorite: false,
      createdAt: '2026-03-24T00:00:00.000Z',
      updatedAt: null,
    };
    mockGetAllNotesForScope.mockImplementation(async (scope: string) =>
      scope === 'user-2' ? [userTwoNote] : []
    );

    const { result, rerender } = renderHook(() => useNotesStore(), { wrapper: TestWrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let pendingCreatePromise: Promise<Note> = Promise.resolve({} as Note);
    await act(async () => {
      pendingCreatePromise = result.current.createNote({
        type: 'text',
        content: 'Stale user one note',
        locationName: 'User one place',
        latitude: 10.1,
        longitude: 106.1,
      });
    });

    mockUseAuth.mockReturnValue({
      user: { uid: 'user-2' } as any,
      isReady: true,
    });

    rerender({});

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.notes).toHaveLength(1);
      expect(result.current.notes[0]?.id).toBe('note-user-2');
    });

    await act(async () => {
      deferredCreate.resolve({
        id: 'note-user-1',
        type: 'text',
        content: 'Stale user one note',
        locationName: 'User one place',
        latitude: 10.1,
        longitude: 106.1,
        radius: 150,
        isFavorite: false,
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: null,
      });
      await pendingCreatePromise;
    });

    expect(result.current.notes).toHaveLength(1);
    expect(result.current.notes[0]?.id).toBe('note-user-2');
  });

  it('waits for auth readiness before loading scoped notes for a signed-in user', async () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'user-42' } as any,
      isReady: false,
    });

    const { result, rerender } = renderHook(() => useNotesStore(), { wrapper: TestWrapper });

    expect(mockGetAllNotesForScope).not.toHaveBeenCalled();

    mockUseAuth.mockReturnValue({
      user: { uid: 'user-42' } as any,
      isReady: true,
    });

    rerender({});

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetAllNotesForScope).toHaveBeenCalledWith('user-42');
  });

  it('loads the persisted active scope when auth is ready but the user session is unavailable', async () => {
    mockGetActiveNotesScope.mockReturnValue('user-42');

    const { result } = renderHook(() => useNotesStore(), { wrapper: TestWrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetAllNotesForScope).toHaveBeenCalledWith('user-42');
  });

  it('updates and favorites a note', async () => {
    mockNotesDb = [
      {
        id: 'note-42',
        type: 'text',
        content: 'Old note',
        locationName: 'Old place',
        latitude: 10,
        longitude: 106,
        radius: 150,
        isFavorite: false,
        hasDoodle: false,
        doodleStrokesJson: null,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      },
    ];

    const { result } = renderHook(() => useNotesStore(), { wrapper: TestWrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateNote('note-42', {
        content: 'Updated note',
        locationName: 'New place',
      });
    });

    expect(result.current.notes[0].content).toBe('Updated note');
    expect(result.current.notes[0].locationName).toBe('New place');

    await act(async () => {
      await result.current.updateNote('note-42', {
        hasDoodle: true,
        doodleStrokesJson: JSON.stringify([{ color: '#FFFFFF', points: [0.1, 0.1, 0.2, 0.2] }]),
      });
    });

    expect(result.current.notes[0].content).toBe('Updated note');
    expect(result.current.notes[0].hasDoodle).toBe(true);
    expect(result.current.notes[0].doodleStrokesJson).toBe(
      JSON.stringify([{ color: '#FFFFFF', points: [0.1, 0.1, 0.2, 0.2] }])
    );

    await act(async () => {
      const nextFavorite = await result.current.toggleFavorite('note-42');
      expect(nextFavorite).toBe(true);
    });

    expect(result.current.notes[0].isFavorite).toBe(true);
    expect(mockSyncGeofenceRegions).toHaveBeenCalled();
  });

  it('falls back to in-memory caption matching when photo captions are missing from db search results', async () => {
    mockNotesDb = [
      {
        id: 'photo-42',
        type: 'photo',
        content: 'file:///photo-caption.jpg',
        caption: 'Golden sunset on the river',
        locationName: 'District 2',
        latitude: 10,
        longitude: 106,
        radius: 150,
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      },
    ];

    const { result } = renderHook(() => useNotesStore(), { wrapper: TestWrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const searchResult = await result.current.searchNotes('sunset');

    expect(searchResult).toHaveLength(1);
    expect(searchResult[0]?.id).toBe('photo-42');
  });

  it('deletes a photo note and clears all notes', async () => {
    mockNotesDb = [
      {
        id: 'photo-note',
        type: 'photo',
        content: 'file:///photo-note.jpg',
        locationName: 'Photo place',
        latitude: 10,
        longitude: 106,
        radius: 150,
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      },
      {
        id: 'text-note',
        type: 'text',
        content: 'Text note',
        locationName: 'Text place',
        latitude: 10,
        longitude: 106,
        radius: 150,
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      },
    ];

    const { result } = renderHook(() => useNotesStore(), { wrapper: TestWrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteNote('photo-note');
    });

    expect(result.current.notes).toHaveLength(1);
    expect(mockDeleteAsync).toHaveBeenCalledWith('file:///photo-note.jpg', { idempotent: true });

    await act(async () => {
      await result.current.deleteAllNotes();
    });

    expect(result.current.notes).toHaveLength(0);
    expect(mockClearGeofenceRegions).toHaveBeenCalled();
  });
});

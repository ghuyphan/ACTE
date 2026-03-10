import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ReactNode } from 'react';
import { NotesProvider, useNotesStore } from '../hooks/useNotesStore';
import { Note } from '../services/database';

const mockSyncGeofenceRegions = jest.fn();
const mockClearGeofenceRegions = jest.fn();
const mockSkipImmediateReminderForNewNote = jest.fn();
const mockUpdateWidgetData = jest.fn();
const mockRecordChange = jest.fn();
const mockCleanupOrphanPhotoFiles = jest.fn();
const mockGetInfoAsync = jest.fn();
const mockDeleteAsync = jest.fn();

let mockNotesDb: Note[] = [];
let mockIdCounter = 1;

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
}));

jest.mock('../services/geofenceService', () => ({
  syncGeofenceRegions: (...args: unknown[]) => mockSyncGeofenceRegions(...args),
  clearGeofenceRegions: (...args: unknown[]) => mockClearGeofenceRegions(...args),
  skipImmediateReminderForNewNote: (...args: unknown[]) => mockSkipImmediateReminderForNewNote(...args),
}));

jest.mock('../services/widgetService', () => ({
  updateWidgetData: (...args: unknown[]) => mockUpdateWidgetData(...args),
}));

jest.mock('../services/mediaIntegrity', () => ({
  cleanupOrphanPhotoFiles: (...args: unknown[]) => mockCleanupOrphanPhotoFiles(...args),
}));

jest.mock('../services/syncService', () => ({
  getSyncService: () => ({
    isAvailable: false,
    recordChange: (...args: unknown[]) => mockRecordChange(...args),
  }),
}));

jest.mock('../services/database', () => ({
  getAllNotes: jest.fn(async () => [...mockNotesDb]),
  getNoteById: jest.fn(async (id: string) => mockNotesDb.find((note) => note.id === id) ?? null),
  createNote: jest.fn(async (input: any) => {
    const nextNote: Note = {
      id: `note-${mockIdCounter++}`,
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
  }),
  updateNote: jest.fn(async (id: string, updates: Partial<Pick<Note, 'content' | 'locationName'>>) => {
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

function TestWrapper({ children }: { children: ReactNode }) {
  return <NotesProvider>{children}</NotesProvider>;
}

beforeEach(() => {
  mockIdCounter = 1;
  mockNotesDb = [];
  jest.clearAllMocks();
  mockCleanupOrphanPhotoFiles.mockResolvedValue(0);
  mockGetInfoAsync.mockResolvedValue({ exists: true });
  mockDeleteAsync.mockResolvedValue(undefined);
  mockSyncGeofenceRegions.mockResolvedValue(true);
  mockClearGeofenceRegions.mockResolvedValue(undefined);
  mockSkipImmediateReminderForNewNote.mockResolvedValue(undefined);
  mockUpdateWidgetData.mockResolvedValue(undefined);
  mockRecordChange.mockResolvedValue(undefined);
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
    expect(mockRecordChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'create' }));
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
      const nextFavorite = await result.current.toggleFavorite('note-42');
      expect(nextFavorite).toBe(true);
    });

    expect(result.current.notes[0].isFavorite).toBe(true);
    expect(mockRecordChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'update' }));
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
    expect(mockRecordChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'deleteAll' }));
  });
});

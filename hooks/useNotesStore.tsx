import * as FileSystem from 'expo-file-system/legacy';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  CreateNoteInput,
  createNote as dbCreate,
  deleteAllNotes as dbDeleteAll,
  deleteNote as dbDelete,
  getAllNotes,
  getNoteById as dbGetById,
  Note,
  searchNotes as dbSearch,
  toggleFavorite as dbToggleFav,
  updateNote as dbUpdate,
} from '../services/database';
import { clearGeofenceRegions, syncGeofenceRegions } from '../services/geofenceService';
import { cleanupOrphanPhotoFiles } from '../services/mediaIntegrity';
import { getSyncService } from '../services/syncService';
import { updateWidgetData } from '../services/widgetService';

interface NotesStoreValue {
  notes: Note[];
  loading: boolean;
  refreshNotes: (showLoading?: boolean) => Promise<void>;
  createNote: (input: CreateNoteInput) => Promise<Note>;
  updateNote: (id: string, updates: Partial<Pick<Note, 'content' | 'locationName'>>) => Promise<void>;
  toggleFavorite: (id: string) => Promise<boolean>;
  searchNotes: (query: string) => Promise<Note[]>;
  deleteNote: (id: string) => Promise<void>;
  deleteAllNotes: () => Promise<void>;
  getNoteById: (id: string) => Promise<Note | null>;
}

const NotesStoreContext = createContext<NotesStoreValue | undefined>(undefined);

function useNotesStoreValue(): NotesStoreValue {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const syncService = getSyncService();
  const notesRef = useRef<Note[]>([]);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const refreshNotes = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const allNotes = await getAllNotes();
      setNotes(allNotes);
    } catch (error) {
      console.error('Failed to load notes:', error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refreshNotes(true);
      try {
        await cleanupOrphanPhotoFiles();
      } catch (error) {
        console.warn('Failed to clean orphan photos:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshNotes]);

  const createNote = useCallback(
    async (input: CreateNoteInput): Promise<Note> => {
      const note = await dbCreate(input);
      setNotes((prev) => [note, ...prev]);

      void updateWidgetData();
      void syncGeofenceRegions();
      void syncService.recordChange({
        type: 'create',
        entity: 'note',
        entityId: note.id,
        payload: input,
        timestamp: new Date().toISOString(),
      });

      return note;
    },
    [syncService]
  );

  const updateNote = useCallback(
    async (id: string, updates: Partial<Pick<Note, 'content' | 'locationName'>>) => {
      await dbUpdate(id, updates);
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                ...updates,
                updatedAt: new Date().toISOString(),
              }
            : n
        )
      );

      void updateWidgetData();
      void syncService.recordChange({
        type: 'update',
        entity: 'note',
        entityId: id,
        payload: updates,
        timestamp: new Date().toISOString(),
      });
    },
    [syncService]
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const newValue = await dbToggleFav(id);
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isFavorite: newValue } : n))
      );

      void syncService.recordChange({
        type: 'update',
        entity: 'note',
        entityId: id,
        payload: { isFavorite: newValue },
        timestamp: new Date().toISOString(),
      });
      return newValue;
    },
    [syncService]
  );

  const searchNotes = useCallback(async (query: string) => {
    if (!query.trim()) {
      return getAllNotes();
    }
    return dbSearch(query);
  }, []);

  const deleteNote = useCallback(
    async (id: string) => {
      const note = await dbGetById(id);

      await dbDelete(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));

      if (note?.type === 'photo' && note.content) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(note.content);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(note.content, { idempotent: true });
          }
        } catch (error) {
          console.warn('Failed to delete photo file:', error);
        }
      }

      void updateWidgetData();
      void syncGeofenceRegions();
      void syncService.recordChange({
        type: 'delete',
        entity: 'note',
        entityId: id,
        timestamp: new Date().toISOString(),
      });
    },
    [syncService]
  );

  const deleteAllNotes = useCallback(async () => {
    const allNotes = await getAllNotes();

    await dbDeleteAll();
    setNotes([]);

    for (const note of allNotes) {
      if (note.type !== 'photo' || !note.content) {
        continue;
      }
      try {
        const fileInfo = await FileSystem.getInfoAsync(note.content);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(note.content, { idempotent: true });
        }
      } catch (error) {
        console.warn('Failed to delete photo file:', error);
      }
    }

    await clearGeofenceRegions();
    void updateWidgetData();
    void syncService.recordChange({
      type: 'deleteAll',
      entity: 'note',
      timestamp: new Date().toISOString(),
    });
  }, [syncService]);

  const getNoteById = useCallback(async (id: string) => {
    const inMemory = notesRef.current.find((n) => n.id === id);
    if (inMemory) {
      return inMemory;
    }
    return dbGetById(id);
  }, []);

  return {
    notes,
    loading,
    refreshNotes,
    createNote,
    updateNote,
    toggleFavorite,
    searchNotes,
    deleteNote,
    deleteAllNotes,
    getNoteById,
  };
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const value = useNotesStoreValue();
  return <NotesStoreContext.Provider value={value}>{children}</NotesStoreContext.Provider>;
}

export function useNotesStore() {
  const context = useContext(NotesStoreContext);
  if (!context) {
    throw new Error('useNotesStore must be used within a NotesProvider');
  }
  return context;
}

export const useNotes = useNotesStore;


import * as FileSystem from '../utils/fileSystem';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import {
  CreateNoteInput,
  LOCAL_NOTES_SCOPE,
  createNote as dbCreate,
  deleteAllNotes as dbDeleteAll,
  deleteNote as dbDelete,
  getAllNotes,
  getNoteById as dbGetById,
  Note,
  NoteUpdates,
  searchNotes as dbSearchNotes,
  toggleFavorite as dbToggleFav,
  updateNote as dbUpdate,
} from '../services/database';
import {
  prependNote,
  removeNoteFromCollection,
  replaceNoteInCollection,
  updateNoteInCollection,
} from '../services/noteMutationHelpers';
import {
  clearGeofenceRegions,
  skipImmediateReminderForNewNote,
  syncGeofenceRegions,
} from '../services/geofenceService';
import { cleanupOrphanMediaFiles } from '../services/mediaIntegrity';
import { getNotePhotoUri } from '../services/photoStorage';
import { getSyncService, type SyncChange } from '../services/syncService';
import { updateWidgetData } from '../services/widgetService';

interface NotesStoreValue {
  notes: Note[];
  loading: boolean;
  refreshNotes: (showLoading?: boolean) => Promise<void>;
  createNote: (input: CreateNoteInput) => Promise<Note>;
  updateNote: (id: string, updates: NoteUpdates) => Promise<void>;
  toggleFavorite: (id: string) => Promise<boolean>;
  searchNotes: (query: string) => Promise<Note[]>;
  deleteNote: (id: string) => Promise<void>;
  deleteAllNotes: () => Promise<void>;
  getNoteById: (id: string) => Promise<Note | null>;
}

const NotesStoreContext = createContext<NotesStoreValue | undefined>(undefined);

function useNotesStoreValue(): NotesStoreValue {
  const { user, isReady: authReady } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const syncService = getSyncService();
  const notesRef = useRef<Note[]>([]);
  const activeScopeRef = useRef<string>(user?.uid ?? LOCAL_NOTES_SCOPE);
  const widgetSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const scheduleWidgetUpdate = useCallback((nextNotes?: Note[], delay = 120) => {
    if (widgetSyncTimeoutRef.current) {
      clearTimeout(widgetSyncTimeoutRef.current);
    }

    widgetSyncTimeoutRef.current = setTimeout(() => {
      widgetSyncTimeoutRef.current = null;
      void updateWidgetData({
        notes: nextNotes,
        includeLocationLookup: true,
      });
    }, delay);
  }, []);

  const commitNotes = useCallback(
    (nextNotes: Note[]) => {
      notesRef.current = nextNotes;
      setNotes(nextNotes);
      scheduleWidgetUpdate(nextNotes);
    },
    [scheduleWidgetUpdate]
  );

  const recordNoteChange = useCallback(
    (change: Omit<SyncChange, 'timestamp'>) => {
      void syncService.recordChange({
        ...change,
        timestamp: new Date().toISOString(),
      });
    },
    [syncService]
  );

  const deletePhotoFileIfPresent = useCallback(async (note: Note | null | undefined) => {
    const photoUri = getNotePhotoUri(note);
    if (note?.type !== 'photo' || !photoUri) {
      return;
    }

    try {
      const fileInfo = await FileSystem.getInfoAsync(photoUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(photoUri, { idempotent: true });
      }
    } catch (error) {
      console.warn('Failed to delete photo file:', error);
    }
  }, []);

  const refreshNotes = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const allNotes = await getAllNotes();
      notesRef.current = allNotes;
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
    let cleanupTimeout: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      await refreshNotes(true);
      cleanupTimeout = setTimeout(() => {
        if (cancelled) {
          return;
        }

        void cleanupOrphanMediaFiles().catch((error) => {
          console.warn('Failed to clean orphan media:', error);
        });
      }, 300);
    })();

    return () => {
      cancelled = true;
      if (cleanupTimeout) {
        clearTimeout(cleanupTimeout);
      }
    };
  }, [refreshNotes]);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    const nextScope = user?.uid ?? LOCAL_NOTES_SCOPE;
    if (activeScopeRef.current === nextScope) {
      return;
    }

    activeScopeRef.current = nextScope;
    notesRef.current = [];
    setNotes([]);
    setLoading(true);
    void refreshNotes(true);
  }, [authReady, refreshNotes, user?.uid]);

  useEffect(() => () => {
    if (widgetSyncTimeoutRef.current) {
      clearTimeout(widgetSyncTimeoutRef.current);
    }
  }, []);

  const createNote = useCallback(
    async (input: CreateNoteInput): Promise<Note> => {
      const note = await dbCreate(input);
      const nextNotes = prependNote(notesRef.current, note);
      commitNotes(nextNotes);

      await skipImmediateReminderForNewNote(note.id);
      void syncGeofenceRegions();
      recordNoteChange({
        type: 'create',
        entity: 'note',
        entityId: note.id,
        payload: input,
      });

      return note;
    },
    [commitNotes, recordNoteChange]
  );

  const updateNote = useCallback(
    async (id: string, updates: NoteUpdates) => {
      await dbUpdate(id, updates);
      const nextNotes = updateNoteInCollection(notesRef.current, id, updates);
      commitNotes(nextNotes);

      if (updates.radius !== undefined) {
        void syncGeofenceRegions();
      }
      recordNoteChange({
        type: 'update',
        entity: 'note',
        entityId: id,
        payload: updates,
      });
    },
    [commitNotes, recordNoteChange]
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const newValue = await dbToggleFav(id);
      const nextNotes = replaceNoteInCollection(notesRef.current, id, (note) => ({
        ...note,
        isFavorite: newValue,
      }));
      commitNotes(nextNotes);
      void syncGeofenceRegions();
      recordNoteChange({
        type: 'update',
        entity: 'note',
        entityId: id,
        payload: { isFavorite: newValue },
      });
      return newValue;
    },
    [commitNotes, recordNoteChange]
  );

  const searchNotes = useCallback(async (query: string) => {
    return dbSearchNotes(query);
  }, []);

  const deleteNote = useCallback(
    async (id: string) => {
      const note = await dbGetById(id);

      await dbDelete(id);
      const nextNotes = removeNoteFromCollection(notesRef.current, id);
      commitNotes(nextNotes);

      await deletePhotoFileIfPresent(note);

      void syncGeofenceRegions();
      recordNoteChange({
        type: 'delete',
        entity: 'note',
        entityId: id,
      });
    },
    [commitNotes, deletePhotoFileIfPresent, recordNoteChange]
  );

  const deleteAllNotes = useCallback(async () => {
    const allNotes = await getAllNotes();

    await dbDeleteAll();
    commitNotes([]);

    for (const note of allNotes) {
      await deletePhotoFileIfPresent(note);
    }

    await clearGeofenceRegions();
    recordNoteChange({
      type: 'deleteAll',
      entity: 'note',
    });
  }, [commitNotes, deletePhotoFileIfPresent, recordNoteChange]);

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

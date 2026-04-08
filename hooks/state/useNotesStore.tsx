import * as FileSystem from '../../utils/fileSystem';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '../useAuth';
import {
  CreateNoteInput,
  LOCAL_NOTES_SCOPE,
  createNote as dbCreate,
  deleteAllNotes as dbDeleteAll,
  deleteNote as dbDelete,
  getAllNotesForScope,
  getNoteById as dbGetById,
  Note,
  NoteUpdates,
  searchNotes as dbSearchNotes,
  toggleFavorite as dbToggleFav,
  updateNote as dbUpdate,
} from '../../services/database';
import {
  prependNote,
  removeNoteFromCollection,
  replaceNoteInCollection,
  updateNoteInCollection,
} from '../../services/noteMutationHelpers';
import { filterNotesByQuery } from '../../services/noteSearch';
import {
  clearGeofenceRegions,
  skipImmediateReminderForNewNote,
  syncGeofenceRegions,
} from '../../services/geofenceService';
import { cleanupOrphanMediaFiles } from '../../services/mediaIntegrity';
import { getNotePhotoUri } from '../../services/photoStorage';
import { getNotePairedVideoUri } from '../../services/livePhotoStorage';
import { updateWidgetData } from '../../services/widgetService';
import { scheduleOnIdle } from '../../utils/scheduleOnIdle';

interface NotesStoreValue {
  notes: Note[];
  loading: boolean;
  refreshNotes: (showLoading?: boolean, options?: { updateWidget?: boolean }) => Promise<void>;
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
  const notesRef = useRef<Note[]>([]);
  const activeScopeRef = useRef<string>(user?.uid ?? LOCAL_NOTES_SCOPE);
  const widgetSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRequestIdRef = useRef(0);

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
        includeLocationLookup: false,
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

  const syncGeofencesForNotes = useCallback((reason: string, nextNotes?: Note[]) => {
    const options = nextNotes ? { notes: nextNotes } : undefined;
    void syncGeofenceRegions(options).catch((error) => {
      console.warn(`Failed to sync geofence regions after ${reason}:`, error);
    });
  }, []);

  const deletePhotoFileIfPresent = useCallback(async (note: Note | null | undefined) => {
    const photoUri = getNotePhotoUri(note);
    const pairedVideoUri = getNotePairedVideoUri(note);
    if (note?.type !== 'photo' || (!photoUri && !pairedVideoUri)) {
      return;
    }

    try {
      for (const mediaUri of [photoUri, pairedVideoUri].filter(Boolean)) {
        const fileInfo = await FileSystem.getInfoAsync(mediaUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(mediaUri, { idempotent: true });
        }
      }
    } catch (error) {
      console.warn('Failed to delete local note media file:', error);
    }
  }, []);

  const refreshNotes = useCallback(async (
    showLoading = true,
    options?: { updateWidget?: boolean; scope?: string; syncGeofences?: boolean }
  ) => {
    const scope = options?.scope ?? activeScopeRef.current;
    const requestId = ++refreshRequestIdRef.current;
    try {
      if (showLoading) {
        setLoading(true);
      }
      const allNotes = await getAllNotesForScope(scope);
      if (refreshRequestIdRef.current !== requestId || activeScopeRef.current !== scope) {
        return;
      }
      notesRef.current = allNotes;
      setNotes(allNotes);
      if (options?.updateWidget) {
        scheduleWidgetUpdate(allNotes);
      }
      if (options?.syncGeofences) {
        syncGeofencesForNotes('note refresh', allNotes);
      }
    } catch (error) {
      console.error('Failed to load notes:', error);
    } finally {
      if (showLoading && refreshRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [scheduleWidgetUpdate, syncGeofencesForNotes]);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    let cancelled = false;
    let cleanupIdleHandle: ReturnType<typeof scheduleOnIdle> | null = null;
    let cleanupTimeout: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      await refreshNotes(true, {
        scope: activeScopeRef.current,
        syncGeofences: true,
        updateWidget: true,
      });
      cleanupIdleHandle = scheduleOnIdle(() => {
        cleanupTimeout = setTimeout(() => {
          if (cancelled) {
            return;
          }

          void cleanupOrphanMediaFiles().catch((error) => {
            console.warn('Failed to clean orphan media:', error);
          });
        }, 1200);
      }, { timeout: 2000 });
    })();

    return () => {
      cancelled = true;
      cleanupIdleHandle?.cancel();
      if (cleanupTimeout) {
        clearTimeout(cleanupTimeout);
      }
    };
  }, [authReady, refreshNotes]);

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
    void refreshNotes(true, {
      scope: nextScope,
      syncGeofences: true,
      updateWidget: true,
    });
  }, [authReady, refreshNotes, user?.uid]);

  useEffect(() => () => {
    if (widgetSyncTimeoutRef.current) {
      clearTimeout(widgetSyncTimeoutRef.current);
    }
  }, []);

  const createNote = useCallback(
    async (input: CreateNoteInput): Promise<Note> => {
      const timestamp = new Date().toISOString();
      const note = await dbCreate(input, {
        syncChange: {
          type: 'create',
          entity: 'note',
          payload: input,
          timestamp,
        },
      });
      const nextNotes = prependNote(notesRef.current, note);
      commitNotes(nextNotes);

      void skipImmediateReminderForNewNote(note.id).catch((error) => {
        console.warn('Failed to suppress immediate reminder for new note:', error);
      });
      syncGeofencesForNotes('note creation', nextNotes);

      return note;
    },
    [commitNotes, syncGeofencesForNotes]
  );

  const updateNote = useCallback(
    async (id: string, updates: NoteUpdates) => {
      await dbUpdate(id, updates, {
        syncChange: {
          type: 'update',
          entity: 'note',
          entityId: id,
          payload: updates,
          timestamp: new Date().toISOString(),
        },
      });
      const nextNotes = updateNoteInCollection(notesRef.current, id, updates);
      commitNotes(nextNotes);
      syncGeofencesForNotes('note update', nextNotes);
    },
    [commitNotes, syncGeofencesForNotes]
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const currentNote = notesRef.current.find((note) => note.id === id);
      const nextFavoriteValue = currentNote ? !currentNote.isFavorite : true;
      const timestamp = new Date().toISOString();
      const newValue = await dbToggleFav(id, {
        syncChange: {
          type: 'update',
          entity: 'note',
          entityId: id,
          payload: { isFavorite: nextFavoriteValue },
          timestamp,
        },
      });
      const nextNotes = replaceNoteInCollection(notesRef.current, id, (note) => ({
        ...note,
        isFavorite: newValue,
      }));
      commitNotes(nextNotes);
      syncGeofencesForNotes('favorite change', nextNotes);
      return newValue;
    },
    [commitNotes, syncGeofencesForNotes]
  );

  const searchNotes = useCallback(async (query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return notesRef.current;
    }

    const dbResults = await dbSearchNotes(trimmedQuery);
    const fallbackMatches = filterNotesByQuery(notesRef.current, trimmedQuery);

    if (fallbackMatches.length === 0) {
      return dbResults;
    }

    if (dbResults.length === 0) {
      return fallbackMatches;
    }

    const mergedResults = [...dbResults];
    const seenIds = new Set(dbResults.map((note) => note.id));
    for (const note of fallbackMatches) {
      if (!seenIds.has(note.id)) {
        seenIds.add(note.id);
        mergedResults.push(note);
      }
    }

    return mergedResults;
  }, []);

  const deleteNote = useCallback(
    async (id: string) => {
      const note = await dbGetById(id);

      await dbDelete(id, {
        syncChange: {
          type: 'delete',
          entity: 'note',
          entityId: id,
          timestamp: new Date().toISOString(),
        },
      });
      const nextNotes = removeNoteFromCollection(notesRef.current, id);
      commitNotes(nextNotes);

      await deletePhotoFileIfPresent(note);
      syncGeofencesForNotes('note deletion', nextNotes);
    },
    [commitNotes, deletePhotoFileIfPresent, syncGeofencesForNotes]
  );

  const deleteAllNotes = useCallback(async () => {
    const allNotes = await getAllNotesForScope(activeScopeRef.current);

    await dbDeleteAll({
      syncChange: {
        type: 'deleteAll',
        entity: 'note',
        timestamp: new Date().toISOString(),
      },
    });
    commitNotes([]);

    for (const note of allNotes) {
      await deletePhotoFileIfPresent(note);
    }

    await clearGeofenceRegions();
  }, [commitNotes, deletePhotoFileIfPresent]);

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

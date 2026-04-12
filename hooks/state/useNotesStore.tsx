import * as FileSystem from '../../utils/fileSystem';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '../useAuth';
import {
  CreateNoteInput,
  getActiveNotesScope,
  LOCAL_NOTES_SCOPE,
  createNote as dbCreate,
  deleteAllNotes as dbDeleteAll,
  deleteNote as dbDelete,
  getNotesPageForScope,
  getAllNotesForScope,
  getNoteStatsForScope,
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
import { scheduleWidgetDataUpdate } from '../../services/widgetService';
import type { UpdateWidgetDataOptions } from '../../services/widgetService';
import { scheduleOnIdle } from '../../utils/scheduleOnIdle';

interface NotesStoreValue {
  notes: Note[];
  loading: boolean;
  initialLoadComplete: boolean;
  hasLoadedAllNotes: boolean;
  noteCount: number;
  photoNoteCount: number;
  loadNextNotesPage: () => Promise<Note[]>;
  refreshNotes: (
    showLoading?: boolean,
    options?: { updateWidget?: boolean; syncGeofences?: boolean; loadFull?: boolean }
  ) => Promise<Note[]>;
  ensureAllNotesLoaded: () => Promise<Note[]>;
  createNote: (input: CreateNoteInput) => Promise<Note>;
  updateNote: (id: string, updates: NoteUpdates) => Promise<void>;
  toggleFavorite: (id: string) => Promise<boolean>;
  searchNotes: (query: string) => Promise<Note[]>;
  deleteNote: (id: string) => Promise<void>;
  deleteAllNotes: () => Promise<void>;
  getNoteById: (id: string) => Promise<Note | null>;
}

const NotesStoreContext = createContext<NotesStoreValue | undefined>(undefined);
const INITIAL_NOTES_BOOTSTRAP_LIMIT = 24;

interface NoteStats {
  totalCount: number;
  photoCount: number;
}

function resolveNotesScope(userUid: string | null | undefined) {
  return userUid ?? getActiveNotesScope() ?? LOCAL_NOTES_SCOPE;
}

function buildNoteStats(notes: Note[]): NoteStats {
  let photoCount = 0;
  for (const note of notes) {
    if (note.type === 'photo') {
      photoCount += 1;
    }
  }

  return {
    totalCount: notes.length,
    photoCount,
  };
}

function useNotesStoreValue(): NotesStoreValue {
  const { user, isReady: authReady } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [hasLoadedAllNotes, setHasLoadedAllNotes] = useState(false);
  const [noteCount, setNoteCount] = useState(0);
  const [photoNoteCount, setPhotoNoteCount] = useState(0);
  const notesRef = useRef<Note[]>([]);
  const hasLoadedAllNotesRef = useRef(false);
  const noteStatsRef = useRef<NoteStats>({ totalCount: 0, photoCount: 0 });
  const activeScopeRef = useRef<string>(resolveNotesScope(user?.uid));
  const activeScopeRevisionRef = useRef(0);
  const refreshRequestIdRef = useRef(0);
  const loadMorePromiseRef = useRef<Promise<Note[]> | null>(null);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const scheduleWidgetUpdate = useCallback((
    nextNotes?: Note[],
    delay = 120,
    options?: Pick<UpdateWidgetDataOptions, 'preferredNoteId'>
  ) => {
    scheduleWidgetDataUpdate(
      {
        notes: nextNotes,
        includeLocationLookup: false,
        preferredNoteId: options?.preferredNoteId ?? null,
      },
      {
        debounceMs: delay,
      }
    );
  }, []);

  const commitNoteStats = useCallback((nextStats: NoteStats, nextHasLoadedAllNotes: boolean) => {
    noteStatsRef.current = nextStats;
    hasLoadedAllNotesRef.current = nextHasLoadedAllNotes;
    setNoteCount(nextStats.totalCount);
    setPhotoNoteCount(nextStats.photoCount);
    setHasLoadedAllNotes(nextHasLoadedAllNotes);
  }, []);

  const commitNotes = useCallback(
    (
      nextNotes: Note[],
      options?: Pick<UpdateWidgetDataOptions, 'preferredNoteId'>
    ) => {
      notesRef.current = nextNotes;
      setNotes(nextNotes);
      scheduleWidgetUpdate(hasLoadedAllNotesRef.current ? nextNotes : undefined, 120, options);
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

  const applyActiveScope = useCallback((nextScope: string) => {
    if (activeScopeRef.current !== nextScope) {
      activeScopeRef.current = nextScope;
      activeScopeRevisionRef.current += 1;
    }

    return activeScopeRef.current;
  }, []);

  const isCurrentScope = useCallback(
    (scope: string, revision: number) =>
      activeScopeRef.current === scope && activeScopeRevisionRef.current === revision,
    []
  );

  const fetchNotesSnapshot = useCallback(async (
    scope: string,
    options?: { loadFull?: boolean; limit?: number }
  ) => {
    const shouldLoadFull = options?.loadFull ?? false;

    if (shouldLoadFull) {
      const nextNotes = await getAllNotesForScope(scope);
      return {
        notes: nextNotes,
        stats: buildNoteStats(nextNotes),
        hasLoadedAllNotes: true,
      };
    }

    const limit = options?.limit ?? INITIAL_NOTES_BOOTSTRAP_LIMIT;
    const [pagedNotes, stats] = await Promise.all([
      getNotesPageForScope(scope, {
        limit,
      }),
      getNoteStatsForScope(scope),
    ]);

    return {
      notes: pagedNotes,
      stats,
      hasLoadedAllNotes: stats.totalCount <= pagedNotes.length,
    };
  }, []);

  const refreshNotes = useCallback(async (
    showLoading = true,
    options?: { updateWidget?: boolean; scope?: string; syncGeofences?: boolean; loadFull?: boolean }
  ) => {
    const scope = options?.scope ?? activeScopeRef.current;
    const requestId = ++refreshRequestIdRef.current;
    try {
      if (showLoading) {
        setLoading(true);
      }

      const snapshot = await fetchNotesSnapshot(scope, {
        loadFull: options?.loadFull,
      });
      const nextNotes = snapshot.notes;

      if (refreshRequestIdRef.current !== requestId || activeScopeRef.current !== scope) {
        return nextNotes;
      }

      notesRef.current = nextNotes;
      setNotes(nextNotes);
      commitNoteStats(snapshot.stats, snapshot.hasLoadedAllNotes);
      setInitialLoadComplete(true);

      if (options?.updateWidget) {
        scheduleWidgetUpdate(snapshot.hasLoadedAllNotes ? nextNotes : undefined);
      }
      if (options?.syncGeofences) {
        syncGeofencesForNotes(
          'note refresh',
          snapshot.hasLoadedAllNotes ? nextNotes : undefined
        );
      }

      return nextNotes;
    } catch (error) {
      console.error('Failed to load notes:', error);
      if (showLoading && refreshRequestIdRef.current === requestId) {
        setInitialLoadComplete(true);
      }
    } finally {
      if (showLoading && refreshRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
    return notesRef.current;
  }, [commitNoteStats, fetchNotesSnapshot, scheduleWidgetUpdate, syncGeofencesForNotes]);

  const loadNextNotesPage = useCallback(async () => {
    if (hasLoadedAllNotesRef.current) {
      return notesRef.current;
    }

    if (loadMorePromiseRef.current) {
      return loadMorePromiseRef.current;
    }

    const scope = activeScopeRef.current;
    const scopeRevision = activeScopeRevisionRef.current;
    const requestId = ++refreshRequestIdRef.current;
    const nextLimit = notesRef.current.length + INITIAL_NOTES_BOOTSTRAP_LIMIT;

    const loadPromise = fetchNotesSnapshot(scope, { limit: nextLimit })
      .then((snapshot) => {
        if (
          refreshRequestIdRef.current !== requestId ||
          !isCurrentScope(scope, scopeRevision)
        ) {
          return notesRef.current;
        }

        notesRef.current = snapshot.notes;
        setNotes(snapshot.notes);
        commitNoteStats(snapshot.stats, snapshot.hasLoadedAllNotes);
        return snapshot.notes;
      })
      .catch((error) => {
        console.warn('Failed to load next notes page:', error);
        return notesRef.current;
      })
      .finally(() => {
        if (loadMorePromiseRef.current === loadPromise) {
          loadMorePromiseRef.current = null;
        }
      });

    loadMorePromiseRef.current = loadPromise;
    return loadPromise;
  }, [commitNoteStats, fetchNotesSnapshot, isCurrentScope]);

  const ensureAllNotesLoaded = useCallback(async () => {
    if (hasLoadedAllNotesRef.current) {
      return notesRef.current;
    }

    return refreshNotes(false, { loadFull: true });
  }, [refreshNotes]);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    let cancelled = false;
    let cleanupIdleHandle: ReturnType<typeof scheduleOnIdle> | null = null;
    let cleanupTimeout: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      const nextScope = resolveNotesScope(user?.uid);
      applyActiveScope(nextScope);
      await refreshNotes(true, {
        scope: nextScope,
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
  }, [applyActiveScope, authReady, refreshNotes, user?.uid]);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    const nextScope = resolveNotesScope(user?.uid);
    if (activeScopeRef.current === nextScope) {
      return;
    }

    applyActiveScope(nextScope);
    notesRef.current = [];
    setNotes([]);
    commitNoteStats({ totalCount: 0, photoCount: 0 }, false);
    setLoading(true);
    void refreshNotes(true, {
      scope: nextScope,
      syncGeofences: true,
      updateWidget: true,
    });
  }, [applyActiveScope, authReady, refreshNotes, user?.uid]);

  const createNote = useCallback(
    async (input: CreateNoteInput): Promise<Note> => {
      const scope = activeScopeRef.current;
      const scopeRevision = activeScopeRevisionRef.current;
      const timestamp = new Date().toISOString();
      const note = await dbCreate(input, {
        syncChange: {
          type: 'create',
          entity: 'note',
          payload: input,
          timestamp,
        },
      });
      if (!isCurrentScope(scope, scopeRevision)) {
        return note;
      }
      const nextNotes = hasLoadedAllNotesRef.current
        ? prependNote(notesRef.current, note)
        : prependNote(notesRef.current, note).slice(0, INITIAL_NOTES_BOOTSTRAP_LIMIT);
      commitNotes(nextNotes, { preferredNoteId: note.id });
      commitNoteStats(
        {
          totalCount: noteStatsRef.current.totalCount + 1,
          photoCount: noteStatsRef.current.photoCount + (note.type === 'photo' ? 1 : 0),
        },
        hasLoadedAllNotesRef.current
      );

      void skipImmediateReminderForNewNote(note.id).catch((error) => {
        console.warn('Failed to suppress immediate reminder for new note:', error);
      });
      syncGeofencesForNotes('note creation', nextNotes);

      return note;
    },
    [commitNotes, isCurrentScope, syncGeofencesForNotes]
  );

  const updateNote = useCallback(
    async (id: string, updates: NoteUpdates) => {
      const scope = activeScopeRef.current;
      const scopeRevision = activeScopeRevisionRef.current;
      await dbUpdate(id, updates, {
        syncChange: {
          type: 'update',
          entity: 'note',
          entityId: id,
          payload: updates,
          timestamp: new Date().toISOString(),
        },
      });
      if (!isCurrentScope(scope, scopeRevision)) {
        return;
      }
      const nextNotes = updateNoteInCollection(notesRef.current, id, updates);
      commitNotes(nextNotes);
      syncGeofencesForNotes('note update', nextNotes);
    },
    [commitNotes, isCurrentScope, syncGeofencesForNotes]
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const scope = activeScopeRef.current;
      const scopeRevision = activeScopeRevisionRef.current;
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
      if (!isCurrentScope(scope, scopeRevision)) {
        return newValue;
      }
      const nextNotes = replaceNoteInCollection(notesRef.current, id, (note) => ({
        ...note,
        isFavorite: newValue,
      }));
      commitNotes(nextNotes);
      syncGeofencesForNotes('favorite change', nextNotes);
      return newValue;
    },
    [commitNotes, isCurrentScope, syncGeofencesForNotes]
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
      const scope = activeScopeRef.current;
      const scopeRevision = activeScopeRevisionRef.current;
      const note = await dbGetById(id);

      await dbDelete(id, {
        syncChange: {
          type: 'delete',
          entity: 'note',
          entityId: id,
          timestamp: new Date().toISOString(),
        },
      });
      if (!isCurrentScope(scope, scopeRevision)) {
        return;
      }
      const nextNotes = removeNoteFromCollection(notesRef.current, id);
      commitNotes(nextNotes);
      commitNoteStats(
        {
          totalCount: Math.max(0, noteStatsRef.current.totalCount - (note ? 1 : 0)),
          photoCount: Math.max(
            0,
            noteStatsRef.current.photoCount - (note?.type === 'photo' ? 1 : 0)
          ),
        },
        hasLoadedAllNotesRef.current
      );

      await deletePhotoFileIfPresent(note);
      syncGeofencesForNotes('note deletion', nextNotes);
    },
    [commitNotes, deletePhotoFileIfPresent, isCurrentScope, syncGeofencesForNotes]
  );

  const deleteAllNotes = useCallback(async () => {
    const scope = activeScopeRef.current;
    const scopeRevision = activeScopeRevisionRef.current;
    const allNotes = await getAllNotesForScope(activeScopeRef.current);

    await dbDeleteAll({
      syncChange: {
        type: 'deleteAll',
        entity: 'note',
        timestamp: new Date().toISOString(),
      },
    });
    if (!isCurrentScope(scope, scopeRevision)) {
      return;
    }
    commitNotes([]);
    commitNoteStats({ totalCount: 0, photoCount: 0 }, true);

    for (const note of allNotes) {
      await deletePhotoFileIfPresent(note);
    }

    await clearGeofenceRegions();
  }, [commitNotes, deletePhotoFileIfPresent, isCurrentScope]);

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
    initialLoadComplete,
    hasLoadedAllNotes,
    noteCount,
    photoNoteCount,
    loadNextNotesPage,
    refreshNotes,
    ensureAllNotesLoaded,
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

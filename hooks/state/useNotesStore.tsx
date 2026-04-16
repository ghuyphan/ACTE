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
  getNotesPageForScope,
  getNoteById as dbGetById,
  getNoteByIdForScope as dbGetByIdForScope,
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
import { emitDeletedNotesEvent } from '../../services/noteMutationEvents';
import { getNotePhotoUri } from '../../services/photoStorage';
import { getNotePairedVideoUri } from '../../services/livePhotoStorage';
import { scheduleWidgetDataUpdate } from '../../services/widgetService';
import type { UpdateWidgetDataOptions } from '../../services/widgetService';
import { scheduleOnIdle } from '../../utils/scheduleOnIdle';

export type NotesLoadPhase = 'bootstrapping' | 'hydrating' | 'ready' | 'refreshing';

interface NotesStoreValue {
  notes: Note[];
  phase: NotesLoadPhase;
  loading: boolean;
  initialLoadComplete: boolean;
  refreshNotes: (
    showLoading?: boolean,
    options?: { updateWidget?: boolean; syncGeofences?: boolean }
  ) => Promise<void>;
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

function resolveNotesScope(userUid: string | null | undefined) {
  return typeof userUid === 'string' && userUid.trim() ? userUid.trim() : LOCAL_NOTES_SCOPE;
}

function useNotesStoreValue(): NotesStoreValue {
  const { user, isReady: authReady } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [phase, setPhase] = useState<NotesLoadPhase>('bootstrapping');
  const notesRef = useRef<Note[]>([]);
  const phaseRef = useRef<NotesLoadPhase>(phase);
  const activeScopeRef = useRef<string>(LOCAL_NOTES_SCOPE);
  const activeScopeRevisionRef = useRef(0);
  const refreshRequestIdRef = useRef(0);
  const loadedScopeRef = useRef<string | null>(null);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const loading = phase === 'bootstrapping' || phase === 'hydrating';
  const initialLoadComplete = phase !== 'bootstrapping';

  const scheduleWidgetUpdate = useCallback(
    (
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
    },
    []
  );

  const commitNotes = useCallback(
    (nextNotes: Note[], options?: Pick<UpdateWidgetDataOptions, 'preferredNoteId'>) => {
      notesRef.current = nextNotes;
      setNotes(nextNotes);
      scheduleWidgetUpdate(nextNotes, 120, options);
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

  const refreshNotes = useCallback(
    async (
      showLoading = true,
      options?: { updateWidget?: boolean; scope?: string; syncGeofences?: boolean }
    ) => {
      const scope = options?.scope ?? activeScopeRef.current;
      const requestId = ++refreshRequestIdRef.current;

      try {
        if (showLoading) {
          setPhase('bootstrapping');
        } else if (phaseRef.current === 'ready') {
          setPhase('refreshing');
        }

        if (showLoading) {
          const stagedNotes = await getNotesPageForScope(scope, {
            limit: INITIAL_NOTES_BOOTSTRAP_LIMIT,
          });
          if (refreshRequestIdRef.current !== requestId || activeScopeRef.current !== scope) {
            return;
          }

          notesRef.current = stagedNotes;
          setNotes(stagedNotes);
          setPhase('hydrating');
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
        if (refreshRequestIdRef.current === requestId) {
          setPhase('ready');
        }
      }
    },
    [scheduleWidgetUpdate, syncGeofencesForNotes]
  );

  useEffect(() => {
    if (!authReady) {
      return;
    }

    const nextScope = resolveNotesScope(user?.uid);
    const scopeChanged = activeScopeRef.current !== nextScope;
    const shouldRefresh = scopeChanged || loadedScopeRef.current !== nextScope;

    if (!shouldRefresh) {
      return;
    }

    let cancelled = false;
    let cleanupIdleHandle: ReturnType<typeof scheduleOnIdle> | null = null;
    let cleanupTimeout: ReturnType<typeof setTimeout> | null = null;

    if (scopeChanged && loadedScopeRef.current !== null) {
      notesRef.current = [];
      setNotes([]);
      setPhase('bootstrapping');
    }

    applyActiveScope(nextScope);
    loadedScopeRef.current = nextScope;

    void (async () => {
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

  const createNote = useCallback(
    async (input: CreateNoteInput): Promise<Note> => {
      const scope = activeScopeRef.current;
      const scopeRevision = activeScopeRevisionRef.current;
      const timestamp = new Date().toISOString();
      const note = await dbCreate(input, {
        scope,
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

      const nextNotes = prependNote(notesRef.current, note);
      commitNotes(nextNotes, { preferredNoteId: note.id });

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
        scope,
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
        scope,
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
      const note =
        typeof dbGetByIdForScope === 'function'
          ? await dbGetByIdForScope(id, scope)
          : await dbGetById(id);

      await dbDelete(id, {
        scope,
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
      emitDeletedNotesEvent({
        scope,
        noteIds: [id],
      });

      await deletePhotoFileIfPresent(note);
      syncGeofencesForNotes('note deletion', nextNotes);
    },
    [commitNotes, deletePhotoFileIfPresent, isCurrentScope, syncGeofencesForNotes]
  );

  const deleteAllNotes = useCallback(async () => {
    const scope = activeScopeRef.current;
    const scopeRevision = activeScopeRevisionRef.current;
    const allNotes = await getAllNotesForScope(scope);

    await dbDeleteAll({
      scope,
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
    emitDeletedNotesEvent({
      scope,
      noteIds: allNotes.map((note) => note.id),
    });

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
    return typeof dbGetByIdForScope === 'function'
      ? dbGetByIdForScope(id, activeScopeRef.current)
      : dbGetById(id);
  }, []);

  return {
    notes,
    phase,
    loading,
    initialLoadComplete,
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

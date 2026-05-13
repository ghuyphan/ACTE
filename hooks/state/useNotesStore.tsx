import * as FileSystem from '../../utils/fileSystem';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import { doesNoteUpdateAffectReminderSelection } from '../../services/noteMutationSideEffects';
import { getNotePhotoUri } from '../../services/photoStorage';
import { getNotePairedVideoUri } from '../../services/livePhotoStorage';
import { scheduleWidgetDataUpdate } from '../../services/widgetService';
import type { UpdateWidgetDataOptions } from '../../services/widgetService';
import { traceAppAsync } from '../../utils/appDiagnostics';
import { scheduleOnIdle } from '../../utils/scheduleOnIdle';
import { traceStartupAsync } from '../../utils/startupTrace';
import { withTimeoutResult } from '../../utils/timeout';

export type NotesLoadPhase = 'bootstrapping' | 'hydrating' | 'ready' | 'refreshing';

export interface NotesStateValue {
  notes: Note[];
  phase: NotesLoadPhase;
  loading: boolean;
  initialLoadComplete: boolean;
}

export interface NotesActionsValue {
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

export interface NotesStoreValue extends NotesStateValue, NotesActionsValue {}

const NotesStateContext = createContext<NotesStateValue | undefined>(undefined);
const NotesActionsContext = createContext<NotesActionsValue | undefined>(undefined);
const INITIAL_NOTES_BOOTSTRAP_LIMIT = 24;
const INITIAL_NOTES_LOAD_RETRY_DELAY_MS = 900;
const INITIAL_NOTES_STAGED_LOAD_TIMEOUT_MS = 2500;
const INITIAL_NOTES_FULL_HYDRATION_TIMEOUT_MS = 4500;

type InitialNotesRefreshOutcome = 'loaded' | 'released' | 'stale';

function resolveNotesScope(userUid: string | null | undefined) {
  return typeof userUid === 'string' && userUid.trim() ? userUid.trim() : LOCAL_NOTES_SCOPE;
}

async function loadInitialNotesForScope({
  scope,
  isCurrentRefreshRequest,
  markHydrating,
  onHydrationComplete,
  publishLoadedNotes,
  publishStagedNotes,
}: {
  scope: string;
  isCurrentRefreshRequest: () => boolean;
  markHydrating: () => void;
  onHydrationComplete: () => void;
  publishLoadedNotes: (notes: Note[]) => void;
  publishStagedNotes: (notes: Note[]) => void;
}): Promise<InitialNotesRefreshOutcome> {
  const stagedNotesPromise = getNotesPageForScope(scope, {
    limit: INITIAL_NOTES_BOOTSTRAP_LIMIT,
  });
  const stagedResult = await withTimeoutResult(
    stagedNotesPromise,
    INITIAL_NOTES_STAGED_LOAD_TIMEOUT_MS
  );
  if (!isCurrentRefreshRequest()) {
    return 'stale';
  }

  if (stagedResult.status === 'timed-out') {
    console.warn(
      '[notes] Initial staged notes load timed out; releasing startup with current notes.'
    );
    void stagedNotesPromise
      .then(async (stagedNotes) => {
        if (!isCurrentRefreshRequest()) {
          return;
        }

        publishStagedNotes(stagedNotes);

        const allNotes = await getAllNotesForScope(scope);
        if (!isCurrentRefreshRequest()) {
          return;
        }

        publishLoadedNotes(allNotes);
        onHydrationComplete();
      })
      .catch((error) => {
        console.error('Failed to finish background note hydration:', error);
      });

    return 'released';
  }

  publishStagedNotes(stagedResult.value);
  markHydrating();

  const allNotesPromise = getAllNotesForScope(scope);
  const hydrationResult = await withTimeoutResult(
    allNotesPromise,
    INITIAL_NOTES_FULL_HYDRATION_TIMEOUT_MS
  );
  if (!isCurrentRefreshRequest()) {
    return 'stale';
  }

  if (hydrationResult.status === 'timed-out') {
    console.warn(
      '[notes] Initial full hydration timed out; releasing startup with staged notes.'
    );
    void allNotesPromise
      .then((allNotes) => {
        if (!isCurrentRefreshRequest()) {
          return;
        }

        publishLoadedNotes(allNotes);
        onHydrationComplete();
      })
      .catch((error) => {
        console.error('Failed to finish background note hydration:', error);
      });

    return 'released';
  }

  publishLoadedNotes(hydrationResult.value);
  onHydrationComplete();
  return 'loaded';
}

function useNotesStoreValue(): { state: NotesStateValue; actions: NotesActionsValue } {
  const { user, isReady: authReady } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [phase, setPhase] = useState<NotesLoadPhase>('bootstrapping');
  const notesRef = useRef<Note[]>([]);
  const phaseRef = useRef<NotesLoadPhase>(phase);
  const activeScopeRef = useRef<string>(LOCAL_NOTES_SCOPE);
  const activeScopeRevisionRef = useRef(0);
  const refreshRequestIdRef = useRef(0);
  const loadedScopeRef = useRef<string | null>(null);
  const initialLoadRetryCountRef = useRef(0);
  const initialLoadRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const clearInitialLoadRetryTimer = useCallback(() => {
    if (initialLoadRetryTimerRef.current) {
      clearTimeout(initialLoadRetryTimerRef.current);
      initialLoadRetryTimerRef.current = null;
    }
  }, []);

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
    const dualPrimaryPhotoUri = note?.dualPrimaryPhotoLocalUri ?? '';
    const dualSecondaryPhotoUri = note?.dualSecondaryPhotoLocalUri ?? '';
    const dualComposedPhotoUri = note?.dualComposedPhotoLocalUri ?? '';
    if (
      note?.type !== 'photo' ||
      (!photoUri &&
        !pairedVideoUri &&
        !dualPrimaryPhotoUri &&
        !dualSecondaryPhotoUri &&
        !dualComposedPhotoUri)
    ) {
      return;
    }

    try {
      const uniqueMediaUris = Array.from(
        new Set(
          [
            photoUri,
            pairedVideoUri,
            dualPrimaryPhotoUri,
            dualSecondaryPhotoUri,
            dualComposedPhotoUri,
          ].filter(Boolean)
        )
      );

      for (const mediaUri of uniqueMediaUris) {
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
      let refreshOutcome: InitialNotesRefreshOutcome | 'failed' | null = null;

      const isCurrentRefreshRequest = () =>
        refreshRequestIdRef.current === requestId && activeScopeRef.current === scope;

      const publishLoadedNotes = (nextNotes: Note[]) => {
        notesRef.current = nextNotes;
        setNotes(nextNotes);
        if (options?.updateWidget) {
          scheduleWidgetUpdate(nextNotes);
        }
        if (options?.syncGeofences) {
          syncGeofencesForNotes('note refresh', nextNotes);
        }
      };

      const publishStagedNotes = (nextNotes: Note[]) => {
        notesRef.current = nextNotes;
        setNotes(nextNotes);
      };

      const resetInitialLoadRetryCount = () => {
        initialLoadRetryCountRef.current = 0;
      };

      try {
        if (showLoading) {
          setPhase('bootstrapping');
        } else if (phaseRef.current === 'ready') {
          setPhase('refreshing');
        }

        if (showLoading) {
          refreshOutcome = await loadInitialNotesForScope({
            scope,
            isCurrentRefreshRequest,
            markHydrating: () => setPhase('hydrating'),
            onHydrationComplete: resetInitialLoadRetryCount,
            publishLoadedNotes,
            publishStagedNotes,
          });
          return;
        } else {
          const allNotes = await getAllNotesForScope(scope);
          if (!isCurrentRefreshRequest()) {
            refreshOutcome = 'stale';
            return;
          }

          publishLoadedNotes(allNotes);
        }

        if (!isCurrentRefreshRequest()) {
          return;
        }

        refreshOutcome = 'loaded';
        resetInitialLoadRetryCount();
      } catch (error) {
        console.error('Failed to load notes:', error);
        refreshOutcome = 'failed';
        if (showLoading) {
          setPhase('bootstrapping');
        }
        const shouldRetryInitialLoad =
          showLoading &&
          initialLoadRetryCountRef.current < 1 &&
          refreshRequestIdRef.current === requestId &&
          activeScopeRef.current === scope;

        if (shouldRetryInitialLoad) {
          initialLoadRetryCountRef.current += 1;
          clearInitialLoadRetryTimer();
          initialLoadRetryTimerRef.current = setTimeout(() => {
            if (activeScopeRef.current !== scope) {
              return;
            }

            initialLoadRetryTimerRef.current = null;
            void refreshNotes(true, options);
          }, INITIAL_NOTES_LOAD_RETRY_DELAY_MS);
          return;
        }

        if (showLoading && refreshRequestIdRef.current === requestId && activeScopeRef.current === scope) {
          refreshOutcome = 'released';
        }
      } finally {
        if (
          refreshRequestIdRef.current === requestId &&
          (!showLoading || refreshOutcome === 'loaded' || refreshOutcome === 'released')
        ) {
          setPhase('ready');
        }
      }
    },
    [clearInitialLoadRetryTimer, scheduleWidgetUpdate, syncGeofencesForNotes]
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
    clearInitialLoadRetryTimer();
    initialLoadRetryCountRef.current = 0;
    loadedScopeRef.current = nextScope;

    void (async () => {
      await traceStartupAsync(
        'notes.initial-load',
        () =>
          refreshNotes(true, {
            scope: nextScope,
            syncGeofences: true,
            updateWidget: true,
          }),
        {
          scope: nextScope,
          signedIn: nextScope !== LOCAL_NOTES_SCOPE,
        }
      );
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
      clearInitialLoadRetryTimer();
      cleanupIdleHandle?.cancel();
      if (cleanupTimeout) {
        clearTimeout(cleanupTimeout);
      }
    };
  }, [applyActiveScope, authReady, clearInitialLoadRetryTimer, refreshNotes, user?.uid]);

  useEffect(() => {
    return () => {
      clearInitialLoadRetryTimer();
    };
  }, [clearInitialLoadRetryTimer]);

  const createNote = useCallback(
    async (input: CreateNoteInput): Promise<Note> => {
      const scope = activeScopeRef.current;
      const scopeRevision = activeScopeRevisionRef.current;
      const timestamp = new Date().toISOString();
      const note = await traceAppAsync(
        'notes',
        'note.create',
        () =>
          dbCreate(input, {
            scope,
            syncChange: {
              type: 'create',
              entity: 'note',
              payload: input,
              timestamp,
            },
          }),
        {
          hasDoodle: Boolean(input.hasDoodle),
          hasPhoto: input.type === 'photo',
          hasStickers: Boolean(input.hasStickers),
          signedIn: scope !== LOCAL_NOTES_SCOPE,
          type: input.type,
        }
      );
      if (!isCurrentScope(scope, scopeRevision)) {
        return note;
      }

      const nextNotes = prependNote(notesRef.current, note);
      commitNotes(nextNotes, { preferredNoteId: note.id });

      void skipImmediateReminderForNewNote(note).catch((error) => {
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
      await traceAppAsync(
        'notes',
        'note.update',
        () =>
          dbUpdate(id, updates, {
            scope,
            syncChange: {
              type: 'update',
              entity: 'note',
              entityId: id,
              payload: updates,
              timestamp: new Date().toISOString(),
            },
          }),
        {
          fieldCount: Object.keys(updates).length,
          signedIn: scope !== LOCAL_NOTES_SCOPE,
        }
      );
      if (!isCurrentScope(scope, scopeRevision)) {
        return;
      }

      const nextNotes = updateNoteInCollection(notesRef.current, id, updates);
      commitNotes(nextNotes);
      if (doesNoteUpdateAffectReminderSelection(updates)) {
        syncGeofencesForNotes('note update', nextNotes);
      }
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
        updatedAt: timestamp,
        localRevision: (note.localRevision ?? 0) + 1,
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

    const scope = activeScopeRef.current;
    const scopeRevision = activeScopeRevisionRef.current;
    const notesSnapshot = notesRef.current;
    const dbResults = await dbSearchNotes(trimmedQuery, scope);

    if (!isCurrentScope(scope, scopeRevision)) {
      return [];
    }

    const fallbackMatches = filterNotesByQuery(notesSnapshot, trimmedQuery);

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
  }, [isCurrentScope]);

  const deleteNote = useCallback(
    async (id: string) => {
      const scope = activeScopeRef.current;
      const scopeRevision = activeScopeRevisionRef.current;
      const note =
        typeof dbGetByIdForScope === 'function'
          ? await dbGetByIdForScope(id, scope)
          : await dbGetById(id);

      await traceAppAsync(
        'notes',
        'note.delete',
        () =>
          dbDelete(id, {
            scope,
            syncChange: {
              type: 'delete',
              entity: 'note',
              entityId: id,
              timestamp: new Date().toISOString(),
            },
          }),
        {
          hadNote: Boolean(note),
          signedIn: scope !== LOCAL_NOTES_SCOPE,
          type: note?.type ?? null,
        }
      );
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

  const state = useMemo(
    () => ({
      notes,
      phase,
      loading,
      initialLoadComplete,
    }),
    [initialLoadComplete, loading, notes, phase]
  );

  const actions = useMemo(
    () => ({
      refreshNotes,
      createNote,
      updateNote,
      toggleFavorite,
      searchNotes,
      deleteNote,
      deleteAllNotes,
      getNoteById,
    }),
    [
      createNote,
      deleteAllNotes,
      deleteNote,
      getNoteById,
      refreshNotes,
      searchNotes,
      toggleFavorite,
      updateNote,
    ]
  );

  return {
    state,
    actions,
  };
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const { state, actions } = useNotesStoreValue();
  return (
    <NotesActionsContext.Provider value={actions}>
      <NotesStateContext.Provider value={state}>{children}</NotesStateContext.Provider>
    </NotesActionsContext.Provider>
  );
}

export function useNotesState() {
  const context = useContext(NotesStateContext);
  if (!context) {
    throw new Error('useNotesState must be used within a NotesProvider');
  }
  return context;
}

export function useNotesActions() {
  const context = useContext(NotesActionsContext);
  if (!context) {
    throw new Error('useNotesActions must be used within a NotesProvider');
  }
  return context;
}

export function useNotesStore() {
  const state = useNotesState();
  const actions = useNotesActions();
  return useMemo(
    () => ({
      ...state,
      ...actions,
    }),
    [actions, state]
  );
}

export const useNotes = useNotesStore;

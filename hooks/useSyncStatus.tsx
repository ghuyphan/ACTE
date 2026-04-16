import { AppState } from 'react-native';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import i18n from '../constants/i18n';
import { useConnectivity } from './useConnectivity';
import {
  getSyncRepository,
  isInitialSyncPendingForUser,
  SyncMode,
  SyncQueueItem,
  syncNotes,
} from '../services/syncService';
import { useAuth } from './useAuth';
import { useNotes } from './useNotes';
import { getPersistentItem, setPersistentItem } from '../utils/appStorage';

type SyncState = 'idle' | 'syncing' | 'success' | 'error';
export type SyncPhase = 'idle' | 'bootstrapping' | 'syncing' | 'success' | 'error';
export type SyncBootstrapState =
  | 'idle'
  | 'preparing'
  | 'syncing'
  | 'disabled'
  | 'offline'
  | 'error'
  | 'complete';

interface SyncStatusContextValue {
  phase: SyncPhase;
  bootstrapState: SyncBootstrapState;
  status: SyncState;
  isInitialSyncPending: boolean;
  lastSyncedAt: string | null;
  lastMessage: string | null;
  pendingCount: number;
  failedCount: number;
  blockedCount: number;
  recentQueueItems: SyncQueueItem[];
  isEnabled: boolean;
  setSyncEnabled: (enabled: boolean) => void;
  requestSync: () => void;
}

interface QueueStatsSnapshot {
  pendingCount: number;
  failedCount: number;
  blockedCount: number;
  recentQueueItems: SyncQueueItem[];
}

const AUTO_SYNC_DEBOUNCE_MS = 1200;
const SYNC_ENABLED_KEY = 'settings.syncEnabled';

const SyncStatusContext = createContext<SyncStatusContextValue | undefined>(undefined);

export function SyncStatusProvider({ children }: { children: ReactNode }) {
  const { user, isReady, isAuthAvailable } = useAuth();
  const {
    notes,
    refreshNotes,
    initialLoadComplete: notesInitialLoadComplete,
  } = useNotes();
  const { isOnline, status: connectivityStatus } = useConnectivity();
  const [status, setStatus] = useState<SyncState>('idle');
  const [isInitialSyncPending, setIsInitialSyncPending] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);
  const [recentQueueItems, setRecentQueueItems] = useState<SyncQueueItem[]>([]);
  const [syncEnabledState, setSyncEnabledState] = useState<boolean>(true);
  const [isSyncPrefReady, setIsSyncPrefReady] = useState(false);
  const [isInitialSyncStateReady, setIsInitialSyncStateReady] = useState(false);
  const currentUserUidRef = useRef<string | null>(user?.uid ?? null);
  currentUserUidRef.current = user?.uid ?? null;
  const initialSyncPendingRef = useRef(isInitialSyncPending);
  initialSyncPendingRef.current = isInitialSyncPending;

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncInFlightRef = useRef<Promise<void> | null>(null);
  const syncRequestIdRef = useRef(0);
  const pendingRunModeRef = useRef<SyncMode | null>(null);
  const previousUserUidRef = useRef<string | null>(null);
  const skipNextNotesEffectRef = useRef(false);
  const suppressNextNotesEffectRef = useRef(false);
  const runSyncNowRef = useRef<(mode?: SyncMode) => Promise<void>>(async () => undefined);

  const clearDebounceTimer = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const refreshQueueStats = useCallback(async (): Promise<QueueStatsSnapshot | null> => {
    try {
      const repository = getSyncRepository();
      const stats = repository.peekStats
        ? await repository.peekStats()
        : await repository.getStats();
      const recentItems = await repository.listRecent(5);
      setPendingCount(stats.pendingCount);
      setFailedCount(stats.failedCount);
      setBlockedCount(stats.blockedCount);
      setRecentQueueItems(recentItems);
      return {
        pendingCount: stats.pendingCount,
        failedCount: stats.failedCount,
        blockedCount: stats.blockedCount,
        recentQueueItems: recentItems,
      };
    } catch (error) {
      console.warn('[syncStatus] Failed to load queue stats:', error);
      return null;
    }
  }, []);

  const recoverBlockedSessionErrors = useCallback(async () => {
    try {
      const repository = getSyncRepository();
      if (typeof repository.recoverBlockedSessionErrors !== 'function') {
        return 0;
      }

      const recoveredCount = await repository.recoverBlockedSessionErrors();
      if (recoveredCount > 0) {
        await refreshQueueStats();
      }
      return recoveredCount;
    } catch (error) {
      console.warn('[syncStatus] Failed to recover blocked session sync items:', error);
      return 0;
    }
  }, [refreshQueueStats]);

  // Load persistence
  useEffect(() => {
    let cancelled = false;

    void getPersistentItem(SYNC_ENABLED_KEY)
      .then((value) => {
        if (cancelled) {
          return;
        }

        if (value !== null) {
          setSyncEnabledState(value === 'true');
        }
      })
      .catch((error) => {
        console.warn('[syncStatus] Failed to load sync preference:', error);
      })
      .finally(() => {
        if (!cancelled) {
          setIsSyncPrefReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setSyncEnabled = useCallback(async (enabled: boolean) => {
    setSyncEnabledState(enabled);
    await setPersistentItem(SYNC_ENABLED_KEY, enabled.toString());
  }, []);

  const invalidateSyncRequests = useCallback(() => {
    syncRequestIdRef.current += 1;
    return syncRequestIdRef.current;
  }, []);

  const isCurrentSyncRequest = useCallback(
    (requestId: number, requestUserUid: string | null) =>
      syncRequestIdRef.current === requestId && currentUserUidRef.current === requestUserUid,
    []
  );

  const getPreferredSyncMode = useCallback(
    (requestedMode: SyncMode = 'incremental'): SyncMode =>
      requestedMode === 'full' || initialSyncPendingRef.current ? 'full' : 'incremental',
    []
  );

  useEffect(() => {
    let cancelled = false;

    if (!isReady || !isAuthAvailable || !user) {
      setIsInitialSyncPending(false);
      setIsInitialSyncStateReady(true);
      return () => {
        cancelled = true;
      };
    }

    setIsInitialSyncStateReady(false);

    void (async () => {
      try {
        const pending = await isInitialSyncPendingForUser(user.uid);

        if (!cancelled && currentUserUidRef.current === user.uid) {
          setIsInitialSyncPending(pending);
          setIsInitialSyncStateReady(true);
        }
      } catch (error) {
        console.warn('[syncStatus] Failed to load initial sync state:', error);
        if (!cancelled && currentUserUidRef.current === user.uid) {
          setIsInitialSyncPending(true);
          setIsInitialSyncStateReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthAvailable, isReady, user]);

  runSyncNowRef.current = async (mode: SyncMode = 'incremental') => {
    const requestUserUid = currentUserUidRef.current;
    if (
      !isReady ||
      !isAuthAvailable ||
      !requestUserUid ||
      !notesInitialLoadComplete ||
      !syncEnabledState ||
      !isSyncPrefReady ||
      !isInitialSyncStateReady
    ) {
      await refreshQueueStats();
      return;
    }

    if (!isOnline) {
      const queueStats = await refreshQueueStats();
      const hasPendingChanges = (queueStats?.pendingCount ?? pendingCount) > 0;
      setLastMessage(
        hasPendingChanges
          ? i18n.t('settings.syncPendingOffline', 'Your notes are saved locally and will sync when you are back online.')
          : i18n.t('settings.offlineReadOnly', 'You are offline right now. Cloud sync will resume when you reconnect.')
      );
      return;
    }

    if (syncInFlightRef.current) {
      pendingRunModeRef.current =
        pendingRunModeRef.current === 'full' || mode === 'full' ? 'full' : 'incremental';
      return;
    }

    clearDebounceTimer();
    const effectiveMode = getPreferredSyncMode(mode);

    const currentUser = {
      uid: requestUserUid,
      displayName: user?.displayName ?? null,
      email: user?.email ?? null,
      photoURL: user?.photoURL ?? null,
    };
    const requestId = invalidateSyncRequests();

    const syncTask = (async () => {
      setStatus('syncing');
      setLastMessage(null);

      const result = await syncNotes(currentUser, notes, { mode: effectiveMode });
      const queueStats = await refreshQueueStats();
      if (!isCurrentSyncRequest(requestId, requestUserUid)) {
        return;
      }
      const hasPendingChanges = (queueStats?.pendingCount ?? pendingCount) > 0;

      if (result.status === 'success') {
        if (effectiveMode === 'full' && initialSyncPendingRef.current && result.bootstrapCompleted) {
          setIsInitialSyncPending(false);
          initialSyncPendingRef.current = false;
          if (!isCurrentSyncRequest(requestId, requestUserUid)) {
            return;
          }
        } else if (effectiveMode === 'full' && initialSyncPendingRef.current && !result.bootstrapCompleted) {
          setIsInitialSyncPending(true);
          initialSyncPendingRef.current = true;
        }

        setStatus('success');
        setLastSyncedAt(new Date().toISOString());
        setLastMessage(
          hasPendingChanges
            ? i18n.t('settings.syncPendingOffline', 'Your notes are saved locally and will sync when you are back online.')
            : result.message ?? null
        );

        if ((result.importedCount ?? 0) > 0) {
          suppressNextNotesEffectRef.current = true;
          await refreshNotes(false, { updateWidget: true, syncGeofences: true });
          if (!isCurrentSyncRequest(requestId, requestUserUid)) {
            return;
          }
        }

        return;
      }

      setStatus('error');
      setLastMessage(
        result.message ??
          i18n.t('settings.autoSyncRetry', 'We could not sync right now. We will try again when the app is active.')
      );
    })().finally(() => {
      syncInFlightRef.current = null;

      const pendingMode = pendingRunModeRef.current;
      pendingRunModeRef.current = null;
      if (pendingMode) {
        void runSyncNowRef.current(getPreferredSyncMode(pendingMode));
      }
    });

    syncInFlightRef.current = syncTask;
    await syncTask;
  };

  const queueSync = useCallback(
    (immediate = false, mode: SyncMode = 'incremental') => {
      if (
        !isReady ||
        !isAuthAvailable ||
        !user ||
        !notesInitialLoadComplete ||
        !syncEnabledState ||
        !isSyncPrefReady ||
        !isInitialSyncStateReady
      ) {
        return;
      }

      if (!isOnline && !immediate) {
        return;
      }

      clearDebounceTimer();
      const preferredMode = getPreferredSyncMode(mode);

      if (immediate) {
        void runSyncNowRef.current(preferredMode);
        return;
      }

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void runSyncNowRef.current(preferredMode);
      }, AUTO_SYNC_DEBOUNCE_MS);
    },
    [
      clearDebounceTimer,
      getPreferredSyncMode,
      isAuthAvailable,
      isInitialSyncStateReady,
      isOnline,
      isReady,
      isSyncPrefReady,
      notesInitialLoadComplete,
      syncEnabledState,
      user,
    ]
  );

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!user || !isAuthAvailable) {
      invalidateSyncRequests();
      clearDebounceTimer();
      syncInFlightRef.current = null;
      pendingRunModeRef.current = null;
      skipNextNotesEffectRef.current = false;
      suppressNextNotesEffectRef.current = false;
      previousUserUidRef.current = user?.uid ?? null;
      initialSyncPendingRef.current = false;
      setIsInitialSyncPending(false);
      setIsInitialSyncStateReady(true);
      setStatus('idle');
      setLastMessage(null);
      setLastSyncedAt(null);
      void refreshQueueStats();
      return;
    }

    if (!notesInitialLoadComplete) {
      return;
    }

    if (previousUserUidRef.current !== user.uid) {
      if (!isSyncPrefReady || !syncEnabledState || !isInitialSyncStateReady) {
        return;
      }

      previousUserUidRef.current = user.uid;
      skipNextNotesEffectRef.current = true;
      setLastMessage(null);
      setLastSyncedAt(null);
      void recoverBlockedSessionErrors().finally(() => {
        queueSync(true, getPreferredSyncMode('incremental'));
      });
    }
  }, [
    clearDebounceTimer,
    getPreferredSyncMode,
    invalidateSyncRequests,
    isAuthAvailable,
    isInitialSyncStateReady,
    isReady,
    isSyncPrefReady,
    notesInitialLoadComplete,
    queueSync,
    recoverBlockedSessionErrors,
    refreshQueueStats,
    syncEnabledState,
    user,
  ]);

  useEffect(() => {
    if (
      !isReady ||
      !user ||
      !isAuthAvailable ||
      !isInitialSyncStateReady ||
      !notesInitialLoadComplete
    ) {
      return;
    }

    if (skipNextNotesEffectRef.current) {
      skipNextNotesEffectRef.current = false;
      return;
    }

    if (suppressNextNotesEffectRef.current) {
      suppressNextNotesEffectRef.current = false;
      return;
    }

    void refreshQueueStats();
    queueSync(false, getPreferredSyncMode('incremental'));
  }, [
    getPreferredSyncMode,
    isAuthAvailable,
    isInitialSyncStateReady,
    isReady,
    notesInitialLoadComplete,
    notes,
    queueSync,
    refreshQueueStats,
    user,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void recoverBlockedSessionErrors().finally(() => {
          queueSync(true, 'incremental');
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [queueSync, recoverBlockedSessionErrors]);

  useEffect(() => {
    return () => {
      clearDebounceTimer();
    };
  }, [clearDebounceTimer]);

  useEffect(() => {
    void refreshQueueStats();
  }, [refreshQueueStats]);

  useEffect(() => {
    const offlinePendingMessage = i18n.t(
      'settings.syncPendingOffline',
      'Your notes are saved locally and will sync when you are back online.'
    );
    const offlineReadOnlyMessage = i18n.t(
      'settings.offlineReadOnly',
      'You are offline right now. Cloud sync will resume when you reconnect.'
    );

    if (connectivityStatus !== 'online') {
      if (pendingCount > 0) {
        setLastMessage(offlinePendingMessage);
      }
      return;
    }

    if (pendingCount > 0 || failedCount > 0) {
      queueSync(true, 'incremental');
      return;
    }

    setLastMessage((currentMessage) =>
      currentMessage === offlinePendingMessage || currentMessage === offlineReadOnlyMessage
        ? null
        : currentMessage
    );
  }, [connectivityStatus, failedCount, pendingCount, queueSync]);

  const bootstrapState: SyncBootstrapState = useMemo(() => {
    if (!user || !isAuthAvailable) {
      return 'idle';
    }

    if (!isInitialSyncPending) {
      return 'complete';
    }

    if (!notesInitialLoadComplete || !isSyncPrefReady || !isInitialSyncStateReady) {
      return 'preparing';
    }

    if (!syncEnabledState) {
      return 'disabled';
    }

    if (!isOnline) {
      return 'offline';
    }

    if (status === 'syncing') {
      return 'syncing';
    }

    if (status === 'error') {
      return 'error';
    }

    return 'preparing';
  }, [
    isAuthAvailable,
    isInitialSyncPending,
    isInitialSyncStateReady,
    isOnline,
    isSyncPrefReady,
    notesInitialLoadComplete,
    status,
    syncEnabledState,
    user,
  ]);

  const phase: SyncPhase = useMemo(() => {
    if (!user || !isAuthAvailable) {
      return 'idle';
    }

    if (bootstrapState === 'preparing' || bootstrapState === 'syncing') {
      return 'bootstrapping';
    }

    if (status === 'syncing') {
      return 'syncing';
    }

    return status;
  }, [bootstrapState, isAuthAvailable, status, user]);

  const value = useMemo<SyncStatusContextValue>(
    () => ({
      phase,
      bootstrapState,
      status,
      isInitialSyncPending,
      lastSyncedAt,
      lastMessage,
      pendingCount,
      failedCount,
      blockedCount,
      recentQueueItems,
      isEnabled: syncEnabledState,
      setSyncEnabled,
      requestSync: () => {
        void recoverBlockedSessionErrors().finally(() => {
          queueSync(true, 'full');
        });
      },
    }),
    [
      blockedCount,
      bootstrapState,
      failedCount,
      phase,
      isInitialSyncPending,
      lastMessage,
      lastSyncedAt,
      pendingCount,
      queueSync,
      recoverBlockedSessionErrors,
      recentQueueItems,
      setSyncEnabled,
      status,
      syncEnabledState,
    ]
  );

  return <SyncStatusContext.Provider value={value}>{children}</SyncStatusContext.Provider>;
}

export function useSyncStatus() {
  const context = useContext(SyncStatusContext);

  if (!context) {
    throw new Error('useSyncStatus must be used within a SyncStatusProvider');
  }

  return context;
}

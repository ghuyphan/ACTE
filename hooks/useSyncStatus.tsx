import { AppState } from 'react-native';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import i18n from '../constants/i18n';
import { useConnectivity } from './useConnectivity';
import { getSyncRepository, SyncMode, SyncQueueItem, syncNotes } from '../services/syncService';
import { useAuth } from './useAuth';
import { useNotes } from './useNotes';
import { getPersistentItem, setPersistentItem } from '../utils/appStorage';

type SyncState = 'idle' | 'syncing' | 'success' | 'error';

interface SyncStatusContextValue {
  status: SyncState;
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
  const notesStore = useNotes();
  const { notes, refreshNotes, loading } = notesStore;
  const hasLoadedAllNotes = notesStore.hasLoadedAllNotes ?? true;
  const ensureAllNotesLoaded = notesStore.ensureAllNotesLoaded ?? (async () => notes);
  const { isOnline, status: connectivityStatus } = useConnectivity();
  const [status, setStatus] = useState<SyncState>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);
  const [recentQueueItems, setRecentQueueItems] = useState<SyncQueueItem[]>([]);
  const [syncEnabledState, setSyncEnabledState] = useState<boolean>(true);
  const [isSyncPrefReady, setIsSyncPrefReady] = useState(false);
  const currentUserUidRef = useRef<string | null>(user?.uid ?? null);
  currentUserUidRef.current = user?.uid ?? null;

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncInFlightRef = useRef<Promise<void> | null>(null);
  const syncRequestIdRef = useRef(0);
  const pendingRunRef = useRef(false);
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

  const isCurrentSyncRequest = useCallback(
    (requestId: number, requestUserUid: string | null) =>
      syncRequestIdRef.current === requestId && currentUserUidRef.current === requestUserUid,
    []
  );

  runSyncNowRef.current = async (mode: SyncMode = 'incremental') => {
    const requestUserUid = currentUserUidRef.current;
    if (!isReady || !isAuthAvailable || !requestUserUid || loading || !syncEnabledState || !isSyncPrefReady) {
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
      pendingRunRef.current = true;
      return;
    }

    clearDebounceTimer();

    const currentUser = {
      uid: requestUserUid,
      displayName: user?.displayName ?? null,
      email: user?.email ?? null,
      photoURL: user?.photoURL ?? null,
    };
    const requestId = ++syncRequestIdRef.current;

    const syncTask = (async () => {
      setStatus('syncing');
      setLastMessage(null);

      const notesForSync = hasLoadedAllNotes ? notes : await ensureAllNotesLoaded();
      const result = await syncNotes(currentUser, notesForSync, { mode });
      const queueStats = await refreshQueueStats();
      if (!isCurrentSyncRequest(requestId, requestUserUid)) {
        return;
      }
      const hasPendingChanges = (queueStats?.pendingCount ?? pendingCount) > 0;

      if (result.status === 'success') {
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

      if (pendingRunRef.current) {
        pendingRunRef.current = false;
        void runSyncNowRef.current(mode);
      }
    });

    syncInFlightRef.current = syncTask;
    await syncTask;
  };

  const queueSync = useCallback(
    (immediate = false, mode: SyncMode = 'incremental') => {
      if (!isReady || !isAuthAvailable || !user || loading || !syncEnabledState || !isSyncPrefReady) {
        return;
      }

      if (!isOnline && !immediate) {
        return;
      }

      clearDebounceTimer();

      if (immediate) {
        void runSyncNowRef.current(mode);
        return;
      }

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void runSyncNowRef.current(mode);
      }, AUTO_SYNC_DEBOUNCE_MS);
    },
    [clearDebounceTimer, isAuthAvailable, isOnline, isReady, isSyncPrefReady, loading, syncEnabledState, user]
  );

  useEffect(() => {
    if (!isReady || loading) {
      return;
    }

    if (!user || !isAuthAvailable) {
      clearDebounceTimer();
      pendingRunRef.current = false;
      skipNextNotesEffectRef.current = false;
      suppressNextNotesEffectRef.current = false;
      previousUserUidRef.current = user?.uid ?? null;
      setStatus('idle');
      setLastMessage(null);
      setLastSyncedAt(null);
      void refreshQueueStats();
      return;
    }

    if (previousUserUidRef.current !== user.uid) {
      if (!isSyncPrefReady || !syncEnabledState) {
        return;
      }

      previousUserUidRef.current = user.uid;
      skipNextNotesEffectRef.current = true;
      setLastMessage(null);
      setLastSyncedAt(null);
      queueSync(true, 'full');
    }
  }, [clearDebounceTimer, isAuthAvailable, isReady, isSyncPrefReady, loading, queueSync, refreshQueueStats, syncEnabledState, user]);

  useEffect(() => {
    if (!isReady || loading || !user || !isAuthAvailable) {
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
    queueSync(false, 'incremental');
  }, [isAuthAvailable, isReady, loading, notes, queueSync, refreshQueueStats, user]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        queueSync(true, 'incremental');
      }
    });

    return () => {
      subscription.remove();
    };
  }, [queueSync]);

  useEffect(() => {
    return () => {
      clearDebounceTimer();
    };
  }, [clearDebounceTimer]);

  useEffect(() => {
    void refreshQueueStats();
  }, [refreshQueueStats]);

  useEffect(() => {
    if (connectivityStatus !== 'online') {
      if (pendingCount > 0) {
        setLastMessage(
          i18n.t('settings.syncPendingOffline', 'Your notes are saved locally and will sync when you are back online.')
        );
      }
      return;
    }

    if (pendingCount > 0 || failedCount > 0) {
      queueSync(true, 'incremental');
    }
  }, [connectivityStatus, failedCount, pendingCount, queueSync]);

  const value = useMemo<SyncStatusContextValue>(
    () => ({
      status,
      lastSyncedAt,
      lastMessage,
      pendingCount,
      failedCount,
      blockedCount,
      recentQueueItems,
      isEnabled: syncEnabledState,
      setSyncEnabled,
      requestSync: () => {
        queueSync(true, 'full');
      },
    }),
    [blockedCount, failedCount, lastMessage, lastSyncedAt, pendingCount, queueSync, recentQueueItems, setSyncEnabled, status, syncEnabledState]
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

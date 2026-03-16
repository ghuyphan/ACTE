import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import i18n from '../constants/i18n';
import { syncNotesToFirebase } from '../services/syncService';
import { useAuth } from './useAuth';
import { useNotes } from './useNotes';

type SyncState = 'idle' | 'syncing' | 'success' | 'error';

interface SyncStatusContextValue {
  status: SyncState;
  lastSyncedAt: string | null;
  lastMessage: string | null;
  isEnabled: boolean;
  setSyncEnabled: (enabled: boolean) => void;
  requestSync: () => void;
}

const AUTO_SYNC_DEBOUNCE_MS = 1200;
const SYNC_ENABLED_KEY = 'settings.syncEnabled';

const SyncStatusContext = createContext<SyncStatusContextValue | undefined>(undefined);

export function SyncStatusProvider({ children }: { children: ReactNode }) {
  const { user, isReady, isAuthAvailable } = useAuth();
  const { notes, refreshNotes, loading } = useNotes();
  const [status, setStatus] = useState<SyncState>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [syncEnabledState, setSyncEnabledState] = useState<boolean>(true);
  const [isSyncPrefReady, setIsSyncPrefReady] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncInFlightRef = useRef<Promise<void> | null>(null);
  const pendingRunRef = useRef(false);
  const previousUserUidRef = useRef<string | null>(null);
  const skipNextNotesEffectRef = useRef(false);
  const suppressNextNotesEffectRef = useRef(false);
  const runSyncNowRef = useRef<() => Promise<void>>(async () => undefined);

  const clearDebounceTimer = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  // Load persistence
  useEffect(() => {
    AsyncStorage.getItem(SYNC_ENABLED_KEY).then((value) => {
      if (value !== null) {
        setSyncEnabledState(value === 'true');
      }
      setIsSyncPrefReady(true);
    });
  }, []);

  const setSyncEnabled = useCallback(async (enabled: boolean) => {
    setSyncEnabledState(enabled);
    await AsyncStorage.setItem(SYNC_ENABLED_KEY, enabled.toString());
  }, []);

  runSyncNowRef.current = async () => {
    if (!isReady || !isAuthAvailable || !user || loading || !syncEnabledState || !isSyncPrefReady) {
      return;
    }

    if (syncInFlightRef.current) {
      pendingRunRef.current = true;
      return;
    }

    clearDebounceTimer();

    const currentUser = {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
    };

    const syncTask = (async () => {
      setStatus('syncing');
      setLastMessage(null);

      const result = await syncNotesToFirebase(currentUser, notes);

      if (result.status === 'success') {
        setStatus('success');
        setLastSyncedAt(new Date().toISOString());
        setLastMessage(result.message ?? null);

        if ((result.importedCount ?? 0) > 0) {
          suppressNextNotesEffectRef.current = true;
          await refreshNotes(false);
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
        void runSyncNowRef.current();
      }
    });

    syncInFlightRef.current = syncTask;
    await syncTask;
  };

  const queueSync = useCallback(
    (immediate = false) => {
      if (!isReady || !isAuthAvailable || !user || loading || !syncEnabledState || !isSyncPrefReady) {
        return;
      }

      clearDebounceTimer();

      if (immediate) {
        void runSyncNowRef.current();
        return;
      }

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void runSyncNowRef.current();
      }, AUTO_SYNC_DEBOUNCE_MS);
    },
    [clearDebounceTimer, isAuthAvailable, isReady, loading, user]
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
      return;
    }

    if (previousUserUidRef.current !== user.uid) {
      previousUserUidRef.current = user.uid;
      skipNextNotesEffectRef.current = true;
      setLastMessage(null);
      setLastSyncedAt(null);
      queueSync(true);
    }
  }, [clearDebounceTimer, isAuthAvailable, isReady, loading, queueSync, user]);

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

    queueSync(false);
  }, [isAuthAvailable, isReady, loading, notes, queueSync, user]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        queueSync(true);
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

  const value = useMemo<SyncStatusContextValue>(
    () => ({
      status,
      lastSyncedAt,
      lastMessage,
      isEnabled: syncEnabledState,
      setSyncEnabled,
      requestSync: () => {
        queueSync(true);
      },
    }),
    [lastMessage, lastSyncedAt, queueSync, setSyncEnabled, status, syncEnabledState]
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

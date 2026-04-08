import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ConnectivityStatus = 'unknown' | 'online' | 'offline';

interface ConnectivityContextValue {
  status: ConnectivityStatus;
  isOnline: boolean;
  isInternetReachable: boolean | null;
  lastChangedAt: string | null;
}

const ConnectivityContext = createContext<ConnectivityContextValue | undefined>(undefined);

function deriveConnectivityStatus(state: NetInfoState): ConnectivityStatus {
  if (state.isConnected === false) {
    return 'offline';
  }

  if (state.isInternetReachable === true) {
    return 'online';
  }

  if (state.isInternetReachable === false) {
    return 'offline';
  }

  return 'unknown';
}

function hasMeaningfulConnectivityChanged(current: ConnectivityContextValue, nextState: NetInfoState) {
  const nextStatus = deriveConnectivityStatus(nextState);
  return (
    current.status !== nextStatus ||
    current.isOnline !== (nextStatus === 'online') ||
    current.isInternetReachable !== nextState.isInternetReachable
  );
}

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [connectivity, setConnectivity] = useState<ConnectivityContextValue>({
    status: 'unknown',
    isOnline: false,
    isInternetReachable: null,
    lastChangedAt: null,
  });

  const applyState = useCallback((state: NetInfoState) => {
    setConnectivity((current) => {
      const nextStatus = deriveConnectivityStatus(state);
      const changed = hasMeaningfulConnectivityChanged(current, state);
      if (!changed) {
        return current;
      }

      return {
        status: nextStatus,
        isOnline: nextStatus === 'online',
        isInternetReachable: state.isInternetReachable,
        lastChangedAt: new Date().toISOString(),
      };
    });
  }, []);

  const refreshConnectivity = useCallback(() => {
    void NetInfo.refresh().then(applyState).catch(() => {
      void NetInfo.fetch().then(applyState).catch(() => undefined);
    });
  }, [applyState]);

  useEffect(() => {
    let mounted = true;

    NetInfo.configure({
      reachabilityShortTimeout: 5_000,
      reachabilityLongTimeout: 30_000,
      reachabilityRequestTimeout: 10_000,
      reachabilityShouldRun: () => true,
    });

    const applyStateIfMounted = (state: NetInfoState) => {
      if (!mounted) {
        return;
      }

      applyState(state);
    };

    refreshConnectivity();

    const unsubscribe: NetInfoSubscription = NetInfo.addEventListener(applyStateIfMounted);
    const appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        refreshConnectivity();
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
      appStateSubscription.remove();
    };
  }, [applyState, refreshConnectivity]);

  const value = useMemo(() => connectivity, [connectivity]);

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

export function useConnectivity() {
  const context = useContext(ConnectivityContext);
  if (!context) {
    throw new Error('useConnectivity must be used within a ConnectivityProvider');
  }

  return context;
}

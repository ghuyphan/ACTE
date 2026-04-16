import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { logStartupEvent } from '../../utils/startupTrace';

interface StartupInteractionContextValue {
  startupInteractive: boolean;
  markStartupInteractive: (reason?: string) => void;
  resetStartupInteraction: (reason?: string) => void;
}

interface LegacyHomeStartupReadyContextValue {
  homeFeedReady: boolean;
  markHomeFeedReady: () => void;
  resetHomeFeedReady: () => void;
}

const StartupInteractionContext = createContext<StartupInteractionContextValue | undefined>(undefined);

export function StartupInteractionProvider({ children }: { children: ReactNode }) {
  const [startupInteractive, setStartupInteractive] = useState(false);
  const startupWaitStartedAtRef = useRef<number | null>(null);

  const markStartupInteractive = useCallback((reason = 'unknown') => {
    setStartupInteractive((currentValue) => {
      if (currentValue) {
        return currentValue;
      }

      const startedAtMs = startupWaitStartedAtRef.current;
      logStartupEvent('startup.interactive', {
        durationMs: startedAtMs == null ? undefined : Date.now() - startedAtMs,
        reason,
      });
      startupWaitStartedAtRef.current = null;
      return true;
    });
  }, []);

  const resetStartupInteraction = useCallback((reason = 'unknown') => {
    setStartupInteractive((currentValue) => {
      if (!currentValue && startupWaitStartedAtRef.current != null) {
        return currentValue;
      }

      startupWaitStartedAtRef.current = Date.now();
      logStartupEvent('startup.interactive:waiting', {
        reason,
      });
      return false;
    });
  }, []);

  const value = useMemo(
    () => ({
      startupInteractive,
      markStartupInteractive,
      resetStartupInteraction,
    }),
    [markStartupInteractive, resetStartupInteraction, startupInteractive]
  );

  return (
    <StartupInteractionContext.Provider value={value}>
      {children}
    </StartupInteractionContext.Provider>
  );
}

export function useStartupInteraction() {
  const context = useContext(StartupInteractionContext);
  if (!context) {
    throw new Error('useStartupInteraction must be used within a StartupInteractionProvider');
  }
  return context;
}

export const HomeStartupReadyProvider = StartupInteractionProvider;

export function useHomeStartupReady(): LegacyHomeStartupReadyContextValue {
  const {
    startupInteractive,
    markStartupInteractive,
    resetStartupInteraction,
  } = useStartupInteraction();

  return useMemo(
    () => ({
      homeFeedReady: startupInteractive,
      markHomeFeedReady: () => {
        markStartupInteractive('home-feed');
      },
      resetHomeFeedReady: () => {
        resetStartupInteraction('home-feed');
      },
    }),
    [markStartupInteractive, resetStartupInteraction, startupInteractive]
  );
}

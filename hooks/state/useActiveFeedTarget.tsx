import { createContext, ReactNode, useCallback, useContext, useMemo, useRef } from 'react';
import type { FeedTarget } from './feedTargets';

export type ActiveFeedTarget = FeedTarget;

interface ActiveFeedTargetContextValue {
  setActiveFeedTarget: (target: ActiveFeedTarget | null) => void;
  clearActiveFeedTarget: () => void;
  peekActiveFeedTarget: () => ActiveFeedTarget | null;
}

const ActiveFeedTargetContext = createContext<ActiveFeedTargetContextValue | undefined>(undefined);

export function ActiveFeedTargetProvider({ children }: { children: ReactNode }) {
  const activeFeedTargetRef = useRef<ActiveFeedTarget | null>(null);

  const setActiveFeedTarget = useCallback((target: ActiveFeedTarget | null) => {
    activeFeedTargetRef.current = target;
  }, []);

  const clearActiveFeedTarget = useCallback(() => {
    activeFeedTargetRef.current = null;
  }, []);

  const peekActiveFeedTarget = useCallback(() => {
    return activeFeedTargetRef.current;
  }, []);

  const value = useMemo<ActiveFeedTargetContextValue>(
    () => ({
      setActiveFeedTarget,
      clearActiveFeedTarget,
      peekActiveFeedTarget,
    }),
    [clearActiveFeedTarget, peekActiveFeedTarget, setActiveFeedTarget]
  );

  return <ActiveFeedTargetContext.Provider value={value}>{children}</ActiveFeedTargetContext.Provider>;
}

export function useActiveFeedTarget() {
  const context = useContext(ActiveFeedTargetContext);
  if (!context) {
    throw new Error('useActiveFeedTarget must be used within an ActiveFeedTargetProvider');
  }

  return context;
}

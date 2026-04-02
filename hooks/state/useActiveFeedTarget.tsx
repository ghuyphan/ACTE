import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

export type ActiveFeedTarget =
  | { id: string; kind: 'note' }
  | { id: string; kind: 'shared-post' };

interface ActiveFeedTargetContextValue {
  setActiveFeedTarget: (target: ActiveFeedTarget | null) => void;
  clearActiveFeedTarget: () => void;
  peekActiveFeedTarget: () => ActiveFeedTarget | null;
}

const ActiveFeedTargetContext = createContext<ActiveFeedTargetContextValue | undefined>(undefined);

export function ActiveFeedTargetProvider({ children }: { children: ReactNode }) {
  const [activeFeedTarget, setActiveFeedTargetState] = useState<ActiveFeedTarget | null>(null);

  const setActiveFeedTarget = useCallback((target: ActiveFeedTarget | null) => {
    setActiveFeedTargetState(target);
  }, []);

  const clearActiveFeedTarget = useCallback(() => {
    setActiveFeedTargetState(null);
  }, []);

  const peekActiveFeedTarget = useCallback(() => {
    return activeFeedTarget;
  }, [activeFeedTarget]);

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

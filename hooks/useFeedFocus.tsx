import { createContext, ReactNode, useCallback, useContext, useMemo, useRef } from 'react';

export type FeedFocusTarget =
  | { kind: 'note'; id: string }
  | { kind: 'shared-post'; id: string };

interface FeedFocusContextValue {
  requestFeedFocus: (target: FeedFocusTarget) => void;
  peekFeedFocus: () => FeedFocusTarget | null;
  clearFeedFocus: () => void;
}

const FeedFocusContext = createContext<FeedFocusContextValue | undefined>(undefined);

export function FeedFocusProvider({ children }: { children: ReactNode }) {
  const pendingTargetRef = useRef<FeedFocusTarget | null>(null);

  const requestFeedFocus = useCallback((target: FeedFocusTarget) => {
    pendingTargetRef.current = target;
  }, []);

  const peekFeedFocus = useCallback(() => {
    return pendingTargetRef.current;
  }, []);

  const clearFeedFocus = useCallback(() => {
    pendingTargetRef.current = null;
  }, []);

  const value = useMemo<FeedFocusContextValue>(
    () => ({
      requestFeedFocus,
      peekFeedFocus,
      clearFeedFocus,
    }),
    [clearFeedFocus, peekFeedFocus, requestFeedFocus]
  );

  return <FeedFocusContext.Provider value={value}>{children}</FeedFocusContext.Provider>;
}

export function useFeedFocus() {
  const context = useContext(FeedFocusContext);
  if (!context) {
    throw new Error('useFeedFocus must be used within a FeedFocusProvider');
  }

  return context;
}

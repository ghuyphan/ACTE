import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { FeedTarget } from './feedTargets';

export type FeedFocusTarget = FeedTarget;
export type FeedFocusRequest = {
  requestId: number;
  target: FeedFocusTarget;
};

interface FeedFocusContextValue {
  requestFeedFocus: (target: FeedFocusTarget) => void;
  peekFeedFocus: () => FeedFocusTarget | null;
  clearFeedFocus: (requestId?: number) => void;
  consumeFeedFocus: (requestId?: number) => FeedFocusTarget | null;
  pendingFeedFocusRequest: FeedFocusRequest | null;
}

const FeedFocusContext = createContext<FeedFocusContextValue | undefined>(undefined);

export function FeedFocusProvider({ children }: { children: ReactNode }) {
  const nextRequestIdRef = useRef(0);
  const pendingRequestRef = useRef<FeedFocusRequest | null>(null);
  const [pendingFeedFocusRequest, setPendingFeedFocusRequest] = useState<FeedFocusRequest | null>(null);

  const requestFeedFocus = useCallback((target: FeedFocusTarget) => {
    const nextRequest = {
      requestId: nextRequestIdRef.current + 1,
      target,
    };

    nextRequestIdRef.current = nextRequest.requestId;
    pendingRequestRef.current = nextRequest;
    setPendingFeedFocusRequest(nextRequest);
  }, []);

  const peekFeedFocus = useCallback(() => {
    return pendingRequestRef.current?.target ?? null;
  }, []);

  const clearFeedFocus = useCallback((requestId?: number) => {
    const currentRequest = pendingRequestRef.current;
    if (!currentRequest) {
      return;
    }

    if (typeof requestId === 'number' && currentRequest.requestId !== requestId) {
      return;
    }

    pendingRequestRef.current = null;
    setPendingFeedFocusRequest((existingRequest) => {
      if (!existingRequest) {
        return null;
      }

      if (typeof requestId === 'number' && existingRequest.requestId !== requestId) {
        return existingRequest;
      }

      return null;
    });
  }, []);

  const consumeFeedFocus = useCallback((requestId?: number) => {
    const currentRequest = pendingRequestRef.current;
    if (!currentRequest) {
      return null;
    }

    if (typeof requestId === 'number' && currentRequest.requestId !== requestId) {
      return null;
    }

    const target = currentRequest.target;
    clearFeedFocus(currentRequest.requestId);
    return target;
  }, [clearFeedFocus]);

  const value = useMemo<FeedFocusContextValue>(
    () => ({
      requestFeedFocus,
      peekFeedFocus,
      clearFeedFocus,
      consumeFeedFocus,
      pendingFeedFocusRequest,
    }),
    [clearFeedFocus, consumeFeedFocus, peekFeedFocus, pendingFeedFocusRequest, requestFeedFocus]
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

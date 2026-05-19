import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { SharedPostTypingUser } from '../../services/sharedFeedService';

type SharedPostTypingSubscription = {
  setTyping: (isTyping: boolean) => void;
  unsubscribe: () => void;
};

type SubscribeToSharedPostTyping = (
  postId: string,
  options: {
    onTypingUsers: (users: SharedPostTypingUser[]) => void;
    onError?: (error: unknown) => void;
  }
) => SharedPostTypingSubscription;

type UseSharedPostTypingPresenceOptions = {
  enabled: boolean;
  heartbeatMs: number;
  idleMs: number;
  postId: string;
  subscribeToSharedPostTyping: SubscribeToSharedPostTyping;
};

export function useSharedPostTypingPresence({
  enabled,
  heartbeatMs,
  idleMs,
  postId,
  subscribeToSharedPostTyping,
}: UseSharedPostTypingPresenceOptions) {
  const [typingUsers, setTypingUsers] = useState<SharedPostTypingUser[]>([]);
  const subscriptionRef = useRef<SharedPostTypingSubscription | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const lastPublishAtRef = useRef(0);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const publishTypingState = useCallback(
    (isTyping: boolean, options: { force?: boolean } = {}) => {
      const subscription = subscriptionRef.current;
      if (!subscription) {
        return;
      }

      const now = Date.now();
      const shouldPublish =
        options.force ||
        isTypingRef.current !== isTyping ||
        (isTyping && now - lastPublishAtRef.current > heartbeatMs);
      if (!shouldPublish) {
        return;
      }

      isTypingRef.current = isTyping;
      lastPublishAtRef.current = now;
      subscription.setTyping(isTyping);
    },
    [heartbeatMs]
  );

  const handleDraftChange = useCallback(
    (nextDraft: string, setDraft: (value: string) => void) => {
      setDraft(nextDraft);
      clearIdleTimer();

      if (!nextDraft.trim()) {
        publishTypingState(false, { force: true });
        return;
      }

      publishTypingState(true);
      idleTimerRef.current = setTimeout(() => {
        publishTypingState(false, { force: true });
      }, idleMs);
    },
    [clearIdleTimer, idleMs, publishTypingState]
  );

  useEffect(() => {
    if (!enabled) {
      setTypingUsers([]);
      return;
    }

    const subscription = subscribeToSharedPostTyping(postId, {
      onTypingUsers: setTypingUsers,
      onError: () => undefined,
    });
    subscriptionRef.current = subscription;
    isTypingRef.current = false;
    lastPublishAtRef.current = 0;

    return () => {
      clearIdleTimer();
      subscription.setTyping(false);
      subscription.unsubscribe();
      subscriptionRef.current = null;
      isTypingRef.current = false;
      lastPublishAtRef.current = 0;
      setTypingUsers([]);
    };
  }, [clearIdleTimer, enabled, postId, subscribeToSharedPostTyping]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        clearIdleTimer();
        publishTypingState(false, { force: true });
      }
    });

    return () => subscription.remove();
  }, [clearIdleTimer, publishTypingState]);

  return {
    clearTypingIdleTimer: clearIdleTimer,
    handleDraftChange,
    publishTypingState,
    typingUsers,
  };
}

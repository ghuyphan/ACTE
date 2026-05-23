import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';

const DEFAULT_UPDATE_CHECK_COOLDOWN_MS = 30 * 60 * 1000;

type UpdateCheckReason = 'startup' | 'foreground';

type UseAppUpdatePromptOptions = {
  enabled?: boolean;
  foregroundCheckCooldownMs?: number;
};

export function canCheckForAppUpdate() {
  return Updates.isEnabled;
}

export function useAppUpdatePrompt({
  enabled = true,
  foregroundCheckCooldownMs = DEFAULT_UPDATE_CHECK_COOLDOWN_MS,
}: UseAppUpdatePromptOptions = {}) {
  const { isUpdatePending } = Updates.useUpdates();
  const [isUpdateReady, setIsUpdateReady] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const isCheckingRef = useRef(false);
  const isMountedRef = useRef(true);
  const lastCheckAtRef = useRef(0);
  const dismissedReadyUpdateRef = useRef(false);

  const checkForUpdate = useCallback(
    async (reason: UpdateCheckReason) => {
      if (!enabled || !canCheckForAppUpdate() || isCheckingRef.current || isUpdateReady) {
        return;
      }

      if (dismissedReadyUpdateRef.current) {
        return;
      }

      const now = Date.now();
      if (reason === 'foreground' && now - lastCheckAtRef.current < foregroundCheckCooldownMs) {
        return;
      }

      isCheckingRef.current = true;
      lastCheckAtRef.current = now;

      try {
        const update = await Updates.checkForUpdateAsync();
        if (!update.isAvailable) {
          return;
        }

        const fetchResult = await Updates.fetchUpdateAsync();
        if (!isMountedRef.current || !fetchResult.isNew) {
          return;
        }

        setIsUpdateReady(true);
      } catch (error) {
        console.warn('App update check failed:', error);
      } finally {
        isCheckingRef.current = false;
      }
    },
    [enabled, foregroundCheckCooldownMs, isUpdateReady]
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (canCheckForAppUpdate() && isUpdatePending && !dismissedReadyUpdateRef.current) {
      setIsUpdateReady(true);
      return;
    }

    void checkForUpdate('startup');

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void checkForUpdate('foreground');
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkForUpdate, enabled, isUpdatePending]);

  const dismissUpdate = useCallback(() => {
    dismissedReadyUpdateRef.current = true;
    setIsUpdateReady(false);
  }, []);

  const restartForUpdate = useCallback(async () => {
    if (isRestarting) {
      return;
    }

    setIsRestarting(true);

    try {
      await Updates.reloadAsync();
    } catch (error) {
      console.warn('App update reload failed:', error);
      if (isMountedRef.current) {
        setIsRestarting(false);
      }
    }
  }, [isRestarting]);

  return {
    dismissUpdate,
    isRestarting,
    isUpdateReady,
    restartForUpdate,
  };
}

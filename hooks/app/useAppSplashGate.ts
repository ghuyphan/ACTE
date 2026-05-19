import { SplashScreen } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { hasInitializedI18n, i18nReady } from '../../constants/i18n';
import { logStartupEvent } from '../../utils/startupTrace';

interface UseAppSplashGateOptions {
  authReady: boolean;
  homeInitialFeedReady?: boolean;
  isDatabaseReady: boolean;
  isStartupRouteReady: boolean;
  notesReady: boolean;
  startupError: string | null;
  themeReady: boolean;
}

export function useAppSplashGate({
  authReady,
  homeInitialFeedReady = true,
  isDatabaseReady,
  isStartupRouteReady,
  notesReady,
  startupError,
  themeReady,
}: UseAppSplashGateOptions) {
  const [i18nInitialized, setI18nInitialized] = useState(() => hasInitializedI18n());
  const hasHiddenSplashRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    void i18nReady
      .then(() => {
        if (!cancelled) {
          setI18nInitialized(true);
        }
      })
      .catch((error) => {
        console.error('i18n init failed:', error);
        if (!cancelled) {
          setI18nInitialized(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const startupGateReady =
    authReady &&
    themeReady &&
    i18nInitialized &&
    isStartupRouteReady &&
    (
      Boolean(startupError) ||
      (
        isDatabaseReady &&
        homeInitialFeedReady &&
        notesReady
      )
    );

  useEffect(() => {
    if (!startupGateReady || hasHiddenSplashRef.current) {
      return;
    }

    hasHiddenSplashRef.current = true;
    logStartupEvent('splash.hide:scheduled', {
      authReady,
      homeInitialFeedReady,
      isDatabaseReady,
      isStartupRouteReady,
      notesReady,
      themeReady,
    });
    let cancelled = false;

    const animationFrame = requestAnimationFrame(() => {
      if (!cancelled) {
        void SplashScreen.hideAsync()
          .then(() => {
            logStartupEvent('splash.hide:done');
          })
          .catch((error) => {
            logStartupEvent('splash.hide:failed', { error });
          });
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
    };
  }, [
    authReady,
    homeInitialFeedReady,
    isDatabaseReady,
    isStartupRouteReady,
    notesReady,
    startupGateReady,
    themeReady,
  ]);

  return {
    i18nInitialized,
    startupGateReady,
  };
}

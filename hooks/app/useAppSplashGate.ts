import { SplashScreen } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { hasInitializedI18n, i18nReady } from '../../constants/i18n';

interface UseAppSplashGateOptions {
  isDatabaseReady: boolean;
  isStartupRouteReady: boolean;
  notesReady: boolean;
  startupError: string | null;
  themeReady: boolean;
}

export function useAppSplashGate({
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
    themeReady &&
    i18nInitialized &&
    isStartupRouteReady &&
    (Boolean(startupError) || (isDatabaseReady && notesReady));

  useEffect(() => {
    if (!startupGateReady || hasHiddenSplashRef.current) {
      return;
    }

    hasHiddenSplashRef.current = true;
    let cancelled = false;

    requestAnimationFrame(() => {
      if (!cancelled) {
        void SplashScreen.hideAsync();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [startupGateReady]);

  return {
    i18nInitialized,
    startupGateReady,
  };
}

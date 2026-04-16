import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import i18n from '../../constants/i18n';
import { scheduleWidgetDataUpdate } from '../../services/widgetService';
import { useAuth } from '../useAuth';
import { useConnectivity } from '../useConnectivity';

export function useAppWidgetRefresh(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled ?? true;
  const { user } = useAuth();
  const { isOnline } = useConnectivity();
  const hasTriggeredStartupRef = useRef(false);
  const previousRefreshStateRef = useRef<{
    userUid: string | null;
    isOnline: boolean;
    language: string;
  } | null>(null);
  const currentLanguage = i18n.language;

  const refreshWidgetData = useCallback((reason: 'startup' | 'foreground' | 'session' | 'content') => {
    if (!enabled) {
      return;
    }

    const isSharedRefreshEligible = Boolean(user && isOnline);
    scheduleWidgetDataUpdate(
      {
        includeLocationLookup: reason === 'foreground',
        includeSharedRefresh: isSharedRefreshEligible,
      },
      {
        debounceMs: 120,
        throttleKey: reason === 'foreground' ? 'foreground' : undefined,
        throttleMs: reason === 'foreground' ? 60_000 : undefined,
      }
    );
  }, [enabled, isOnline, user]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }

      refreshWidgetData('foreground');
    });

    return () => {
      subscription.remove();
    };
  }, [enabled, refreshWidgetData]);

  useEffect(() => {
    if (!enabled || hasTriggeredStartupRef.current) {
      return;
    }

    hasTriggeredStartupRef.current = true;
    refreshWidgetData('startup');
  }, [enabled, refreshWidgetData]);

  useEffect(() => {
    const nextState = {
      userUid: user?.uid ?? null,
      isOnline,
      language: currentLanguage,
    };
    const previousState = previousRefreshStateRef.current;
    previousRefreshStateRef.current = nextState;

    if (!enabled || !hasTriggeredStartupRef.current || !previousState) {
      return;
    }

    if (previousState.userUid !== nextState.userUid) {
      refreshWidgetData('session');
      return;
    }

    if (!previousState.isOnline && nextState.isOnline) {
      refreshWidgetData('session');
      return;
    }

    if (previousState.language !== nextState.language) {
      refreshWidgetData('content');
    }
  }, [currentLanguage, enabled, isOnline, refreshWidgetData, user?.uid]);
}

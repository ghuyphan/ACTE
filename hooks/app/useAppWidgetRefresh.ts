import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { updateWidgetData } from '../../services/widgetService';
import { useAuth } from '../useAuth';
import { useConnectivity } from '../useConnectivity';

export function useAppWidgetRefresh() {
  const { user } = useAuth();
  const { isOnline } = useConnectivity();
  const scheduledRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastForegroundRefreshAtRef = useRef(0);

  const refreshWidgetData = useCallback((reason: 'startup' | 'foreground') => {
    if (scheduledRefreshRef.current) {
      clearTimeout(scheduledRefreshRef.current);
    }

    scheduledRefreshRef.current = setTimeout(() => {
      scheduledRefreshRef.current = null;

      const now = Date.now();
      if (reason === 'foreground' && now - lastForegroundRefreshAtRef.current < 60_000) {
        return;
      }

      if (reason === 'foreground') {
        lastForegroundRefreshAtRef.current = now;
      }

      updateWidgetData({
        includeLocationLookup: reason === 'foreground',
        includeSharedRefresh: reason === 'foreground' && Boolean(user && isOnline),
      }).catch((err) => console.warn('Widget data update failed:', err));
    }, 120);
  }, [isOnline, user]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }

      refreshWidgetData('foreground');
    });

    return () => {
      subscription.remove();
    };
  }, [refreshWidgetData]);

  useEffect(() => {
    refreshWidgetData('startup');
    // Startup should be a single lightweight refresh, not a dependency-driven trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (scheduledRefreshRef.current) {
        clearTimeout(scheduledRefreshRef.current);
      }
    };
  }, []);
}

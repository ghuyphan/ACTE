import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { updateWidgetData } from '../../services/widgetService';
import { useAuth } from '../useAuth';
import { useConnectivity } from '../useConnectivity';

export function useAppWidgetRefresh() {
  const { user } = useAuth();
  const { isOnline } = useConnectivity();
  const scheduledRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshWidgetData = useCallback(() => {
    if (scheduledRefreshRef.current) {
      clearTimeout(scheduledRefreshRef.current);
    }

    scheduledRefreshRef.current = setTimeout(() => {
      scheduledRefreshRef.current = null;
      updateWidgetData({
        includeLocationLookup: true,
        includeSharedRefresh: Boolean(user && isOnline),
      }).catch((err) => console.warn('Widget data update failed:', err));
    }, 120);
  }, [isOnline, user]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }

      refreshWidgetData();
    });

    return () => {
      subscription.remove();
    };
  }, [refreshWidgetData]);

  useEffect(() => {
    refreshWidgetData();
  }, [refreshWidgetData]);

  useEffect(() => {
    return () => {
      if (scheduledRefreshRef.current) {
        clearTimeout(scheduledRefreshRef.current);
      }
    };
  }, []);
}

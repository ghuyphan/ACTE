import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { scheduleWidgetDataUpdate } from '../../services/widgetService';
import { useAuth } from '../useAuth';
import { useConnectivity } from '../useConnectivity';

export function useAppWidgetRefresh() {
  const { user } = useAuth();
  const { isOnline } = useConnectivity();

  const refreshWidgetData = useCallback((reason: 'startup' | 'foreground') => {
    scheduleWidgetDataUpdate(
      {
        includeLocationLookup: reason === 'foreground',
        includeSharedRefresh: reason === 'foreground' && Boolean(user && isOnline),
      },
      {
        debounceMs: 120,
        throttleKey: reason === 'foreground' ? 'foreground' : undefined,
        throttleMs: reason === 'foreground' ? 60_000 : undefined,
      }
    );
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
}

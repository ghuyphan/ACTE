import { useEffect } from 'react';
import { AppState } from 'react-native';
import { updateWidgetData } from '../../services/widgetService';
import { useAuth } from '../useAuth';
import { useConnectivity } from '../useConnectivity';

export function useAppWidgetRefresh() {
  const { user } = useAuth();
  const { isOnline } = useConnectivity();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }

      updateWidgetData({
        includeLocationLookup: true,
        includeSharedRefresh: Boolean(user && isOnline),
      }).catch((err) => console.warn('Widget background update failed:', err));
    });

    return () => {
      subscription.remove();
    };
  }, [isOnline, user]);

  useEffect(() => {
    updateWidgetData({
      includeLocationLookup: true,
      includeSharedRefresh: Boolean(user && isOnline),
    }).catch((err) => console.warn('Widget data update failed:', err));
  }, [isOnline, user]);
}

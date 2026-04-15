import { useEffect } from 'react';
import { AppState } from 'react-native';
import { syncSocialPushRegistration } from '../../services/socialPushService';
import { useAuth } from '../useAuth';
import { useConnectivity } from '../useConnectivity';

export function useSocialPushRegistration() {
  const { user } = useAuth();
  const { isOnline } = useConnectivity();

  useEffect(() => {
    if (!user || !isOnline) {
      return;
    }

    syncSocialPushRegistration(user).catch((error) => {
      console.warn('[social-push] Registration failed:', error);
    });
  }, [isOnline, user]);

  useEffect(() => {
    if (!user || !isOnline) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }

      syncSocialPushRegistration(user).catch((error) => {
        console.warn('[social-push] Registration refresh failed on foreground:', error);
      });
    });

    return () => {
      subscription.remove();
    };
  }, [isOnline, user]);
}

import { useEffect } from 'react';
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
}

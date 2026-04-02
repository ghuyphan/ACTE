import { useEffect } from 'react';
import { syncSocialPushRegistration } from '../../services/socialPushService';
import { useAuth } from '../useAuth';

export function useSocialPushRegistration() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      return;
    }

    syncSocialPushRegistration(user).catch((error) => {
      console.warn('[social-push] Registration failed:', error);
    });
  }, [user]);
}

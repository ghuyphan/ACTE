import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Linking } from 'react-native';
import { useAuth } from './useAuth';
import { useConnectivity } from './useConnectivity';
import {
  getSocialPushPermissionState,
  type SocialPushPermissionState,
  requestSocialPushPermission,
  syncSocialPushRegistration,
} from '../services/socialPushService';

const DEFAULT_PERMISSION_STATE: SocialPushPermissionState = {
  canAskAgain: false,
  isGranted: false,
  status: 'skipped',
};

export function useSocialPushPermission() {
  const { user } = useAuth();
  const { isOnline } = useConnectivity();
  const [permissionState, setPermissionState] = useState<SocialPushPermissionState>(
    DEFAULT_PERMISSION_STATE
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshPermissionState = useCallback(async () => {
    const nextPermissionState = await getSocialPushPermissionState();

    if (isMountedRef.current) {
      setPermissionState(nextPermissionState);
      setIsLoading(false);
    }

    return nextPermissionState;
  }, []);

  useEffect(() => {
    void refreshPermissionState().catch(() => {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    });
  }, [refreshPermissionState]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState !== 'active') {
        return;
      }

      void refreshPermissionState().catch(() => undefined);
    });

    return () => {
      subscription.remove();
    };
  }, [refreshPermissionState]);

  const enableFromPrompt = useCallback(async () => {
    setIsUpdating(true);

    try {
      const currentPermissionState = await refreshPermissionState();

      if (currentPermissionState.status === 'blocked') {
        await Linking.openSettings().catch(() => undefined);
        return currentPermissionState;
      }

      await requestSocialPushPermission();
      const nextPermissionState = await refreshPermissionState();

      if (nextPermissionState.status === 'granted' && user && isOnline) {
        await syncSocialPushRegistration(user).catch((error) => {
          console.warn('[social-push] Registration refresh failed after permission prompt:', error);
        });
      }

      if (isMountedRef.current) {
        setPermissionState(nextPermissionState);
      }

      return nextPermissionState;
    } finally {
      if (isMountedRef.current) {
        setIsUpdating(false);
      }
    }
  }, [isOnline, refreshPermissionState, user]);

  const openSystemSettings = useCallback(async () => {
    await Linking.openSettings().catch(() => undefined);
  }, []);

  return {
    canAskAgain: permissionState.canAskAgain,
    enableFromPrompt,
    isEnabled: permissionState.isGranted,
    isLoading,
    isUpdating,
    openSystemSettings,
    refreshPermissionState,
    status: permissionState.status,
  };
}

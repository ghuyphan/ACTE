import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { useFriendInviteJoin } from '../../hooks/useFriendInviteJoin';
import { syncSocialPushRegistration } from '../../services/socialPushService';
import { showAppAlert } from '../../utils/alert';

type UseSharedManageSheetModelOptions = {
  visible: boolean;
  onClose: () => void;
};

export function useSharedManageSheetModel({
  visible,
  onClose,
}: UseSharedManageSheetModelOptions) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, isAuthAvailable } = useAuth();
  const [mode, setMode] = useState<'manage' | 'join'>('manage');
  const [inviteValue, setInviteValue] = useState('');
  const socialPushPromptedUserIdRef = useRef<string | null>(null);

  const resetViewState = useCallback(() => {
    setInviteValue('');
    setMode('manage');
  }, []);

  const handleOpenJoin = useCallback(() => {
    setMode('join');
  }, []);

  const handleGoToAuth = useCallback(() => {
    onClose();
    resetViewState();
    setTimeout(() => {
      router.push('/auth');
    }, 180);
  }, [onClose, resetViewState, router]);

  const { joining, joinInvite, resetJoinState } = useFriendInviteJoin({
    inviteValue,
    onRequireAuth: handleGoToAuth,
    onBeforeSuccessAlert: resetViewState,
  });

  const handleBackToManage = useCallback(() => {
    if (joining) {
      return;
    }

    resetViewState();
  }, [joining, resetViewState]);

  useEffect(() => {
    if (!visible) {
      resetViewState();
      resetJoinState();
    }
  }, [resetJoinState, resetViewState, visible]);

  useEffect(() => {
    if (!visible || !user) {
      return;
    }

    if (socialPushPromptedUserIdRef.current === user.uid) {
      return;
    }

    socialPushPromptedUserIdRef.current = user.uid;
    void syncSocialPushRegistration(user, { requestPermission: true })
      .then((status) => {
        if (status !== 'blocked') {
          return;
        }

        showAppAlert(
          t('shared.pushBlockedTitle', 'Turn on friend activity notifications'),
          t(
            'shared.pushBlockedBody',
            'Notifications are off for Noto. Open Settings if you want alerts when friends accept invites or share memories.'
          ),
          [
            {
              text: t('common.notNow', 'Not now'),
              style: 'cancel',
            },
            {
              text: t('common.openSettings', 'Open Settings'),
              onPress: () => {
                void Linking.openSettings().catch(() => undefined);
              },
            },
          ]
        );
      })
      .catch((error) => {
        console.warn('[social-push] Registration prompt failed:', error);
      });
  }, [t, user, visible]);

  return {
    handleBackToManage,
    handleGoToAuth,
    handleOpenJoin,
    inviteValue,
    isAuthAvailable,
    joinInvite,
    joining,
    mode,
    setInviteValue,
    user,
  };
}

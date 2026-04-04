import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { showAppAlert } from '../utils/alert';
import { useAuth } from './useAuth';
import { useSharedFeedStore } from './useSharedFeed';
import { getSharedFeedErrorMessage } from '../services/sharedFeedService';

type UseFriendInviteJoinOptions = {
  inviteValue: string;
  onRequireAuth: () => void;
  onBeforeSuccessAlert?: (inviteValue: string) => void;
  onJoined?: (inviteValue: string) => void;
};

export function useFriendInviteJoin({
  inviteValue,
  onRequireAuth,
  onBeforeSuccessAlert,
  onJoined,
}: UseFriendInviteJoinOptions) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { acceptFriendInvite } = useSharedFeedStore();
  const [joining, setJoining] = useState(false);

  const performJoin = useCallback(
    async (normalizedValue: string) => {
      setJoining(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        await acceptFriendInvite(normalizedValue);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onBeforeSuccessAlert?.(normalizedValue);
        showAppAlert(
          t('shared.joinSuccessTitle', "You're connected"),
          t('shared.joinSuccessBody', 'You can now share notes with this friend from Home.')
        );
        onJoined?.(normalizedValue);
        return true;
      } catch (error) {
        showAppAlert(t('shared.joinFailedTitle', 'Could not join'), getSharedFeedErrorMessage(error));
        return false;
      } finally {
        setJoining(false);
      }
    },
    [acceptFriendInvite, onBeforeSuccessAlert, onJoined, t]
  );

  const resetJoinState = useCallback(() => {
    setJoining(false);
  }, []);

  const joinInvite = useCallback(
    async (value = inviteValue) => {
      const normalizedValue = value.trim();

      if (!normalizedValue) {
        showAppAlert(
          t('shared.joinErrorTitle', 'Invite needed'),
          t('shared.joinErrorBody', 'Paste a valid invite link to connect.')
        );
        return false;
      }

      if (!user) {
        onRequireAuth();
        return false;
      }

      return new Promise<boolean>((resolve) => {
        showAppAlert(
          t('shared.joinConfirmTitle', 'Accept this friend invite?'),
          t(
            'shared.joinConfirmBody',
            'If you continue, this person will be added to your shared Home feed.'
          ),
          [
            {
              text: t('common.cancel', 'Cancel'),
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: t('shared.joinConfirmButton', 'Accept invite'),
              onPress: () => {
                void performJoin(normalizedValue).then(resolve);
              },
            },
          ]
        );
      });
    },
    [inviteValue, onRequireAuth, performJoin, t, user]
  );

  return {
    joining,
    joinInvite,
    resetJoinState,
  };
}

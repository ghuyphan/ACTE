import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
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

  const resetJoinState = useCallback(() => {
    setJoining(false);
  }, []);

  const joinInvite = useCallback(
    async (value = inviteValue) => {
      const normalizedValue = value.trim();

      if (!normalizedValue) {
        Alert.alert(
          t('shared.joinErrorTitle', 'Invite needed'),
          t('shared.joinErrorBody', 'Paste a valid invite link to connect.')
        );
        return false;
      }

      if (!user) {
        onRequireAuth();
        return false;
      }

      setJoining(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        await acceptFriendInvite(normalizedValue);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onBeforeSuccessAlert?.(normalizedValue);
        Alert.alert(
          t('shared.joinSuccessTitle', "You're connected"),
          t('shared.joinSuccessBody', 'You can now share notes with this friend from Home.')
        );
        onJoined?.(normalizedValue);
        return true;
      } catch (error) {
        Alert.alert(t('shared.joinFailedTitle', 'Could not join'), getSharedFeedErrorMessage(error));
        return false;
      } finally {
        setJoining(false);
      }
    },
    [acceptFriendInvite, inviteValue, onBeforeSuccessAlert, onJoined, onRequireAuth, t, user]
  );

  return {
    joining,
    joinInvite,
    resetJoinState,
  };
}

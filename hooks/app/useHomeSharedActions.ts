import * as Haptics from '../useHaptics';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Share } from 'react-native';
import { buildPublicSiteUrl } from '../../services/legalLinks';
import { getSharedFeedErrorMessage, type FriendInvite } from '../../services/sharedFeedService';
import { showAppAlert } from '../../utils/alert';
import type { AppUser } from '../../utils/appUser';

const SHARED_MANAGE_SHEET_SHARE_DELAY_MS = Platform.OS === 'ios' ? 220 : 0;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPublicInviteUrl(url: string) {
  return /^https?:\/\//i.test(url.trim());
}

function getFriendInviteShareUrl(invite: FriendInvite) {
  const normalizedUrl = invite.url.trim();
  if (isPublicInviteUrl(normalizedUrl)) {
    return normalizedUrl;
  }

  const rebuiltUrl = buildPublicSiteUrl('/friends/join/', {
    inviteId: invite.id,
    invite: invite.token,
  }).trim();

  return rebuiltUrl;
}

export function buildFriendInviteSharePayload(
  invite: FriendInvite,
  t: (...args: any[]) => unknown,
) {
  const shareUrl = getFriendInviteShareUrl(invite);

  if (!isPublicInviteUrl(shareUrl)) {
    return {
      message: String(
        t('shared.inviteShareCodeMessage', 'Join me on Noto.\nInvite code: {{code}}', {
          code: invite.token,
        })
      ),
    };
  }

  return {
    message: String(
      t('shared.inviteShareMessage', 'Join me on Noto.\n{{url}}', {
        url: shareUrl,
      })
    ),
    url: shareUrl,
  };
}

type InviteAction = 'create' | 'share' | 'revoke';

type UseHomeSharedActionsOptions = {
  user: AppUser | null;
  sharedEnabled: boolean;
  isAuthAvailable: boolean;
  friendsCount: number;
  activeInvite: FriendInvite | null;
  createFriendInvite: () => Promise<FriendInvite>;
  revokeFriendInvite: (inviteId: string) => Promise<void>;
  removeFriend: (friendUid: string) => Promise<void>;
  dismissSharedManageSheet: () => void;
  presentSharedManageSheet: () => void;
  openAuthForShare: () => void;
  showSharedUnavailableSheet: () => void;
  setCaptureTarget: (nextTarget: 'private' | 'shared') => void;
};

export function useHomeSharedActions({
  user,
  sharedEnabled,
  isAuthAvailable,
  friendsCount,
  activeInvite,
  createFriendInvite,
  revokeFriendInvite,
  removeFriend,
  dismissSharedManageSheet,
  presentSharedManageSheet,
  openAuthForShare,
  showSharedUnavailableSheet,
  setCaptureTarget,
}: UseHomeSharedActionsOptions) {
  const { t } = useTranslation();
  const inviteActionInFlightRef = useRef<InviteAction | null>(null);
  const [inviteActionInFlight, setInviteActionInFlight] = useState<InviteAction | null>(null);

  const handleOpenSharedAuth = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!isAuthAvailable) {
      showSharedUnavailableSheet();
      return;
    }

    openAuthForShare();
  }, [isAuthAvailable, openAuthForShare, showSharedUnavailableSheet]);

  const requireSharedUser = useCallback(() => {
    if (user) {
      return user;
    }

    handleOpenSharedAuth();
    return null;
  }, [handleOpenSharedAuth, user]);

  const resolveInvite = useCallback(async () => {
    return activeInvite ?? (await createFriendInvite());
  }, [activeInvite, createFriendInvite]);

  const handleInviteActionError = useCallback(
    (error: unknown) => {
      showAppAlert(
        t('shared.inviteFailedTitle', 'Could not prepare invite'),
        getSharedFeedErrorMessage(error)
      );
    },
    [t]
  );

  const handleOpenSharedManage = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!sharedEnabled || !isAuthAvailable) {
      showSharedUnavailableSheet();
      return;
    }

    if (!user) {
      openAuthForShare();
      return;
    }

    presentSharedManageSheet();
  }, [
    isAuthAvailable,
    openAuthForShare,
    presentSharedManageSheet,
    sharedEnabled,
    showSharedUnavailableSheet,
    user,
  ]);

  const handleCaptureTargetChange = useCallback(
    (nextTarget: 'private' | 'shared') => {
      if (nextTarget === 'shared') {
        if (!sharedEnabled || !isAuthAvailable) {
          showSharedUnavailableSheet();
          return;
        }

        if (!user) {
          openAuthForShare();
          return;
        }

        if (friendsCount === 0) {
          presentSharedManageSheet();
          return;
        }
      }

      setCaptureTarget(nextTarget);
    },
    [
      friendsCount,
      isAuthAvailable,
      openAuthForShare,
      presentSharedManageSheet,
      setCaptureTarget,
      sharedEnabled,
      showSharedUnavailableSheet,
      user,
    ]
  );

  const handleCreateInvite = useCallback(async () => {
    if (inviteActionInFlightRef.current) {
      return;
    }

    if (!requireSharedUser()) {
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      inviteActionInFlightRef.current = 'create';
      setInviteActionInFlight('create');
      await resolveInvite();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      handleInviteActionError(error);
    } finally {
      inviteActionInFlightRef.current = null;
      setInviteActionInFlight(null);
    }
  }, [handleInviteActionError, requireSharedUser, resolveInvite]);

  const handleShareInvite = useCallback(async () => {
    if (inviteActionInFlightRef.current) {
      return;
    }

    if (!requireSharedUser()) {
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      inviteActionInFlightRef.current = 'share';
      setInviteActionInFlight('share');
      const invite = await resolveInvite();
      dismissSharedManageSheet();
      await wait(SHARED_MANAGE_SHEET_SHARE_DELAY_MS);
      await Share.share(buildFriendInviteSharePayload(invite, t));
    } catch (error) {
      handleInviteActionError(error);
    } finally {
      inviteActionInFlightRef.current = null;
      setInviteActionInFlight(null);
    }
  }, [dismissSharedManageSheet, handleInviteActionError, requireSharedUser, resolveInvite, t]);

  const handleRevokeInvite = useCallback(async () => {
    if (!activeInvite || inviteActionInFlightRef.current) {
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      inviteActionInFlightRef.current = 'revoke';
      setInviteActionInFlight('revoke');
      await revokeFriendInvite(activeInvite.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      handleInviteActionError(error);
    } finally {
      inviteActionInFlightRef.current = null;
      setInviteActionInFlight(null);
    }
  }, [activeInvite, handleInviteActionError, revokeFriendInvite]);

  const handleRemoveFriend = useCallback(
    (friendUid: string) => {
      showAppAlert(
        t('shared.removeFriendTitle', 'Remove friend'),
        t(
          'shared.removeFriendBody',
          'This friend will stop seeing the moments you share from Home.'
        ),
        [
          {
            text: t('common.cancel', 'Cancel'),
            style: 'cancel',
          },
          {
            text: t('shared.removeFriendConfirm', 'Remove'),
            style: 'destructive',
            onPress: () => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              void removeFriend(friendUid)
                .then(() => {
                  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                })
                .catch((error) => {
                  showAppAlert(
                    t('shared.removeFriendTitle', 'Remove friend'),
                    getSharedFeedErrorMessage(error)
                  );
                });
            },
          },
        ]
      );
    },
    [removeFriend, t]
  );

  return {
    handleCaptureTargetChange,
    handleCreateInvite,
    handleOpenSharedAuth,
    handleOpenSharedManage,
    handleRemoveFriend,
    handleRevokeInvite,
    handleShareInvite,
    inviteActionInFlight,
  };
}

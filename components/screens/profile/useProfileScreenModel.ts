import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { showAppAlert } from '../../../utils/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../hooks/useAuth';
import { useNotes } from '../../../hooks/useNotes';
import { useSubscription } from '../../../hooks/useSubscription';
import { useTheme } from '../../../hooks/useTheme';
import { createLegalLinkActions, getLegalLinkAvailability } from '../shared/legalLinkActions';

export function useProfileScreenModel() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { user, isAuthAvailable, deleteAccount, signOut } = useAuth();
  const { refreshNotes } = useNotes();
  const { tier } = useSubscription();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const legalLinkAvailability = useMemo(getLegalLinkAvailability, []);
  const legalLinkActions = useMemo(createLegalLinkActions, []);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const profileName = user?.displayName || user?.email || t('settings.notSignedIn', 'Not signed in');
  const avatarLabel = useMemo(() => {
    const base = user?.displayName || user?.email || 'C';
    return base.trim().charAt(0).toUpperCase();
  }, [user?.displayName, user?.email]);

  const membershipLabel =
    tier === 'plus' ? t('settings.plusTitle', 'Noto Plus') : t('settings.plusInactive', 'Standard');

  const openSignIn = () => {
    router.replace('/auth');
  };

  const performSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    try {
      await signOut();
      await refreshNotes(false).catch(() => undefined);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/settings');
    } catch (error) {
      console.warn('Sign out failed:', error);
      showAppAlert(
        t('profile.logoutFailedTitle', 'Could not log out'),
        t(
          'profile.logoutFailed',
          'We could not finish signing you out right now. Please try again in a moment.'
        )
      );
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleSignOut = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showAppAlert(
      t('profile.logoutConfirmTitle', 'Log out of Noto?'),
      t('profile.logoutConfirmMsg', 'Your notes will remain safely synced. You can sign back in anytime.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('profile.logout', 'Log out'),
          style: 'destructive',
          onPress: performSignOut,
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    if (!user) {
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    showAppAlert(
      t('profile.deleteAccountConfirmTitle', 'Delete your Noto account?'),
      t(
        'profile.deleteAccountConfirmMsg',
        'This permanently deletes your account, cloud sync data, shared posts, invites, and notes stored for this account. This cannot be undone.'
      ),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('profile.deleteAccount', 'Delete account'),
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeletingAccount(true);
              const result = await deleteAccount();

              if (result.status !== 'success') {
                if (legalLinkAvailability.showAccountDeletionLink) {
                  showAppAlert(
                    t('profile.deleteAccountNeedsSupportTitle', 'Need help deleting your account?'),
                    result.message ??
                      t(
                        'profile.deleteAccountNeedsSupportMsg',
                        'This build could not finish the deletion automatically. You can continue from our deletion page or contact support.'
                      ),
                    [
                      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                      {
                        text: t('profile.deleteAccountHelp', 'Open deletion help'),
                        onPress: legalLinkActions.openAccountDeletionHelpLink,
                      },
                    ]
                  );
                } else {
                  showAppAlert(
                    t('profile.deleteAccountFailedTitle', 'Could not delete account'),
                    result.message ??
                      t(
                        'profile.deleteAccountFailed',
                        'We could not delete your account right now. Please try again in a moment.'
                      )
                  );
                }
                return;
              }

              await refreshNotes(false).catch(() => undefined);
              router.replace('/settings');
              showAppAlert(
                t('profile.deleteAccountSuccessTitle', 'Account deleted'),
                t(
                  'profile.deleteAccountSuccessMsg',
                  'Your Noto account and synced data have been deleted from this device and the cloud.'
                )
              );
            } finally {
              setIsDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  return {
    avatarUrl: user?.photoURL ?? null,
    avatarLabel,
    colors,
    insets,
    isAuthAvailable,
    isDark,
    isDeletingAccount,
    isSigningOut,
    membershipLabel,
    openSignIn,
    profileName,
    t,
    tier,
    user,
    handleDeleteAccount,
    handleSignOut,
  };
}

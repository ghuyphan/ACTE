import { useRouter } from 'expo-router';
import * as FileSystem from '../../utils/fileSystem';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { useNotes } from '../../hooks/useNotes';
import { useSubscription } from '../../hooks/useSubscription';
import { useTheme } from '../../hooks/useTheme';
import { deleteAllNotesForScope, getAllNotesForScope } from '../../services/database';
import { clearGeofenceRegions } from '../../services/geofenceService';
import {
  hasAccountDeletionLink,
  hasPrivacyPolicyLink,
  hasSupportLink,
  openAccountDeletionHelp,
  openPrivacyPolicy,
  openSupport,
} from '../../services/legalLinks';
import { getNotePhotoUri } from '../../services/photoStorage';

export function useProfileScreenModel() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { user, isAuthAvailable, deleteAccount, signOut } = useAuth();
  const { refreshNotes } = useNotes();
  const { tier } = useSubscription();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const profileName = user?.displayName || user?.email || t('settings.notSignedIn', 'Not signed in');
  const avatarLabel = useMemo(() => {
    const base = user?.displayName || user?.email || 'C';
    return base.trim().charAt(0).toUpperCase();
  }, [user?.displayName, user?.email]);

  const membershipLabel =
    tier === 'plus' ? t('settings.plusTitle', 'Noto Plus') : t('settings.plusInactive', 'Standard');

  const openPrivacyPolicyLink = () => {
    void openPrivacyPolicy();
  };

  const openSupportLink = () => {
    void openSupport();
  };

  const openAccountDeletionHelpLink = () => {
    void openAccountDeletionHelp();
  };

  const openSignIn = () => {
    router.replace('/auth');
  };

  const performSignOut = async () => {
    setIsSigningOut(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/settings');

    setTimeout(() => {
      signOut().catch((error) => {
        console.warn('Sign out failed asynchronously:', error);
      });
    }, 150);
  };

  const handleSignOut = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
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

    const deletingUserScope = user.uid;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
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
                if (hasAccountDeletionLink()) {
                  Alert.alert(
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
                        onPress: () => {
                          void openAccountDeletionHelp();
                        },
                      },
                    ]
                  );
                } else {
                  Alert.alert(
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

              const scopedNotes = await getAllNotesForScope(deletingUserScope);
              await deleteAllNotesForScope(deletingUserScope);

              for (const note of scopedNotes) {
                const photoUri = getNotePhotoUri(note);
                if (note.type !== 'photo' || !photoUri) {
                  continue;
                }

                try {
                  const fileInfo = await FileSystem.getInfoAsync(photoUri);
                  if (fileInfo.exists) {
                    await FileSystem.deleteAsync(photoUri, { idempotent: true });
                  }
                } catch (error) {
                  console.warn('Failed to delete account photo file:', error);
                }
              }

              await clearGeofenceRegions().catch(() => undefined);
              await refreshNotes(false).catch(() => undefined);
              router.replace('/settings');
              Alert.alert(
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
    openAccountDeletionHelpLink,
    openPrivacyPolicyLink,
    openSignIn,
    openSupportLink,
    profileName,
    showAccountDeletionLink: hasAccountDeletionLink(),
    showPrivacyPolicyLink: hasPrivacyPolicyLink(),
    showSupportLink: hasSupportLink(),
    t,
    tier,
    user,
    handleDeleteAccount,
    handleSignOut,
  };
}

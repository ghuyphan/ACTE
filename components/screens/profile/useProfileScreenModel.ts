import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeUsernameInput, validateUsernameInput } from '../../../services/publicProfileService';
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
  const { user, isAuthAvailable, deleteAccount, signOut, updateUsername } = useAuth();
  const { refreshNotes } = useNotes();
  const { tier } = useSubscription();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const legalLinkAvailability = useMemo(getLegalLinkAvailability, []);
  const legalLinkActions = useMemo(createLegalLinkActions, []);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isUsernameSheetVisible, setIsUsernameSheetVisible] = useState(false);
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [usernameErrorMessage, setUsernameErrorMessage] = useState<string | null>(null);
  const [transitionUser, setTransitionUser] = useState(user);
  const isTransitioningAccount = isSigningOut || isDeletingAccount;

  useEffect(() => {
    if (user) {
      setTransitionUser(user);
      return;
    }

    if (!isTransitioningAccount) {
      setTransitionUser(null);
    }
  }, [isTransitioningAccount, user]);

  const displayUser = user ?? (isTransitioningAccount ? transitionUser : null);
  const canEditUsername = Boolean(displayUser && !displayUser.usernameSetAt);

  useEffect(() => {
    if (!isUsernameSheetVisible) {
      setUsernameDraft(displayUser?.username ?? '');
      setUsernameErrorMessage(null);
    }
  }, [displayUser?.username, isUsernameSheetVisible]);

  const profileName =
    displayUser?.displayName ||
    (displayUser?.username ? `@${displayUser.username}` : null) ||
    displayUser?.email ||
    t('settings.notSignedIn', 'Not signed in');
  const profileSecondaryLabel =
    displayUser?.username ? `@${displayUser.username}` : displayUser?.email || null;
  const avatarLabel = useMemo(() => {
    const base = displayUser?.displayName || displayUser?.username || displayUser?.email || 'C';
    return base.trim().charAt(0).toUpperCase();
  }, [displayUser?.displayName, displayUser?.email, displayUser?.username]);

  const membershipLabel =
    tier === 'plus' ? t('settings.plusTitle', 'Noto Plus') : t('settings.plusInactive', 'Standard');
  const normalizedUsernameDraft = normalizeUsernameInput(usernameDraft);
  const usernameValidationCode = validateUsernameInput(usernameDraft);
  const inlineUsernameValidationMessage =
    usernameValidationCode === 'required'
      ? t('profile.usernameRequired', 'Enter a username.')
      : usernameValidationCode === 'too_long'
        ? t('profile.usernameTooLong', 'Use 20 characters or fewer.')
        : usernameValidationCode === 'invalid'
          ? t(
              'profile.usernameInvalid',
              'Use only lowercase letters, numbers, periods, or underscores.'
            )
          : null;
  const canSubmitUsername =
    Boolean(canEditUsername) &&
    !isSavingUsername &&
    !inlineUsernameValidationMessage &&
    normalizedUsernameDraft.length > 0 &&
    normalizedUsernameDraft !== (displayUser?.username ?? '');

  const openSignIn = () => {
    router.replace({
      pathname: '/auth',
      params: {
        returnTo: '/auth/profile',
      },
    });
  };

  const openUsernameEditor = () => {
    if (!canEditUsername) {
      return;
    }

    setUsernameDraft(displayUser?.username ?? '');
    setUsernameErrorMessage(null);
    setIsUsernameSheetVisible(true);
  };

  const closeUsernameEditor = () => {
    if (isSavingUsername) {
      return;
    }

    setIsUsernameSheetVisible(false);
    setUsernameErrorMessage(null);
    setUsernameDraft(displayUser?.username ?? '');
  };

  const saveUsername = async () => {
    if (!canEditUsername || !canSubmitUsername) {
      if (inlineUsernameValidationMessage) {
        setUsernameErrorMessage(inlineUsernameValidationMessage);
      }
      return;
    }

    setIsSavingUsername(true);
    setUsernameErrorMessage(null);

    try {
      const result = await updateUsername(normalizedUsernameDraft);
      if (result.status !== 'success') {
        setUsernameErrorMessage(
          result.message ?? t('profile.usernameSaveFailed', 'We could not update your username right now.')
        );
        return;
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsUsernameSheetVisible(false);
    } finally {
      setIsSavingUsername(false);
    }
  };

  const performSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    setTransitionUser(user);
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
              setTransitionUser(user);
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
    avatarUrl: displayUser?.photoURL ?? null,
    avatarLabel,
    canEditUsername,
    colors,
    closeUsernameEditor,
    insets,
    isAuthAvailable,
    isDark,
    isDeletingAccount,
    isSigningOut,
    isSavingUsername,
    isUsernameSheetVisible,
    membershipLabel,
    openSignIn,
    openUsernameEditor,
    profileName,
    profileSecondaryLabel,
    t,
    tier,
    usernameDraft,
    usernameErrorMessage: usernameErrorMessage ?? inlineUsernameValidationMessage,
    usernameHelperText: canEditUsername
      ? t('profile.usernameHint', 'Choose carefully. You can change your username once.')
      : t('profile.usernameLockedHint', 'Your username has already been set.'),
    setUsernameDraft,
    saveUsername,
    user: displayUser,
    handleDeleteAccount,
    handleSignOut,
  };
}

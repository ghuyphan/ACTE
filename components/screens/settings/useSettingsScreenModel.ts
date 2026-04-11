import Constants from 'expo-constants';
import { Href, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSheetAlert } from '../../../hooks/useAppSheetAlert';
import { useAuth } from '../../../hooks/useAuth';
import { useConnectivity } from '../../../hooks/useConnectivity';
import { useNotes } from '../../../hooks/useNotes';
import { useSharedFeedStore } from '../../../hooks/useSharedFeed';
import { useSubscription } from '../../../hooks/useSubscription';
import { useSyncStatus } from '../../../hooks/useSyncStatus';
import { useTheme } from '../../../hooks/useTheme';
import { createLegalLinkActions, getLegalLinkAvailability } from '../shared/legalLinkActions';
import { getThemeLabel } from '../../settings/settingsSelectionOptions';

export function useSettingsScreenModel() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme, colors, isDark } = useTheme();
  const { isOnline } = useConnectivity();
  const { notes, deleteAllNotes } = useNotes();
  const { deleteSharedNotes } = useSharedFeedStore();
  const { user, isAuthAvailable } = useAuth();
  const {
    status: syncStatus,
    lastSyncedAt,
    lastMessage,
    pendingCount,
    failedCount,
    blockedCount,
    isEnabled: syncEnabled,
    setSyncEnabled,
  } = useSyncStatus();
  const { tier, isPurchaseAvailable, plusPriceLabel, photoNoteLimit } = useSubscription();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { alertProps, showAlert } = useAppSheetAlert();
  const appVersion = Constants.expoConfig?.version?.trim() || '1.0.0';
  const legalLinkAvailability = useMemo(getLegalLinkAvailability, []);
  const legalLinkActions = useMemo(createLegalLinkActions, []);

  const [showTheme, setShowTheme] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const authProfileRoute = '/auth/profile' as Href;

  const openAccountScreen = useCallback(() => {
    if (!isAuthAvailable) {
      return;
    }

    if (user) {
      router.push(authProfileRoute);
      return;
    }

    router.push({
      pathname: '/auth',
      params: {
        returnTo: authProfileRoute,
      },
    } as Href);
  }, [authProfileRoute, isAuthAvailable, router, user]);

  const openPlusScreen = () => {
    router.push('/plus');
  };

  const openSyncScreen = useCallback(() => {
    if (!isAuthAvailable) {
      return;
    }

    if (!user) {
      openAccountScreen();
      return;
    }

    setShowSync(true);
  }, [isAuthAvailable, openAccountScreen, user]);

  const themeLabel = getThemeLabel(theme, t);

  const accountValue = useMemo(() => {
    if (user) {
      return user.displayName || (user.username ? `@${user.username}` : null) || user.email || t('settings.signedIn', 'Signed in');
    }
    if (!isAuthAvailable) {
      return t('settings.unavailableShort', 'Unavailable');
    }
    return t('settings.notSignedIn', 'Not signed in');
  }, [isAuthAvailable, t, user]);

  const syncValue = useMemo(() => {
    if (!isAuthAvailable) {
      return t('settings.unavailableShort', 'Unavailable');
    }

    if (!user) {
      return t('settings.notSignedIn', 'Not signed in');
    }

    if (!syncEnabled) {
      return t('settings.autoSyncOff', 'Off');
    }

    if (syncStatus === 'syncing') {
      return t('settings.autoSyncingShort', 'Syncing');
    }

    if (!isOnline && pendingCount > 0) {
      return t('settings.syncPendingShort', 'Pending');
    }

    return t('settings.autoSyncOnShort', 'On');
  }, [isAuthAvailable, isOnline, pendingCount, syncEnabled, syncStatus, t, user]);

  const plusValue = useMemo(() => {
    if (tier === 'plus') {
      return t('settings.plusActive', 'Active');
    }

    return plusPriceLabel ?? t('settings.plusInactive', 'Free');
  }, [plusPriceLabel, t, tier]);

  const plusHint = useMemo(() => {
    if (tier === 'plus') {
      return t(
        'settings.plusActiveHint',
        'Noto Plus is active. Unlimited photo notes, premium photo filters, interactive hologram cards, and premium finishes are unlocked.'
      );
    }

    if (photoNoteLimit === null) {
      return t(
        'settings.plusHint',
        'Upgrade to Noto Plus to unlock unlimited photo notes, premium photo filters, interactive hologram cards, and premium finishes.'
      );
    }

    return t(
      'settings.plusHintWithLimit',
      'Free plan includes up to {{count}} photo notes. Upgrade to Noto Plus for unlimited photo notes, premium photo filters, interactive hologram cards, and premium finishes.',
      { count: photoNoteLimit }
    );
  }, [photoNoteLimit, t, tier]);

  const accountHint = useMemo(() => {
    if (!isAuthAvailable) {
      return t(
        'settings.accountUnavailableMsg',
        'Account sign-in is unavailable right now. Your notes stay safely on this device.'
      );
    }

    if (!user) {
      return t(
        'settings.accountSignedOutMsg',
        'Sign in to back up your notes and keep them synced across your devices.'
      );
    }

    if (!syncEnabled) {
      return null;
    }

    if (!isOnline && pendingCount > 0) {
      return t('settings.syncPendingOffline', 'Your notes are saved locally and will sync when you are back online.');
    }

    if (syncStatus === 'syncing') {
      return t('settings.autoSyncing', 'Syncing your notes now.');
    }

    if (syncStatus === 'success' && lastSyncedAt) {
      return t('settings.lastSynced', 'Last synced {{date}}', {
        date: new Date(lastSyncedAt).toLocaleString(i18n.language, {
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit',
        }),
      });
    }

    if (syncStatus === 'error') {
      return (
        lastMessage ??
        t(
          'settings.autoSyncRetry',
          'We could not sync right now. We will try again when the app is active.'
        )
      );
    }

    if (blockedCount > 0) {
      return t(
        'settings.syncBlockedDetail',
        'Some notes need your attention before they can finish syncing.'
      );
    }

    if (failedCount > 0) {
      return t('settings.syncRetryQueued', 'Some notes are queued to retry syncing automatically.');
    }

    return t('settings.autoSyncOnDetail', 'Your notes sync automatically while you are signed in.');
  }, [blockedCount, failedCount, i18n.language, isAuthAvailable, isOnline, lastMessage, lastSyncedAt, pendingCount, syncEnabled, syncStatus, t, user]);

  const promptClearAll = () => {
    showAlert({
      variant: 'error',
      title: t('settings.clearAllTitle', 'Clear All Notes'),
      message: t(
        'settings.clearAllMsg',
        'All your food notes will be permanently deleted. This action cannot be undone.'
      ),
      primaryAction: {
        label: t('common.delete', 'Delete'),
        variant: 'destructive',
        onPress: async () => {
          const noteIdsToDelete = notes.map((note) => note.id);
          await deleteAllNotes();

          if (user && isOnline && noteIdsToDelete.length > 0) {
            try {
              await deleteSharedNotes(noteIdsToDelete);
            } catch (error) {
              console.error('Shared bulk delete failed:', error);
              showAlert({
                variant: 'error',
                title: t('settings.clearAllWarningTitle', 'Deleted locally'),
                message: t(
                  'settings.clearAllWarningMsg',
                  'Your notes were removed from this device, but some shared posts could not be removed yet.'
                ),
                primaryAction: {
                  label: t('common.done', 'Done'),
                },
              });
            }
          }
        },
      },
      secondaryAction: {
        label: t('common.cancel', 'Cancel'),
        variant: 'secondary',
      },
    });
  };

  return {
    ...legalLinkActions,
    ...legalLinkAvailability,
    accountHint,
    accountValue,
    appVersion,
    alertProps,
    colors,
    i18n,
    insets,
    isAuthAvailable,
    isDark,
    isPurchaseAvailable,
    notes,
    openAccountScreen,
    openPlusScreen,
    openSyncScreen,
    plusHint,
    plusValue,
    promptClearAll,
    setShowLanguage,
    setShowSync,
    setShowTheme,
    showLanguage,
    showSyncEntry: Boolean(user),
    showSync,
    showTheme,
    syncEnabled,
    pendingCount,
    failedCount,
    blockedCount,
    setSyncEnabled,
    syncValue,
    t,
    theme,
    themeLabel,
    setTheme,
    tier,
    user,
  };
}

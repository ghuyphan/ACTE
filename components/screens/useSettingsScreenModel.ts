import { Href, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSheetAlert } from '../../hooks/useAppSheetAlert';
import { useAuth } from '../../hooks/useAuth';
import { useConnectivity } from '../../hooks/useConnectivity';
import { useNotes } from '../../hooks/useNotes';
import { useSubscription } from '../../hooks/useSubscription';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { useTheme } from '../../hooks/useTheme';

export function useSettingsScreenModel() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme, colors, isDark } = useTheme();
  const { isOnline } = useConnectivity();
  const { notes, deleteAllNotes } = useNotes();
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

  const [showTheme, setShowTheme] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [showSync, setShowSync] = useState(false);

  const openAccountScreen = () => {
    if (!isAuthAvailable) {
      return;
    }

    router.push((user ? '/auth/profile' : '/auth') as Href);
  };

  const openPlusScreen = () => {
    router.push('/plus');
  };

  const themeLabel =
    theme === 'system'
      ? t('settings.system', 'System')
      : theme === 'dark'
        ? t('settings.dark', 'Dark')
        : t('settings.light', 'Light');

  const accountValue = useMemo(() => {
    if (user) {
      return user.displayName || user.email || t('settings.signedIn', 'Signed in');
    }
    if (!isAuthAvailable) {
      return t('settings.unavailableShort', 'Unavailable');
    }
    return t('settings.notSignedIn', 'Not signed in');
  }, [isAuthAvailable, t, user]);

  const syncValue = useMemo(() => {
    if (!user || !syncEnabled) {
      return t('settings.autoSyncOff', 'Off');
    }

    if (syncStatus === 'syncing') {
      return t('settings.autoSyncingShort', 'Syncing');
    }

    if (!isOnline && pendingCount > 0) {
      return t('settings.syncPendingShort', 'Pending');
    }

    return t('settings.autoSyncOnShort', 'On');
  }, [isOnline, pendingCount, syncEnabled, syncStatus, t, user]);

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
        'Noto Plus is active. Photo notes are expanded and library import is unlocked.'
      );
    }

    if (photoNoteLimit === null) {
      return t(
        'settings.plusHint',
        'Upgrade to Noto Plus to save more photo notes and create notes from your photo library.'
      );
    }

    return t(
      'settings.plusHintWithLimit',
      'Free plan includes up to {{count}} photo notes. Upgrade to Noto Plus for more image notes and library import.',
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

    if (!user || !syncEnabled) {
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
          await deleteAllNotes();
        },
      },
      secondaryAction: {
        label: t('common.cancel', 'Cancel'),
        variant: 'secondary',
      },
    });
  };

  return {
    accountHint,
    accountValue,
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
    plusHint,
    plusValue,
    promptClearAll,
    setShowLanguage,
    setShowSync,
    setShowTheme,
    showLanguage,
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

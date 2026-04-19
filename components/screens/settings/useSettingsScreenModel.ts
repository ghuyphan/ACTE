import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSheetAlert } from '../../../hooks/useAppSheetAlert';
import { useAuth } from '../../../hooks/useAuth';
import { useConnectivity } from '../../../hooks/useConnectivity';
import { useNotes } from '../../../hooks/useNotes';
import { useSharedFeedStore } from '../../../hooks/useSharedFeed';
import { useSocialPushPermission } from '../../../hooks/useSocialPushPermission';
import { useSubscription } from '../../../hooks/useSubscription';
import { useSyncStatus } from '../../../hooks/useSyncStatus';
import { useHaptics } from '../../../hooks/useHaptics';
import { useTheme } from '../../../hooks/useTheme';
import { createLegalLinkActions, getLegalLinkAvailability } from '../shared/legalLinkActions';
import {
  getHapticsLabel,
  getLanguageLabel,
  getThemeLabel,
  resolveAppLanguageKey,
} from '../../settings/settingsSelectionOptions';

function formatSyncTimestamp(dateString: string | null) {
  if (!dateString) {
    return null;
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function useSettingsScreenModel() {
  const { t, i18n } = useTranslation();
  const { theme, colors, isDark } = useTheme();
  const { isEnabled: hapticsEnabled } = useHaptics();
  const { isOnline } = useConnectivity();
  const { notes, deleteAllNotes } = useNotes();
  const { deleteSharedNotes, enabled: sharedFeedEnabled } = useSharedFeedStore();
  const { user, isAuthAvailable } = useAuth();
  const { enableFromPrompt, openSystemSettings, status: socialPushStatus } = useSocialPushPermission();
  const {
    status: syncStatus,
    bootstrapState,
    lastSyncedAt,
    pendingCount,
    failedCount,
    blockedCount,
    isEnabled: syncEnabled,
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
  const [showHaptics, setShowHaptics] = useState(false);
  const [showSync, setShowSync] = useState(false);

  const openAccountScreen = useCallback(() => {
    if (!isAuthAvailable) {
      return;
    }

    if (user) {
      router.push('/auth/profile');
      return;
    }

    router.push({
      pathname: '/auth',
      params: {
        returnTo: '/(tabs)/settings',
      },
    });
  }, [isAuthAvailable, router, user]);

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
  const hapticsValue = getHapticsLabel(hapticsEnabled ? 'on' : 'off', t);
  const languageLabel = getLanguageLabel(
    resolveAppLanguageKey(i18n.resolvedLanguage ?? i18n.language)
  );
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
      return t('settings.syncPausedShort', 'Paused');
    }

    if (!isOnline && pendingCount > 0) {
      return t('settings.syncOfflinePendingShort', 'Offline, {{count}} pending', {
        count: pendingCount,
      });
    }

    if (!isOnline && bootstrapState === 'offline') {
      return t('settings.syncOfflineShort', 'Offline');
    }

    if (syncStatus === 'error' || failedCount > 0 || blockedCount > 0) {
      return t('settings.syncNeedsAttentionShort', 'Attention');
    }

    if (syncStatus === 'syncing' || bootstrapState === 'syncing') {
      return t('settings.autoSyncingShort', 'Syncing');
    }

    if (bootstrapState === 'preparing') {
      return t('settings.syncPreparingShort', 'Preparing');
    }

    if (formatSyncTimestamp(lastSyncedAt)) {
      return t('settings.syncLastSyncedShort', 'Synced');
    }

    return t('settings.autoSyncOnShort', 'On');
  }, [
    blockedCount,
    bootstrapState,
    failedCount,
    isAuthAvailable,
    isOnline,
    lastSyncedAt,
    pendingCount,
    syncEnabled,
    syncStatus,
    t,
    user,
  ]);

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
      'Free plan includes {{count}} photo memories per day. Upgrade to Noto Plus for unlimited photo saves, premium photo filters, interactive hologram cards, and premium finishes.',
      { count: photoNoteLimit }
    );
  }, [photoNoteLimit, t, tier]);

  const socialPushValue = useMemo(() => {
    if (socialPushStatus === 'granted') {
      return t('settings.friendActivityNotificationsOn', 'On');
    }

    return t('settings.friendActivityNotificationsOff', 'Off');
  }, [socialPushStatus, t]);

  const socialPushHint = useMemo(() => {
    if (socialPushStatus === 'granted') {
      return t(
        'settings.friendActivityNotificationsEnabledHint',
        'Get alerts when friends accept invites or share moments with you.'
      );
    }

    return socialPushStatus === 'blocked'
      ? t(
          'settings.friendActivityNotificationsSettingsHint',
          'Notifications are off for Noto. Open system settings to turn friend activity alerts back on.'
        )
      : t(
          'settings.friendActivityNotificationsHint',
          'Turn this on so Noto can let you know when friends accept invites or share moments with you.'
        );
  }, [socialPushStatus, t]);

  const openSocialPushSettings = useCallback(() => {
    if (socialPushStatus === 'blocked') {
      void openSystemSettings();
      return;
    }

    void enableFromPrompt();
  }, [enableFromPrompt, openSystemSettings, socialPushStatus]);

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

    return null;
  }, [isAuthAvailable, t, user]);

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
    hapticsValue,
    insets,
    isAuthAvailable,
    isDark,
    isPurchaseAvailable,
    languageLabel,
    notes,
    openAccountScreen,
    openPlusScreen,
    openSocialPushSettings,
    openSyncScreen,
    plusHint,
    plusValue,
    promptClearAll,
    setShowHaptics,
    setShowLanguage,
    setShowSync,
    setShowTheme,
    showHaptics,
    showLanguage,
    showSocialPushEntry: Boolean(
      user &&
      sharedFeedEnabled &&
      (socialPushStatus === 'denied' ||
        socialPushStatus === 'blocked' ||
        socialPushStatus === 'granted')
    ),
    showSyncEntry: Boolean(user),
    showSync,
    showTheme,
    socialPushHint,
    socialPushValue,
    syncValue,
    t,
    themeLabel,
    tier,
    user,
  };
}

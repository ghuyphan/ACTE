import { useTranslation } from 'react-i18next';
import { useAuth } from './useAuth';
import { useSyncStatus } from './useSyncStatus';

export function useSyncSheetDetails(accountHint: string | null) {
  const { t } = useTranslation();
  const { user, isAuthAvailable } = useAuth();
  const { blockedCount, failedCount, isEnabled, pendingCount, setSyncEnabled } = useSyncStatus();
  const canManageSync = Boolean(user && isAuthAvailable);
  const description =
    canManageSync
      ? t('settings.autoSyncOnDetail', 'Your notes sync automatically while you are signed in.')
      : accountHint ??
        (isAuthAvailable
          ? t('settings.accountSignedOutMsg', 'Sign in to back up your notes and keep them synced across your devices.')
          : t('settings.accountUnavailableMsg', 'Account sign-in is unavailable right now. Your notes stay safely on this device.'));
  const statusLabel =
    canManageSync
      ? (isEnabled
        ? t('settings.autoSyncOnShort', 'On')
        : t('settings.autoSyncOff', 'Off'))
      : isAuthAvailable
        ? t('settings.notSignedIn', 'Not signed in')
        : t('settings.unavailableShort', 'Unavailable');
  const queueSummary = t('settings.syncQueueSummary', 'Pending: {{pending}} · Retry: {{failed}} · Blocked: {{blocked}}', {
    pending: pendingCount,
    failed: failedCount,
    blocked: blockedCount,
  });

  return {
    accountHintText: canManageSync ? accountHint : null,
    blockedCount,
    canManageSync,
    description,
    failedCount,
    isEnabled,
    pendingCount,
    queueSummary,
    setSyncEnabled,
    statusLabel,
  };
}

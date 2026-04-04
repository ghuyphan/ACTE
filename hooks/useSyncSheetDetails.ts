import { useTranslation } from 'react-i18next';
import { useAuth } from './useAuth';
import { useSyncStatus } from './useSyncStatus';

export function useSyncSheetDetails(accountHint: string | null) {
  const { t } = useTranslation();
  const { user, isAuthAvailable } = useAuth();
  const {
    blockedCount,
    failedCount,
    isEnabled,
    lastMessage,
    pendingCount,
    recentQueueItems,
    requestSync,
    setSyncEnabled,
    status,
  } = useSyncStatus();
  const canManageSync = Boolean(user && isAuthAvailable);
  const description =
    canManageSync
      ? accountHint ??
        (isEnabled
          ? t('settings.autoSyncOnDetail', 'Your notes sync automatically while you are signed in.')
          : t(
              'settings.autoSyncOffDetail',
              'Your notes stay on this device until you turn cloud sync back on.'
            ))
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
  const hasQueueItems = pendingCount > 0 || failedCount > 0 || blockedCount > 0;
  const queueSummary = hasQueueItems
    ? t('settings.syncQueueSummary', 'Pending: {{pending}} · Retry: {{failed}} · Blocked: {{blocked}}', {
        pending: pendingCount,
        failed: failedCount,
        blocked: blockedCount,
      })
    : null;
  const canRequestSync = canManageSync && isEnabled;
  const diagnosticsMessage =
    status === 'error'
      ? lastMessage ??
        t(
          'settings.autoSyncRetry',
          'We could not sync right now. We will try again when the app is active.'
        )
      : null;
  const showDiagnostics = Boolean(queueSummary || diagnosticsMessage || recentQueueItems.length > 0);

  return {
    canManageSync,
    canRequestSync,
    description,
    diagnosticsMessage,
    isEnabled,
    pendingCount,
    failedCount,
    blockedCount,
    recentQueueItems,
    requestSync,
    setSyncEnabled,
    queueSummary,
    showDiagnostics,
    status,
    statusLabel,
  };
}

import { useTranslation } from 'react-i18next';
import { useAuth } from './useAuth';
import { useConnectivity } from './useConnectivity';
import { useSyncStatus } from './useSyncStatus';

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

export function useSyncSheetDetails(accountHint: string | null) {
  const { t } = useTranslation();
  const { user, isAuthAvailable } = useAuth();
  const { isOnline } = useConnectivity();
  const {
    bootstrapState,
    blockedCount,
    failedCount,
    isEnabled,
    lastSyncedAt,
    lastMessage,
    pendingCount,
    recentQueueItems,
    requestSync,
    setSyncEnabled,
    status,
  } = useSyncStatus();
  const canManageSync = Boolean(user && isAuthAvailable);
  const formattedLastSyncedAt = formatSyncTimestamp(lastSyncedAt);
  const hasSyncIssues = status === 'error' || failedCount > 0 || blockedCount > 0;
  const description = !canManageSync
    ? accountHint ??
      (isAuthAvailable
        ? t('settings.accountSignedOutMsg', 'Sign in to back up your notes and keep them synced across your devices.')
        : t('settings.accountUnavailableMsg', 'Account sign-in is unavailable right now. Your notes stay safely on this device.'))
    : bootstrapState === 'preparing'
      ? t(
          'settings.initialSyncLoadingHint',
          'Keep Noto open a little longer so your first backup can finish safely.'
        )
      : !isEnabled
        ? t(
            'settings.autoSyncOffDetail',
            'Your notes stay on this device until you turn cloud sync back on.'
          )
        : !isOnline && pendingCount > 0
          ? t(
              'settings.syncPendingOffline',
              'Your notes are saved locally and will sync when you are back online.'
            )
          : !isOnline
            ? t(
                'settings.offlineReadOnly',
                'You are offline right now. Cloud sync will resume when you reconnect.'
              )
            : blockedCount > 0
              ? lastMessage ??
                t(
                  'settings.syncBlockedDetail',
                  'Some memories need your attention before they can be safely stored.'
                )
              : failedCount > 0 || status === 'error'
                ? lastMessage ??
                  t(
                    'settings.autoSyncRetry',
                    'We could not sync right now. We will try again when the app is active.'
                  )
                : accountHint ??
                  t(
                    'settings.autoSyncOnDetail',
                    'Your notes sync automatically while you are signed in.'
                  );
  const statusLabel = !canManageSync
    ? isAuthAvailable
      ? t('settings.notSignedIn', 'Not signed in')
      : t('settings.unavailableShort', 'Unavailable')
    : bootstrapState === 'preparing'
      ? t('settings.syncPreparing', 'Preparing first sync')
      : !isEnabled
        ? t('settings.syncPaused', 'Sync paused')
        : !isOnline && pendingCount > 0
          ? t('settings.syncOfflinePending', 'Offline, {{count}} pending', {
              count: pendingCount,
            })
          : !isOnline
            ? t('settings.syncOffline', 'Offline')
            : status === 'syncing' || bootstrapState === 'syncing'
              ? t('settings.autoSyncing', 'Syncing your journal.')
              : hasSyncIssues
                ? t('settings.syncNeedsAttention', 'Needs attention')
                : formattedLastSyncedAt
                  ? t('settings.lastSynced', 'Last synced {{date}}', {
                      date: formattedLastSyncedAt,
                    })
                  : t('settings.autoSyncOnShort', 'On');
  const hasQueueItems = pendingCount > 0 || failedCount > 0 || blockedCount > 0;
  const queueSummary = hasQueueItems
    ? t('settings.syncQueueSummary', 'Pending: {{pending}} · Retry: {{failed}} · Blocked: {{blocked}}', {
        pending: pendingCount,
        failed: failedCount,
        blocked: blockedCount,
      })
    : null;
  const canRequestSync = canManageSync && isEnabled && isOnline;
  const diagnosticsMessage =
    status === 'error'
      ? lastMessage ??
        t(
          'settings.autoSyncRetry',
          'We could not sync right now. We will try again when the app is active.'
        )
      : blockedCount > 0
        ? lastMessage ??
          t(
            'settings.syncBlockedDetail',
            'Some memories need your attention before they can be safely stored.'
          )
        : failedCount > 0
          ? lastMessage ??
            t(
              'settings.syncRetryQueued',
              'A few memories are waiting in line to be backed up again.'
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

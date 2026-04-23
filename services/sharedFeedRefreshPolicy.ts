export interface SharedFeedForegroundRefreshContext {
  dataSource: 'live' | 'cache';
  isOnline: boolean;
  lastForegroundRefreshAt: number | null;
  lastUpdatedAt: string | null;
  ready: boolean;
  subscriptionHealthy: boolean;
}

export const SHARED_FEED_FOREGROUND_REFRESH_MIN_INTERVAL_MS = 30_000;
export const SHARED_FEED_FOREGROUND_REFRESH_STALE_AFTER_MS = 3 * 60_000;

function getTimestampMs(value: string | null) {
  if (!value) {
    return null;
  }

  const nextTimestamp = new Date(value).getTime();
  return Number.isFinite(nextTimestamp) ? nextTimestamp : null;
}

export function shouldRefreshSharedFeedOnForeground(
  context: SharedFeedForegroundRefreshContext,
  now = Date.now()
) {
  if (!context.ready || !context.isOnline) {
    return false;
  }

  const lastForegroundRefreshAt = context.lastForegroundRefreshAt ?? 0;
  if (lastForegroundRefreshAt > 0 && now - lastForegroundRefreshAt < SHARED_FEED_FOREGROUND_REFRESH_MIN_INTERVAL_MS) {
    return false;
  }

  if (context.dataSource === 'cache' || !context.subscriptionHealthy) {
    return true;
  }

  const lastUpdatedAt = getTimestampMs(context.lastUpdatedAt);
  if (lastUpdatedAt == null) {
    return true;
  }

  return now - lastUpdatedAt >= SHARED_FEED_FOREGROUND_REFRESH_STALE_AFTER_MS;
}

export function shouldForceSharedFeedForegroundRefresh(
  context: Pick<SharedFeedForegroundRefreshContext, 'dataSource' | 'subscriptionHealthy'>
) {
  return context.dataSource === 'cache' || !context.subscriptionHealthy;
}

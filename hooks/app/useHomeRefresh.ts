import { useCallback, useState } from 'react';

interface UseHomeRefreshParams {
  hasNetworkRefreshWork: boolean;
  refreshNotes: (showLoading?: boolean) => Promise<void>;
  refreshSharedFeed?: () => Promise<void>;
  onAfterLocalRefresh?: () => void;
}

export function useHomeRefresh({
  hasNetworkRefreshWork,
  refreshNotes,
  refreshSharedFeed,
  onAfterLocalRefresh,
}: UseHomeRefreshParams) {
  const [refreshing, setRefreshing] = useState(false);

  const refreshHome = useCallback(async () => {
    if (!hasNetworkRefreshWork) {
      await refreshNotes(false);
      onAfterLocalRefresh?.();
      return;
    }

    setRefreshing(true);
    try {
      await refreshNotes(false);
      onAfterLocalRefresh?.();

      if (refreshSharedFeed) {
        try {
          await refreshSharedFeed();
        } catch (error) {
          console.warn('Shared feed refresh failed:', error);
        }
      }
    } finally {
      setRefreshing(false);
    }
  }, [hasNetworkRefreshWork, onAfterLocalRefresh, refreshNotes, refreshSharedFeed]);

  return {
    refreshing,
    refreshHome,
  };
}

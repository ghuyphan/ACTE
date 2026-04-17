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
    setRefreshing(true);
    try {
      await refreshNotes(false);
      onAfterLocalRefresh?.();

      if (!hasNetworkRefreshWork) {
        return;
      }

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

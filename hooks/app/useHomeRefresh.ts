import { useCallback, useState } from 'react';

interface UseHomeRefreshParams {
  hasNetworkRefreshWork: boolean;
  refreshNotes: (showLoading?: boolean) => Promise<void>;
  refreshSharedFeed?: () => Promise<void>;
  onAfterLocalRefresh?: () => void;
  onAfterNetworkRefresh?: () => void;
}

export function useHomeRefresh({
  hasNetworkRefreshWork,
  refreshNotes,
  refreshSharedFeed,
  onAfterLocalRefresh,
  onAfterNetworkRefresh,
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
          onAfterNetworkRefresh?.();
        } catch (error) {
          console.warn('Shared feed refresh failed:', error);
        }
      }
    } finally {
      setRefreshing(false);
    }
  }, [
    hasNetworkRefreshWork,
    onAfterLocalRefresh,
    onAfterNetworkRefresh,
    refreshNotes,
    refreshSharedFeed,
  ]);

  return {
    refreshing,
    refreshHome,
  };
}

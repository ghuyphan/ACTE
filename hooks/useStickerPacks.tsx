import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useOptionalAuth } from './useAuth';
import { useOptionalConnectivity } from './useConnectivity';
import {
  getInstalledStickerPacks,
  installStickerPack,
  isStickerPackModerator,
  refreshInstalledStickerPacks,
  removeStickerPack,
  type StickerPackDetail,
} from '../services/stickerPacks';

interface StickerPacksContextValue {
  installedPacks: StickerPackDetail[];
  isLoading: boolean;
  isRefreshing: boolean;
  isModerator: boolean;
  pendingPackIds: ReadonlySet<string>;
  refresh: () => Promise<void>;
  install: (packId: string) => Promise<void>;
  remove: (packId: string) => Promise<void>;
}

const StickerPacksContext = createContext<StickerPacksContextValue | undefined>(undefined);

export function StickerPacksProvider({ children }: { children: ReactNode }) {
  const auth = useOptionalAuth();
  const connectivity = useOptionalConnectivity();
  const authReady = auth?.isReady ?? true;
  const user = auth?.user ?? null;
  const isOnline = connectivity?.isOnline ?? false;
  const hasAppDependencies = Boolean(auth && connectivity);
  const [installedPacks, setInstalledPacks] = useState<StickerPackDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [pendingPackIds, setPendingPackIds] = useState<ReadonlySet<string>>(new Set());

  const loadLocal = useCallback(async () => {
    const packs = await getInstalledStickerPacks();
    setInstalledPacks(packs);
  }, []);

  const refresh = useCallback(async () => {
    if (!user || !isOnline) {
      await loadLocal();
      return;
    }

    setIsRefreshing(true);
    try {
      await refreshInstalledStickerPacks();
      await loadLocal();
      setIsModerator(await isStickerPackModerator().catch(() => false));
    } finally {
      setIsRefreshing(false);
    }
  }, [isOnline, loadLocal, user]);

  useEffect(() => {
    if (!hasAppDependencies) {
      setIsLoading(false);
      return;
    }
    if (!authReady) {
      return;
    }

    let active = true;
    setIsLoading(true);
    void loadLocal()
      .then(async () => {
        if (active && user && isOnline) {
          await refresh();
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [authReady, hasAppDependencies, isOnline, loadLocal, refresh, user]);

  const runPackMutation = useCallback(
    async (packId: string, mutation: (targetPackId: string) => Promise<void>) => {
      setPendingPackIds((current) => new Set(current).add(packId));
      try {
        await mutation(packId);
        await loadLocal();
      } finally {
        setPendingPackIds((current) => {
          const next = new Set(current);
          next.delete(packId);
          return next;
        });
      }
    },
    [loadLocal]
  );

  const install = useCallback(
    (packId: string) => runPackMutation(packId, installStickerPack),
    [runPackMutation]
  );
  const remove = useCallback(
    (packId: string) => runPackMutation(packId, removeStickerPack),
    [runPackMutation]
  );

  const value = useMemo<StickerPacksContextValue>(
    () => ({
      installedPacks,
      isLoading,
      isRefreshing,
      isModerator,
      pendingPackIds,
      refresh,
      install,
      remove,
    }),
    [
      install,
      installedPacks,
      isLoading,
      isModerator,
      isRefreshing,
      pendingPackIds,
      refresh,
      remove,
    ]
  );

  return <StickerPacksContext.Provider value={value}>{children}</StickerPacksContext.Provider>;
}

export function useStickerPacks() {
  const context = useContext(StickerPacksContext);
  if (!context) {
    throw new Error('useStickerPacks must be used within a StickerPacksProvider');
  }
  return context;
}

export function useOptionalStickerPacks() {
  return useContext(StickerPacksContext);
}

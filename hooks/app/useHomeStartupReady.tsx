import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

interface HomeStartupReadyContextValue {
  homeFeedReady: boolean;
  markHomeFeedReady: () => void;
  resetHomeFeedReady: () => void;
}

const HomeStartupReadyContext = createContext<HomeStartupReadyContextValue | undefined>(undefined);

export function HomeStartupReadyProvider({ children }: { children: ReactNode }) {
  const [homeFeedReady, setHomeFeedReady] = useState(false);

  const markHomeFeedReady = useCallback(() => {
    setHomeFeedReady(true);
  }, []);

  const resetHomeFeedReady = useCallback(() => {
    setHomeFeedReady(false);
  }, []);

  const value = useMemo(
    () => ({
      homeFeedReady,
      markHomeFeedReady,
      resetHomeFeedReady,
    }),
    [homeFeedReady, markHomeFeedReady, resetHomeFeedReady]
  );

  return (
    <HomeStartupReadyContext.Provider value={value}>
      {children}
    </HomeStartupReadyContext.Provider>
  );
}

export function useHomeStartupReady() {
  const context = useContext(HomeStartupReadyContext);
  if (!context) {
    throw new Error('useHomeStartupReady must be used within a HomeStartupReadyProvider');
  }
  return context;
}

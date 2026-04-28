import { useCallback, useEffect, useReducer, useState } from 'react';
import { i18nReady } from '../../constants/i18n';
import { getDB, resetLocalDatabase } from '../../services/database';
import { arePlaceRemindersEnabled, syncGeofenceRegions } from '../../services/geofenceService';
import { runMediaCacheEviction } from '../../services/mediaCacheManager';
import {
  configureForegroundNotificationPresentation,
  configureNotificationChannels,
} from '../../services/notificationService';
import {
  getCachedStartupRoute,
  loadStartupRoute,
  type StartupEntryRoute,
} from '../../services/startupRouting';
import { registerSocialPushBackgroundTaskAsync } from '../../utils/backgroundSocialPush';
import { scheduleOnIdle } from '../../utils/scheduleOnIdle';
import { withTimeout } from '../../utils/timeout';

const DATABASE_STARTUP_TIMEOUT_MS = 12000;

type DatabaseStartupState = {
  attempt: number;
  error: string | null;
  status: 'loading' | 'recovering' | 'resetting' | 'ready' | 'failed';
};

type DatabaseStartupAction =
  | { type: 'retryRequested' }
  | { type: 'resetStarted' }
  | { type: 'startupSucceeded' }
  | { type: 'startupFailed'; error: string }
  | { type: 'resetFailed' };

const initialDatabaseStartupState: DatabaseStartupState = {
  attempt: 0,
  error: null,
  status: 'loading',
};

function databaseStartupReducer(
  state: DatabaseStartupState,
  action: DatabaseStartupAction
): DatabaseStartupState {
  switch (action.type) {
    case 'retryRequested':
      return {
        attempt: state.attempt + 1,
        error: null,
        status: 'recovering',
      };
    case 'resetStarted':
      return {
        attempt: state.attempt + 1,
        error: null,
        status: 'resetting',
      };
    case 'startupSucceeded':
      return {
        ...state,
        error: null,
        status: 'ready',
      };
    case 'startupFailed':
      return {
        ...state,
        error: action.error,
        status: 'failed',
      };
    case 'resetFailed':
      return {
        ...state,
        error: 'database-reset-failed',
        status: 'failed',
      };
  }
}

function waitForDatabaseStartup() {
  return withTimeout(getDB(), DATABASE_STARTUP_TIMEOUT_MS, new Error('database-init-timeout'));
}

export function useAppStartupBootstrap() {
  const [databaseStartup, dispatchDatabaseStartup] = useReducer(
    databaseStartupReducer,
    initialDatabaseStartupState
  );
  const [startupRoute, setStartupRoute] = useState<StartupEntryRoute | null>(() => getCachedStartupRoute('entry'));
  const [isStartupRouteReady, setIsStartupRouteReady] = useState(() => Boolean(getCachedStartupRoute('entry')));

  const retryStartup = useCallback(() => {
    dispatchDatabaseStartup({ type: 'retryRequested' });
  }, []);

  const resetStartupData = useCallback(async () => {
    dispatchDatabaseStartup({ type: 'resetStarted' });

    try {
      await resetLocalDatabase();
      dispatchDatabaseStartup({ type: 'retryRequested' });
    } catch (error) {
      console.error('Database reset failed:', error);
      dispatchDatabaseStartup({ type: 'resetFailed' });
    }
  }, []);

  useEffect(() => {
    if (isStartupRouteReady) {
      return;
    }

    let cancelled = false;

    void loadStartupRoute('entry').then((nextRoute) => {
      if (!cancelled) {
        setStartupRoute(nextRoute);
        setIsStartupRouteReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isStartupRouteReady]);

  useEffect(() => {
    configureForegroundNotificationPresentation();
    void registerSocialPushBackgroundTaskAsync().catch((error) => {
      console.warn('Background social push registration failed:', error);
    });
    void i18nReady
      .then(() => configureNotificationChannels())
      .catch((error) => {
        console.error('Notification channel setup failed:', error);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let startupIdleHandle: ReturnType<typeof scheduleOnIdle> | null = null;
    let startupTimeout: ReturnType<typeof setTimeout> | null = null;

    if (databaseStartup.status === 'resetting') {
      return;
    }

    waitForDatabaseStartup()
      .then(() => {
        if (cancelled) {
          return;
        }

        dispatchDatabaseStartup({ type: 'startupSucceeded' });
        startupIdleHandle = scheduleOnIdle(() => {
          startupTimeout = setTimeout(() => {
            if (arePlaceRemindersEnabled()) {
              syncGeofenceRegions().catch((err) => console.warn('Geofence sync failed:', err));
            }
            runMediaCacheEviction().catch((err) => console.warn('Cache eviction failed:', err));
          }, 400);
        });
      })
      .catch((err) => {
        console.error('Database init failed:', err);
        if (!cancelled) {
          dispatchDatabaseStartup({
            type: 'startupFailed',
            error:
              err instanceof Error && err.message === 'database-init-timeout'
                ? 'database-init-timeout'
                : 'database-init-failed',
          });
        }
      });

    return () => {
      cancelled = true;
      startupIdleHandle?.cancel();
      if (startupTimeout) {
        clearTimeout(startupTimeout);
      }
    };
  }, [databaseStartup.attempt]);

  return {
    isDatabaseReady: databaseStartup.status === 'ready',
    isRecovering: databaseStartup.status === 'recovering' || databaseStartup.status === 'resetting',
    startupRoute,
    isStartupRouteReady,
    resetStartupData,
    retryStartup,
    startupError: databaseStartup.error,
  };
}

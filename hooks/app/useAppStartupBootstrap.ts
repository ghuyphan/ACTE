import { useCallback, useEffect, useState } from 'react';
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

export function useAppStartupBootstrap() {
  const [startupError, setStartupError] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isDatabaseReady, setIsDatabaseReady] = useState(false);
  const [startupRoute, setStartupRoute] = useState<StartupEntryRoute | null>(() => getCachedStartupRoute('entry'));
  const [isStartupRouteReady, setIsStartupRouteReady] = useState(() => Boolean(getCachedStartupRoute('entry')));
  const [databaseAttempt, setDatabaseAttempt] = useState(0);

  const retryStartup = useCallback(() => {
    setIsRecovering(true);
    setIsDatabaseReady(false);
    setDatabaseAttempt((current) => current + 1);
  }, []);

  const resetStartupData = useCallback(async () => {
    setIsRecovering(true);

    try {
      await resetLocalDatabase();
      setIsDatabaseReady(false);
      setDatabaseAttempt((current) => current + 1);
    } catch (error) {
      console.error('Database reset failed:', error);
      setStartupError('database-reset-failed');
      setIsRecovering(false);
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
    let cancelled = false;
    let startupIdleHandle: ReturnType<typeof scheduleOnIdle> | null = null;
    let startupTimeout: ReturnType<typeof setTimeout> | null = null;

    if (databaseAttempt > 0) {
      setIsRecovering(true);
    }

    configureForegroundNotificationPresentation();
    void registerSocialPushBackgroundTaskAsync().catch((error) => {
      console.warn('Background social push registration failed:', error);
    });
    void i18nReady
      .then(() => configureNotificationChannels())
      .catch((error) => {
        console.error('Notification channel setup failed:', error);
      });

    getDB()
      .then(() => {
        if (cancelled) {
          return;
        }

        setIsDatabaseReady(true);
        setStartupError(null);
        setIsRecovering(false);
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
          setIsDatabaseReady(false);
          setStartupError('database-init-failed');
          setIsRecovering(false);
        }
      });

    return () => {
      cancelled = true;
      startupIdleHandle?.cancel();
      if (startupTimeout) {
        clearTimeout(startupTimeout);
      }
    };
  }, [databaseAttempt]);

  return {
    isDatabaseReady,
    isRecovering,
    startupRoute,
    isStartupRouteReady,
    resetStartupData,
    retryStartup,
    startupError,
  };
}

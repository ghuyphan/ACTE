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
import { scheduleOnIdle } from '../../utils/scheduleOnIdle';

export function useAppStartupBootstrap() {
  const [startupTarget, setStartupTarget] = useState<StartupEntryRoute | null>(() =>
    getCachedStartupRoute('entry')
  );
  const [startupError, setStartupError] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [databaseAttempt, setDatabaseAttempt] = useState(0);

  const retryStartup = useCallback(() => {
    setIsRecovering(true);
    setDatabaseAttempt((current) => current + 1);
  }, []);

  const resetStartupData = useCallback(async () => {
    setIsRecovering(true);

    try {
      await resetLocalDatabase();
      setDatabaseAttempt((current) => current + 1);
    } catch (error) {
      console.error('Database reset failed:', error);
      setStartupError('database-reset-failed');
      setIsRecovering(false);
    }
  }, []);

  useEffect(() => {
    if (startupTarget) {
      return;
    }

    let cancelled = false;

    void loadStartupRoute('entry').then((nextTarget) => {
      if (!cancelled) {
        setStartupTarget(nextTarget);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [startupTarget]);

  useEffect(() => {
    let cancelled = false;
    let startupIdleHandle: ReturnType<typeof scheduleOnIdle> | null = null;
    let startupTimeout: ReturnType<typeof setTimeout> | null = null;

    if (databaseAttempt > 0) {
      setIsRecovering(true);
    }

    configureForegroundNotificationPresentation();
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
    isRecovering,
    resetStartupData,
    retryStartup,
    startupTarget,
    startupError,
  };
}

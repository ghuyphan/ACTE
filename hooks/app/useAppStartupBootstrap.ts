import { useEffect, useState } from 'react';
import { getDB } from '../../services/database';
import { syncGeofenceRegions } from '../../services/geofenceService';
import { runMediaCacheEviction } from '../../services/mediaCacheManager';
import { configureNotificationChannels } from '../../services/notificationService';
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

    void configureNotificationChannels();

    getDB()
      .then(() => {
        if (cancelled) {
          return;
        }

        setStartupError(null);
        startupIdleHandle = scheduleOnIdle(() => {
          startupTimeout = setTimeout(() => {
            syncGeofenceRegions().catch((err) => console.warn('Geofence sync failed:', err));
            runMediaCacheEviction().catch((err) => console.warn('Cache eviction failed:', err));
          }, 400);
        });
      })
      .catch((err) => {
        console.error('Database init failed:', err);
        if (!cancelled) {
          setStartupError('database-init-failed');
        }
      });

    return () => {
      cancelled = true;
      startupIdleHandle?.cancel();
      if (startupTimeout) {
        clearTimeout(startupTimeout);
      }
    };
  }, []);

  return {
    startupTarget,
    startupError,
  };
}

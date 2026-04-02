import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { getDB } from '../../services/database';
import { syncGeofenceRegions } from '../../services/geofenceService';
import { runMediaCacheEviction } from '../../services/mediaCacheManager';
import { configureNotificationChannels } from '../../services/notificationService';
import {
  getCachedStartupRoute,
  loadStartupRoute,
  type StartupRoute,
} from '../../services/startupRouting';
import { updateWidgetData } from '../../services/widgetService';
import { scheduleOnIdle } from '../../utils/scheduleOnIdle';

export function useAppStartupBootstrap() {
  const [initialUrlResolved, setInitialUrlResolved] = useState(false);
  const [startupTarget, setStartupTarget] = useState<StartupRoute | null>(() =>
    getCachedStartupRoute('entry')
  );

  useEffect(() => {
    let cancelled = false;

    void Linking.getInitialURL()
      .then((initialUrl) => {
        if (cancelled) {
          return;
        }

        setInitialUrlResolved(true);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setInitialUrlResolved(true);
      });

    return () => {
      cancelled = true;
    };
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

    void configureNotificationChannels();

    getDB()
      .then(() => {
        if (cancelled) {
          return;
        }

        startupIdleHandle = scheduleOnIdle(() => {
          startupTimeout = setTimeout(() => {
            updateWidgetData().catch((err) => console.warn('Widget init failed:', err));
            syncGeofenceRegions().catch((err) => console.warn('Geofence sync failed:', err));
            runMediaCacheEviction().catch((err) => console.warn('Cache eviction failed:', err));
          }, 400);
        });
      })
      .catch((err) => {
        console.error('Database init failed:', err);
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
    initialUrlResolved,
    startupTarget,
  };
}

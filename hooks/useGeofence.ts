import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { getReminderPermissionState, syncGeofenceRegions } from '../services/geofenceService';
import { scheduleOnIdle } from '../utils/scheduleOnIdle';

export interface ForegroundLocationRequestResult {
    location: Location.LocationObject | null;
    requiresSettings: boolean;
}

export interface ReminderPermissionRequestResult {
    enabled: boolean;
    requiresSettings: boolean;
}

export function useGeofence() {
    const [hasLocationPermission, setHasLocationPermission] = useState(false);
    const [remindersEnabled, setRemindersEnabled] = useState(false);
    const [location, setLocation] = useState<Location.LocationObject | null>(null);

    const refreshPermissions = useCallback(async () => {
        const permissionState = await getReminderPermissionState();
        setHasLocationPermission(permissionState.foregroundGranted);
        setRemindersEnabled(permissionState.remindersEnabled);
        return permissionState;
    }, []);

    const refreshLocation = useCallback(async () => {
        try {
            const known = await Location.getLastKnownPositionAsync();
            if (known) {
                setLocation(known);
                return known;
            }

            const currentLocation = await Location.getCurrentPositionAsync({});
            setLocation(currentLocation);
            return currentLocation;
        } catch {
            return null;
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        const idleHandle = scheduleOnIdle(() => {
            void (async () => {
                const foregroundStatus = await Location.getForegroundPermissionsAsync();
                if (cancelled) {
                    return;
                }

                setHasLocationPermission(foregroundStatus.status === 'granted');
                await refreshPermissions();
            })();
        });

        return () => {
            cancelled = true;
            idleHandle.cancel();
        };
    }, [refreshPermissions]);

    const requestForegroundLocation = useCallback(async (): Promise<ForegroundLocationRequestResult> => {
        let foregroundStatus = await Location.getForegroundPermissionsAsync();
        if (foregroundStatus.status !== 'granted') {
            foregroundStatus = await Location.requestForegroundPermissionsAsync();
        }

        const granted = foregroundStatus.status === 'granted';
        setHasLocationPermission(granted);

        if (!granted) {
            return {
                location: null,
                requiresSettings: foregroundStatus.canAskAgain === false,
            };
        }

        const nextLocation = await refreshLocation();
        return {
            location: nextLocation,
            requiresSettings: false,
        };
    }, [refreshLocation]);

    const requestReminderPermissions = useCallback(async (): Promise<ReminderPermissionRequestResult> => {
        const foregroundResult = await requestForegroundLocation();
        if (!foregroundResult.location) {
            setRemindersEnabled(false);
            return {
                enabled: false,
                requiresSettings: foregroundResult.requiresSettings,
            };
        }

        let backgroundStatus = await Location.getBackgroundPermissionsAsync();
        if (backgroundStatus.status !== 'granted') {
            backgroundStatus = await Location.requestBackgroundPermissionsAsync();
        }

        let notificationStatus = await Notifications.getPermissionsAsync();
        if (notificationStatus.status !== 'granted') {
            notificationStatus = await Notifications.requestPermissionsAsync();
        }

        const enabled =
            backgroundStatus.status === 'granted' && notificationStatus.status === 'granted';

        setRemindersEnabled(enabled);
        if (enabled) {
            await syncGeofenceRegions();
        }

        const requiresSettings =
            (backgroundStatus.status !== 'granted' && backgroundStatus.canAskAgain === false) ||
            (notificationStatus.status !== 'granted' && notificationStatus.canAskAgain === false);

        return {
            enabled,
            requiresSettings,
        };
    }, [requestForegroundLocation]);

    const openAppSettings = useCallback(async () => {
        try {
            await Linking.openSettings();
        } catch {
            return;
        }
    }, []);

    return {
        location,
        hasLocationPermission,
        remindersEnabled,
        refreshPermissions,
        requestForegroundLocation,
        requestReminderPermissions,
        openAppSettings,
    };
}

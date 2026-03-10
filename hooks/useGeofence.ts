import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { getReminderPermissionState, syncGeofenceRegions } from '../services/geofenceService';

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
            const currentLocation = await Location.getCurrentPositionAsync({});
            setLocation(currentLocation);
            return currentLocation;
        } catch {
            return null;
        }
    }, []);

    useEffect(() => {
        (async () => {
            const foregroundStatus = await Location.getForegroundPermissionsAsync();
            let resolvedStatus = foregroundStatus.status;
            if (resolvedStatus !== 'granted') {
                const requestedStatus = await Location.requestForegroundPermissionsAsync();
                resolvedStatus = requestedStatus.status;
            }

            setHasLocationPermission(resolvedStatus === 'granted');
            if (resolvedStatus === 'granted') {
                await refreshLocation();
            }

            await refreshPermissions();
        })();
    }, [refreshLocation, refreshPermissions]);

    const requestReminderPermissions = useCallback(async () => {
        let foregroundStatus = await Location.getForegroundPermissionsAsync();
        if (foregroundStatus.status !== 'granted') {
            foregroundStatus = await Location.requestForegroundPermissionsAsync();
        }

        if (foregroundStatus.status !== 'granted') {
            setHasLocationPermission(false);
            setRemindersEnabled(false);
            return false;
        }

        setHasLocationPermission(true);
        await refreshLocation();

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

        return enabled;
    }, [refreshLocation]);

    const requestForegroundLocation = useCallback(async () => {
        let foregroundStatus = await Location.getForegroundPermissionsAsync();
        if (foregroundStatus.status !== 'granted') {
            foregroundStatus = await Location.requestForegroundPermissionsAsync();
        }

        const granted = foregroundStatus.status === 'granted';
        setHasLocationPermission(granted);
        if (!granted) {
            return null;
        }

        return refreshLocation();
    }, [refreshLocation]);

    return {
        location,
        hasLocationPermission,
        remindersEnabled,
        refreshPermissions,
        requestForegroundLocation,
        requestReminderPermissions,
    };
}

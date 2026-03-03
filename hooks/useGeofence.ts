import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { GEOFENCE_TASK_NAME } from '../utils/backgroundGeofence';

export function useGeofence() {
    const [hasPermissions, setHasPermissions] = useState(false);
    const [location, setLocation] = useState<Location.LocationObject | null>(null);

    useEffect(() => {
        (async () => {
            // 1. Request Foreground Location Permission
            let { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
            if (foregroundStatus !== 'granted') {
                console.warn('Foreground location permission denied');
                return;
            }

            // 2. Request Background Location Permission (Crucial for geofencing when app is closed)
            let { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
            if (backgroundStatus !== 'granted') {
                console.warn('Background location permission denied');
                return;
            }

            // 3. Request Notification Permissions
            let { status: notifStatus } = await Notifications.requestPermissionsAsync();
            if (notifStatus !== 'granted') {
                console.warn('Notification permission denied');
                return;
            }

            setHasPermissions(true);

            // Get initial location for the map
            let currentLocation = await Location.getCurrentPositionAsync({});
            setLocation(currentLocation);
        })();
    }, []);

    const registerGeofence = async (id: string, latitude: number, longitude: number, radius: number = 150) => {
        if (!hasPermissions) {
            console.warn("Cannot register geofence without permissions.");
            return;
        }

        try {
            await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, [
                {
                    identifier: id,
                    latitude,
                    longitude,
                    radius,
                    notifyOnEnter: true,
                    notifyOnExit: false,
                },
            ]);
            console.log(`Geofence registered for ${id}`);
        } catch (error) {
            console.error("Error registering geofence:", error);
        }
    };

    const clearAllGeofences = async () => {
        try {
            const hasTask = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
            if (hasTask) {
                await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
                console.log("All geofences cleared.");
            }
        } catch (error) {
            console.error("Error clearing geofences:", error);
        }
    };

    return { location, hasPermissions, registerGeofence, clearAllGeofences };
}

import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { getAllNotes } from '../services/database';
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

            // Get initial location for the map (only needs foreground)
            try {
                let currentLocation = await Location.getCurrentPositionAsync({});
                setLocation(currentLocation);
            } catch (e) {
                console.warn('Could not get initial location:', e);
            }

            // 2. Check (don't prompt!) for Background Location Permission
            //    iOS will only show the prompt once — asking again after denial is a no-op
            //    that just logs a warning. So we check first, then request only if not determined.
            let { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();
            if (backgroundStatus !== 'granted') {
                // Only request if not yet determined (first run)
                const { status: newBgStatus } = await Location.requestBackgroundPermissionsAsync();
                backgroundStatus = newBgStatus;
            }
            if (backgroundStatus !== 'granted') {
                // Silently degrade — location still works for capture, just no geofencing
                return;
            }

            // 3. Request Notification Permissions
            let { status: notifStatus } = await Notifications.requestPermissionsAsync();
            if (notifStatus !== 'granted') {
                return;
            }

            setHasPermissions(true);
        })();
    }, []);

    /**
     * Register a geofence for a note. This rebuilds the full geofence list
     * from all stored notes so that existing geofences are preserved.
     */
    const registerGeofence = async (id: string, latitude: number, longitude: number, radius: number = 150) => {
        if (!hasPermissions) {
            console.warn("Cannot register geofence without permissions.");
            return;
        }

        try {
            // Fetch all notes and build the complete list of geofence regions
            const allNotes = await getAllNotes();
            const regions: Location.LocationRegion[] = allNotes.map((note) => ({
                identifier: note.id,
                latitude: note.latitude,
                longitude: note.longitude,
                radius: note.radius,
                notifyOnEnter: true,
                notifyOnExit: false,
            }));

            // If the new note isn't in the DB yet (just created), add it manually
            const exists = regions.some((r) => r.identifier === id);
            if (!exists) {
                regions.push({
                    identifier: id,
                    latitude,
                    longitude,
                    radius,
                    notifyOnEnter: true,
                    notifyOnExit: false,
                });
            }

            await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, regions);
            console.log(`Geofences registered: ${regions.length} total (including ${id})`);
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

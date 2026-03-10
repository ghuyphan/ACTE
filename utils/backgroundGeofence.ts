import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocationGeofencingEventType, LocationRegion } from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import i18n from '../constants/i18n';
import { getNoteById } from '../services/database';

export const GEOFENCE_TASK_NAME = 'BACKGROUND_GEOFENCE_TASK';
const NOTE_NOTIFICATION_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const LOCATION_NOTIFICATION_COOLDOWN_MS = 30 * 60 * 1000;

function getCooldownKey(scope: 'note' | 'location', id: string) {
    return `geofence.cooldown.${scope}.${id}`;
}

async function isOnCooldown(scope: 'note' | 'location', id: string, durationMs: number) {
    const lastTriggeredAt = await AsyncStorage.getItem(getCooldownKey(scope, id));
    if (!lastTriggeredAt) {
        return false;
    }

    const elapsedMs = Date.now() - Number(lastTriggeredAt);
    return Number.isFinite(elapsedMs) && elapsedMs < durationMs;
}

async function setCooldown(scope: 'note' | 'location', id: string) {
    await AsyncStorage.setItem(getCooldownKey(scope, id), String(Date.now()));
}

function getLocationCooldownId(locationName: string | null, latitude?: number, longitude?: number) {
    if (locationName?.trim()) {
        return locationName.trim().toLowerCase();
    }

    if (typeof latitude === 'number' && typeof longitude === 'number') {
        return `${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
    }

    return 'unknown-location';
}

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
    if (error) {
        console.error('Geofence task error:', error.message);
        return;
    }

    if (data) {
        const { eventType, region } = data as {
            eventType: LocationGeofencingEventType;
            region: LocationRegion;
        };

        if (eventType === LocationGeofencingEventType.Enter) {
            console.log('You entered region:', region.identifier);

            // Look up the actual note content
            let title = i18n.t('notification.title');
            let body = i18n.t('notification.body');
            const regionId = region.identifier ?? '';
            const isNoteCoolingDown = regionId
                ? await isOnCooldown('note', regionId, NOTE_NOTIFICATION_COOLDOWN_MS)
                : false;

            if (isNoteCoolingDown) {
                return;
            }

            try {
                const note = regionId ? await getNoteById(regionId) : null;
                if (note) {
                    const locationCooldownId = getLocationCooldownId(
                        note.locationName,
                        note.latitude,
                        note.longitude
                    );
                    const isLocationCoolingDown = await isOnCooldown(
                        'location',
                        locationCooldownId,
                        LOCATION_NOTIFICATION_COOLDOWN_MS
                    );

                    if (isLocationCoolingDown) {
                        await setCooldown('note', regionId);
                        return;
                    }

                    const location = note.locationName || i18n.t('widget.unknownPlace');
                    if (note.type === 'text') {
                        title = i18n.t('notification.textTitle', { location });
                        body = note.content.length > 120
                            ? note.content.substring(0, 120) + '…'
                            : note.content;
                    } else {
                        title = i18n.t('notification.photoTitle', { location });
                        body = i18n.t('notification.photoBody');
                    }

                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title,
                            body,
                            data: { noteId: region.identifier },
                        },
                        trigger: null,
                    });

                    await Promise.all([
                        setCooldown('note', regionId),
                        setCooldown('location', locationCooldownId),
                    ]);
                    return;
                }
            } catch (err) {
                console.error('Failed to fetch note for notification:', err);
            }

            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data: { noteId: region.identifier },
                },
                trigger: null,
            });
            if (regionId) {
                await setCooldown('note', regionId);
            }
        } else if (eventType === LocationGeofencingEventType.Exit) {
            console.log('You left region:', region.identifier);
        }
    }
});

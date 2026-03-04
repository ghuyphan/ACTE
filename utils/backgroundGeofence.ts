import { LocationGeofencingEventType, LocationRegion } from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import i18n from '../constants/i18n';
import { getNoteById } from '../services/database';

export const GEOFENCE_TASK_NAME = 'BACKGROUND_GEOFENCE_TASK';

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

            try {
                const note = regionId ? await getNoteById(regionId) : null;
                if (note) {
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
        } else if (eventType === LocationGeofencingEventType.Exit) {
            console.log('You left region:', region.identifier);
        }
    }
});

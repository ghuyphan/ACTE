import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocationGeofencingEventType, LocationRegion } from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import i18n from '../constants/i18n';
import { getAllNotes, getNoteById } from '../services/database';
import { buildReminderNotificationContent } from '../services/notificationService';
import { buildReminderTextExcerpt, findReminderPlaceGroupByNoteId } from '../services/reminderSelection';
import { getGeofenceCooldownKey, getLocationCooldownId, getSkipNextEnterKey } from './geofenceKeys';

export const GEOFENCE_TASK_NAME = 'BACKGROUND_GEOFENCE_TASK';
const NOTE_NOTIFICATION_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const LOCATION_NOTIFICATION_COOLDOWN_MS = 30 * 60 * 1000;

function getCooldownKey(scope: 'note' | 'location', id: string) {
    return getGeofenceCooldownKey(scope, id);
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

            let title = i18n.t('notification.title');
            let body = i18n.t('notification.body');
            const regionId = region.identifier ?? '';

            if (regionId) {
                const skipNextEnterKey = getSkipNextEnterKey(regionId);
                const shouldSkip = await AsyncStorage.getItem(skipNextEnterKey);
                if (shouldSkip === '1') {
                    await AsyncStorage.removeItem(skipNextEnterKey);
                    return;
                }
            }

            let cooldownNoteId = regionId;

            try {
                const [triggeredNote, allNotes] = await Promise.all([
                    regionId ? getNoteById(regionId) : Promise.resolve(null),
                    regionId ? getAllNotes() : Promise.resolve([]),
                ]);
                const reminderGroup = regionId
                    ? findReminderPlaceGroupByNoteId(allNotes, regionId)
                    : null;
                const note = reminderGroup?.bestNote ?? triggeredNote;

                if (note) {
                    cooldownNoteId = note.id;
                    const isNoteCoolingDown = await isOnCooldown(
                        'note',
                        cooldownNoteId,
                        NOTE_NOTIFICATION_COOLDOWN_MS
                    );
                    if (isNoteCoolingDown) {
                        return;
                    }

                    const locationName = note.locationName?.trim() || '';
                    const locationCooldownId = getLocationCooldownId(
                        locationName || i18n.t('widget.unknownPlace'),
                        note.latitude,
                        note.longitude
                    );
                    const isLocationCoolingDown = await isOnCooldown(
                        'location',
                        locationCooldownId,
                        LOCATION_NOTIFICATION_COOLDOWN_MS
                    );

                    if (isLocationCoolingDown) {
                        await setCooldown('note', cooldownNoteId);
                        return;
                    }

                    if (note.type === 'text') {
                        title = locationName
                            ? i18n.t('notification.textTitle', { location: locationName })
                            : i18n.t('notification.title');
                        body = buildReminderTextExcerpt(note.content) || i18n.t('notification.body');
                    } else {
                        title = locationName
                            ? i18n.t('notification.photoTitle', { location: locationName })
                            : i18n.t('notification.title');
                        body = i18n.t('notification.photoBody');
                    }

                    await Notifications.scheduleNotificationAsync({
                        content: buildReminderNotificationContent({
                            title,
                            body,
                            noteId: cooldownNoteId,
                        }),
                        trigger: null,
                    });

                    await Promise.all([
                        setCooldown('note', cooldownNoteId),
                        setCooldown('location', locationCooldownId),
                    ]);
                    return;
                }
            } catch (err) {
                console.error('Failed to fetch note for notification:', err);
            }

            const isFallbackCoolingDown = cooldownNoteId
                ? await isOnCooldown('note', cooldownNoteId, NOTE_NOTIFICATION_COOLDOWN_MS)
                : false;
            if (isFallbackCoolingDown) {
                return;
            }

            await Notifications.scheduleNotificationAsync({
                content: buildReminderNotificationContent({
                    title,
                    body,
                    noteId: cooldownNoteId,
                }),
                trigger: null,
            });
            if (cooldownNoteId) {
                await setCooldown('note', cooldownNoteId);
            }
        } else if (eventType === LocationGeofencingEventType.Exit) {
            console.log('You left region:', region.identifier);
        }
    }
});

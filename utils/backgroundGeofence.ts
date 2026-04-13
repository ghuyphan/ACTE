import { LocationGeofencingEventType, LocationRegion } from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import i18n, { i18nReady } from '../constants/i18n';
import {
    getAllNotesForScope,
    getNoteByIdForScope,
    getPersistedActiveNotesScope,
    LOCAL_NOTES_SCOPE,
} from '../services/database';
import { consumeSkippedImmediateReminder } from './geofenceSkipEnter';
import {
    buildNearbyReminderCopy,
    buildReminderNotificationContent,
    configureNotificationChannels,
} from '../services/notificationService';
import { buildReminderTextExcerpt, findReminderPlaceGroupByNoteId } from '../services/reminderSelection';
import { updateWidgetData } from '../services/widgetService';
import { getGeofenceCooldownKey, getLocationCooldownId } from './geofenceKeys';
import { getPersistentItem, removePersistentItem, setPersistentItem } from './appStorage';

export const GEOFENCE_TASK_NAME = 'BACKGROUND_GEOFENCE_TASK';
const NOTE_NOTIFICATION_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const LOCATION_NOTIFICATION_COOLDOWN_MS = 30 * 60 * 1000;

function getCooldownKey(scope: 'note' | 'location', id: string) {
    return getGeofenceCooldownKey(scope, id);
}

async function isOnCooldown(scope: 'note' | 'location', id: string, durationMs: number) {
    const lastTriggeredAt = await getPersistentItem(getCooldownKey(scope, id));
    if (!lastTriggeredAt) {
        return false;
    }

    const elapsedMs = Date.now() - Number(lastTriggeredAt);
    return Number.isFinite(elapsedMs) && elapsedMs < durationMs;
}

async function setCooldown(scope: 'note' | 'location', id: string) {
    await setPersistentItem(getCooldownKey(scope, id), String(Date.now()));
}

function getWidgetRefreshLocation(
    note: {
        latitude?: number | null;
        longitude?: number | null;
    } | null,
    region: LocationRegion
) {
    const latitude = note?.latitude ?? region.latitude;
    const longitude = note?.longitude ?? region.longitude;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
    }

    return { latitude, longitude };
}

async function resolveBackgroundNotesScope() {
    return (await getPersistedActiveNotesScope()) ?? LOCAL_NOTES_SCOPE;
}

async function prepareReminderNotificationDelivery() {
    try {
        await i18nReady;
    } catch (error) {
        console.warn('Reminder notification i18n setup failed:', error);
    }

    try {
        await configureNotificationChannels();
    } catch (error) {
        console.warn('Reminder notification channel setup failed:', error);
    }
}

async function refreshWidgetForTriggeredNote(
    note: {
        id: string;
        latitude?: number | null;
        longitude?: number | null;
    },
    allNotes: Awaited<ReturnType<typeof getAllNotesForScope>>,
    region: LocationRegion
) {
    const widgetRefreshLocation = getWidgetRefreshLocation(note, region);

    try {
        await updateWidgetData({
            notes: allNotes,
            includeLocationLookup: false,
            currentLocation: widgetRefreshLocation,
            preferredNoteId: note.id,
        });
    } catch (widgetError) {
        console.warn('Widget geofence refresh failed:', widgetError);
    }
}

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

if (
    typeof TaskManager.isTaskDefined !== 'function' ||
    !TaskManager.isTaskDefined(GEOFENCE_TASK_NAME)
) {
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
                console.info('You entered region:', region.identifier);

                let title = i18n.t('notification.title');
                let body = i18n.t('notification.body');
                const regionId = region.identifier ?? '';

                if (regionId) {
                    const shouldSkip = await consumeSkippedImmediateReminder(regionId);
                    if (shouldSkip) {
                        return;
                    }
                }

                let cooldownNoteId = regionId;

                try {
                    const noteScope = await resolveBackgroundNotesScope();
                    const [triggeredNote, allNotes] = await Promise.all([
                        regionId ? getNoteByIdForScope(regionId, noteScope) : Promise.resolve(null),
                        regionId ? getAllNotesForScope(noteScope) : Promise.resolve([]),
                    ]);
                    const reminderGroup = regionId
                        ? findReminderPlaceGroupByNoteId(allNotes, regionId)
                        : null;
                    const note = reminderGroup?.bestNote ?? triggeredNote;

                    if (note) {
                        cooldownNoteId = note.id;
                        const widgetRefreshPromise = refreshWidgetForTriggeredNote(note, allNotes, region);

                        const isNoteCoolingDown = await isOnCooldown(
                            'note',
                            cooldownNoteId,
                            NOTE_NOTIFICATION_COOLDOWN_MS
                        );
                        if (isNoteCoolingDown) {
                            console.info('Geofence reminder suppressed by note cooldown:', cooldownNoteId);
                            await widgetRefreshPromise;
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
                            console.info('Geofence reminder suppressed by location cooldown:', locationCooldownId);
                            await Promise.all([
                                setCooldown('note', cooldownNoteId),
                                widgetRefreshPromise,
                            ]);
                            return;
                        }

                        if (note.type === 'text') {
                            const reminderCopy = await buildNearbyReminderCopy({
                                noteType: 'text',
                                locationName,
                                noteBody: buildReminderTextExcerpt(note.content),
                            });
                            title = reminderCopy.title;
                            body = reminderCopy.body;
                        } else {
                            const reminderCopy = await buildNearbyReminderCopy({
                                noteType: 'photo',
                                locationName,
                            });
                            title = reminderCopy.title;
                            body = reminderCopy.body;
                        }

                        await prepareReminderNotificationDelivery();
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
                            widgetRefreshPromise,
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
                    console.info('Geofence fallback reminder suppressed by note cooldown:', cooldownNoteId);
                    return;
                }

                await prepareReminderNotificationDelivery();
                await Notifications.scheduleNotificationAsync({
                    content: buildReminderNotificationContent({
                        title,
                        body,
                        noteId: cooldownNoteId || null,
                    }),
                    trigger: null,
                });
                if (cooldownNoteId) {
                    await setCooldown('note', cooldownNoteId);
                }
            } else if (eventType === LocationGeofencingEventType.Exit) {
                console.info('You left region:', region.identifier);
            }
        }
    });
}

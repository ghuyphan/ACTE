import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Note, getAllNotes } from './database';
import { getReminderPlaceGroups } from './reminderSelection';
import { GEOFENCE_TASK_NAME } from '../utils/backgroundGeofence';
import { getSkipNextEnterKey } from '../utils/geofenceKeys';
import { getPersistentItem, removePersistentItem, setPersistentItem } from '../utils/appStorage';

export interface ReminderPermissionState {
  foregroundGranted: boolean;
  remindersEnabled: boolean;
}

const GEOFENCE_SIGNATURE_STORAGE_KEY = 'geofence.signature';
const IOS_GEOFENCE_REGION_LIMIT = 20;
const ANDROID_GEOFENCE_REGION_LIMIT = 100;

export function getMaxGeofenceRegionCount(platformOS = Platform.OS) {
  return platformOS === 'android' ? ANDROID_GEOFENCE_REGION_LIMIT : IOS_GEOFENCE_REGION_LIMIT;
}

function buildGeofenceSignature(
  regions: Array<Pick<Location.LocationRegion, 'identifier' | 'latitude' | 'longitude' | 'radius'>>
) {
  return JSON.stringify(
    [...regions]
      .sort((a, b) => (a.identifier ?? '').localeCompare(b.identifier ?? ''))
      .map((region) => ({
        id: region.identifier ?? '',
        lat: Number(region.latitude.toFixed(6)),
        lon: Number(region.longitude.toFixed(6)),
        radius: Math.round(region.radius),
      }))
  );
}

export function prioritizeNotesForGeofencing(notes: Note[], maxRegions: number) {
  return getReminderPlaceGroups(notes)
    .slice(0, maxRegions)
    .map((group) => group.representativeNote);
}

export async function getReminderPermissionState(): Promise<ReminderPermissionState> {
  const [foregroundStatus, backgroundStatus, notificationStatus] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
    Notifications.getPermissionsAsync(),
  ]);

  return {
    foregroundGranted: foregroundStatus.status === 'granted',
    remindersEnabled:
      backgroundStatus.status === 'granted' && notificationStatus.status === 'granted',
  };
}

export async function syncGeofenceRegions(): Promise<boolean> {
  const { remindersEnabled } = await getReminderPermissionState();
  if (!remindersEnabled) {
    return false;
  }

  const notes = await getAllNotes();
  const maxRegions = getMaxGeofenceRegionCount();
  const notesToMonitor = prioritizeNotesForGeofencing(notes, maxRegions);

  if (notes.length > maxRegions) {
    console.warn(
      `Geofencing is limited to ${maxRegions} regions on ${Platform.OS}; prioritizing favorite and recent places within that limit.`
    );
  }

  const regions: Location.LocationRegion[] = notesToMonitor.map((note) => ({
    identifier: note.id,
    latitude: note.latitude,
    longitude: note.longitude,
    radius: note.radius,
    notifyOnEnter: true,
    notifyOnExit: false,
  }));

  if (regions.length === 0) {
    await clearGeofenceRegions();
    return true;
  }

  const signature = buildGeofenceSignature(regions);
  const [hasTask, previousSignature] = await Promise.all([
    Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME),
    getPersistentItem(GEOFENCE_SIGNATURE_STORAGE_KEY),
  ]);

  if (hasTask && previousSignature === signature) {
    return true;
  }

  await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, regions);
  await setPersistentItem(GEOFENCE_SIGNATURE_STORAGE_KEY, signature);
  return true;
}

export async function skipImmediateReminderForNewNote(noteId: string): Promise<void> {
  if (!noteId) {
    return;
  }

  const { remindersEnabled } = await getReminderPermissionState();
  if (!remindersEnabled) {
    return;
  }

  await setPersistentItem(getSkipNextEnterKey(noteId), '1');
}

export async function clearGeofenceRegions(): Promise<void> {
  const hasTask = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
  if (hasTask) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
  }
  await removePersistentItem(GEOFENCE_SIGNATURE_STORAGE_KEY);
}

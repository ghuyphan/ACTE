import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { getAllNotes } from './database';
import { GEOFENCE_TASK_NAME } from '../utils/backgroundGeofence';
import { getSkipNextEnterKey } from '../utils/geofenceKeys';

export interface ReminderPermissionState {
  foregroundGranted: boolean;
  remindersEnabled: boolean;
}

const GEOFENCE_SIGNATURE_STORAGE_KEY = 'geofence.signature';

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
  const regions: Location.LocationRegion[] = notes.map((note) => ({
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
    AsyncStorage.getItem(GEOFENCE_SIGNATURE_STORAGE_KEY),
  ]);

  if (hasTask && previousSignature === signature) {
    return true;
  }

  await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, regions);
  await AsyncStorage.setItem(GEOFENCE_SIGNATURE_STORAGE_KEY, signature);
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

  await AsyncStorage.setItem(getSkipNextEnterKey(noteId), '1');
}

export async function clearGeofenceRegions(): Promise<void> {
  const hasTask = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
  if (hasTask) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
  }
  await AsyncStorage.removeItem(GEOFENCE_SIGNATURE_STORAGE_KEY);
}

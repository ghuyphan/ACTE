import Constants from 'expo-constants';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Note, getNotesForReminderSelection } from './database';
import { getReminderPlaceGroups } from './reminderSelection';
import { GEOFENCE_TASK_NAME } from '../utils/backgroundGeofence';
import { getSkipNextEnterKey } from '../utils/geofenceKeys';
import { getPersistentItem, removePersistentItem, setPersistentItem } from '../utils/appStorage';

export interface ReminderPermissionState {
  foregroundGranted: boolean;
  remindersEnabled: boolean;
}

export interface GeofenceSelectionSummary {
  totalNotes: number;
  totalPlaces: number;
  activePlaces: number;
  overflowPlaces: number;
}

const GEOFENCE_SIGNATURE_STORAGE_KEY = 'geofence.signature';
const IOS_GEOFENCE_REGION_LIMIT = 20;
const ANDROID_GEOFENCE_REGION_LIMIT = 100;

function readPlaceRemindersConfig() {
  const extra = Constants.expoConfig?.extra as { enablePlaceReminders?: unknown } | undefined;
  return extra?.enablePlaceReminders;
}

export function arePlaceRemindersEnabled() {
  const configuredValue = readPlaceRemindersConfig();
  return configuredValue !== false && configuredValue !== 'false';
}

function isBackgroundLocationAuthorizationError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    (message.includes('background location') || message.includes('location services')) &&
    (message.includes('not authorized') || message.includes('not authorised'))
  );
}

async function hasStartedGeofencingSafely() {
  try {
    return await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
  } catch (error) {
    if (isBackgroundLocationAuthorizationError(error)) {
      return false;
    }

    throw error;
  }
}

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

export function summarizeGeofenceSelection(notes: Note[], maxRegions: number): GeofenceSelectionSummary {
  const totalPlaces = getReminderPlaceGroups(notes).length;
  const activePlaces = Math.min(totalPlaces, maxRegions);

  return {
    totalNotes: notes.length,
    totalPlaces,
    activePlaces,
    overflowPlaces: Math.max(0, totalPlaces - activePlaces),
  };
}

export async function getReminderPermissionState(): Promise<ReminderPermissionState> {
  if (!arePlaceRemindersEnabled()) {
    return {
      foregroundGranted: false,
      remindersEnabled: false,
    };
  }

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

export async function syncGeofenceRegions(options: { notes?: Note[] | null } = {}): Promise<boolean> {
  if (!arePlaceRemindersEnabled()) {
    await clearGeofenceRegions();
    return false;
  }

  const { remindersEnabled } = await getReminderPermissionState();
  if (!remindersEnabled) {
    await clearGeofenceRegions();
    return false;
  }

  const notes = options.notes ?? await getNotesForReminderSelection();
  const maxRegions = getMaxGeofenceRegionCount();
  const selectionSummary = summarizeGeofenceSelection(notes, maxRegions);
  const notesToMonitor = prioritizeNotesForGeofencing(notes, maxRegions);

  if (selectionSummary.overflowPlaces > 0) {
    console.warn(
      `Geofencing is limited to ${maxRegions} places on ${Platform.OS}; monitoring ${selectionSummary.activePlaces} of ${selectionSummary.totalPlaces} prioritized places.`
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
    hasStartedGeofencingSafely(),
    getPersistentItem(GEOFENCE_SIGNATURE_STORAGE_KEY),
  ]);

  if (hasTask && previousSignature === signature) {
    return true;
  }

  try {
    await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, regions);
  } catch (error) {
    if (isBackgroundLocationAuthorizationError(error)) {
      await removePersistentItem(GEOFENCE_SIGNATURE_STORAGE_KEY);
      return false;
    }

    throw error;
  }
  await setPersistentItem(GEOFENCE_SIGNATURE_STORAGE_KEY, signature);
  return true;
}

export async function skipImmediateReminderForNewNote(noteId: string): Promise<void> {
  if (!noteId) {
    return;
  }

  if (!arePlaceRemindersEnabled()) {
    return;
  }

  const { remindersEnabled } = await getReminderPermissionState();
  if (!remindersEnabled) {
    return;
  }

  await setPersistentItem(getSkipNextEnterKey(noteId), '1');
}

export async function clearGeofenceRegions(): Promise<void> {
  const hasTask = await hasStartedGeofencingSafely();
  if (hasTask) {
    try {
      await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
    } catch (error) {
      if (!isBackgroundLocationAuthorizationError(error)) {
        throw error;
      }
    }
  }
  await removePersistentItem(GEOFENCE_SIGNATURE_STORAGE_KEY);
}

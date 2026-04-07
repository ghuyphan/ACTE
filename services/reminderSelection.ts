import type { Note } from './database';
import {
  compareByReminderUtility,
  getPlaceGroups,
  getPlaceKey,
  getReminderSignalStrength,
} from './placeRanking';

export interface ReminderPlaceGroup {
  key: string;
  notes: Note[];
  representativeNote: Note;
  bestNote: Note;
  bestWidgetNote: Note;
  locationName: string | null;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface NearbyReminderSelection {
  selectedPlace: ReminderPlaceGroup | null;
  selectedNote: Note | null;
  nearbyPlacesCount: number;
  isNearby: boolean;
}

export function hasPreferenceSignal(note: Pick<Note, 'type' | 'content'>) {
  return getReminderSignalStrength(note) > 0;
}

export function getReminderPlaceKey(note: Pick<Note, 'locationName' | 'latitude' | 'longitude'>) {
  return getPlaceKey(note);
}

export function compareReminderNotes(a: Note, b: Note) {
  return compareByReminderUtility(a, b);
}

export function selectBestReminderNote(notes: Note[]) {
  if (notes.length === 0) {
    return null;
  }

  return [...notes].sort(compareReminderNotes)[0] ?? null;
}

export function getReminderPlaceGroups(notes: Note[]): ReminderPlaceGroup[] {
  return getPlaceGroups(notes).map((group) => ({
    key: group.key,
    notes: group.notes,
    representativeNote: group.representativeNote,
    bestNote: group.bestReminderNote,
    bestWidgetNote: group.bestWidgetNote,
    locationName: group.locationName,
    latitude: group.latitude,
    longitude: group.longitude,
    radiusMeters: group.radiusMeters,
  }));
}

export function findReminderPlaceGroupByNoteId(notes: Note[], noteId: string) {
  if (!noteId) {
    return null;
  }

  return getReminderPlaceGroups(notes).find((group) =>
    group.notes.some((note) => note.id === noteId)
  ) ?? null;
}

export function getDistanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
) {
  const earthRadiusMeters = 6371e3;
  const startLat = from.latitude * Math.PI / 180;
  const endLat = to.latitude * Math.PI / 180;
  const deltaLat = (to.latitude - from.latitude) * Math.PI / 180;
  const deltaLon = (to.longitude - from.longitude) * Math.PI / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(startLat) * Math.cos(endLat) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

export function selectNearbyReminder(options: {
  notes: Note[];
  currentLocation?: { latitude: number; longitude: number } | null;
  nearbyRadiusMeters?: number;
}): NearbyReminderSelection {
  const { notes, currentLocation = null, nearbyRadiusMeters = 500 } = options;

  if (!currentLocation || notes.length === 0) {
    return {
      selectedPlace: null,
      selectedNote: null,
      nearbyPlacesCount: 0,
      isNearby: false,
    };
  }

  const nearbyPlaces = getReminderPlaceGroups(notes)
    .map((group) => ({
      group,
      distanceMeters: getDistanceMeters(currentLocation, {
        latitude: group.latitude,
        longitude: group.longitude,
      }),
    }))
    .filter((entry) => entry.distanceMeters <= nearbyRadiusMeters)
    .sort((a, b) => {
      const distanceDelta = a.distanceMeters - b.distanceMeters;
      if (distanceDelta !== 0) {
        return distanceDelta;
      }

      return compareReminderNotes(a.group.bestNote, b.group.bestNote);
    });

  const selectedPlace = nearbyPlaces[0]?.group ?? null;

  return {
    selectedPlace,
    selectedNote: selectedPlace?.bestNote ?? null,
    nearbyPlacesCount: selectedPlace ? Math.max(0, nearbyPlaces.length - 1) : 0,
    isNearby: Boolean(selectedPlace),
  };
}

export function buildReminderTextExcerpt(text: string, maxLength = 90) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const sliced = normalized.slice(0, maxLength - 1);
  const lastSpaceIndex = sliced.lastIndexOf(' ');
  const trimmedSlice = lastSpaceIndex >= 48 ? sliced.slice(0, lastSpaceIndex) : sliced;
  return `${trimmedSlice.trim()}…`;
}

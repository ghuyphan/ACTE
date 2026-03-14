import type { Note } from './database';

export interface ReminderPlaceGroup {
  key: string;
  notes: Note[];
  representativeNote: Note;
  bestNote: Note;
  locationName: string | null;
  latitude: number;
  longitude: number;
}

export interface NearbyReminderSelection {
  selectedPlace: ReminderPlaceGroup | null;
  selectedNote: Note | null;
  nearbyPlacesCount: number;
  isNearby: boolean;
}

const PLACE_COORDINATE_PRECISION = 4;
const PREFERENCE_SIGNAL_PATTERNS = [
  /\bdoesn'?t like\b/i,
  /\bdislikes?\b/i,
  /\blikes?\b/i,
  /\bprefer(?:s|red)?\b/i,
  /\bfavo(?:u)?rite\b/i,
  /\bavoid\b/i,
  /\bskip\b/i,
  /\bwithout\b/i,
  /\ballergic\b/i,
  /\border\b/i,
  /\bget the\b/i,
  /\bno onions?\b/i,
  /\bno mayo\b/i,
  /\bkhong thich\b/i,
  /\bthich\b/i,
  /\bghet\b/i,
  /\bkhong an\b/i,
  /\bkhong uong\b/i,
  /\bdung goi\b/i,
  /\btranh\b/i,
];

function normalizeForMatching(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizePlaceName(value: string | null | undefined) {
  const normalized = normalizeForMatching(value);
  return normalized || null;
}

function getRoundedCoordinate(value: number) {
  return Number.isFinite(value) ? value.toFixed(PLACE_COORDINATE_PRECISION) : '0.0000';
}

function getReminderTimestamp(note: Pick<Note, 'createdAt' | 'updatedAt'>) {
  const timestamp = new Date(note.updatedAt ?? note.createdAt ?? 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getUsableTextContent(note: Pick<Note, 'type' | 'content'>) {
  if (note.type !== 'text') {
    return '';
  }

  return typeof note.content === 'string' ? note.content.trim() : '';
}

export function hasPreferenceSignal(note: Pick<Note, 'type' | 'content'>) {
  const normalizedContent = normalizeForMatching(getUsableTextContent(note));
  if (!normalizedContent) {
    return false;
  }

  return PREFERENCE_SIGNAL_PATTERNS.some((pattern) => pattern.test(normalizedContent));
}

export function getReminderPlaceKey(note: Pick<Note, 'locationName' | 'latitude' | 'longitude'>) {
  const locationKey = normalizePlaceName(note.locationName);
  const latitudeKey = getRoundedCoordinate(note.latitude);
  const longitudeKey = getRoundedCoordinate(note.longitude);

  if (locationKey) {
    return `${locationKey}:${latitudeKey}:${longitudeKey}`;
  }

  return `${latitudeKey}:${longitudeKey}`;
}

function getReminderTier(note: Note) {
  const usableText = getUsableTextContent(note);
  if (usableText) {
    return hasPreferenceSignal(note) ? 3 : 2;
  }

  return note.type === 'photo' ? 1 : 0;
}

export function compareReminderNotes(a: Note, b: Note) {
  const tierDelta = getReminderTier(b) - getReminderTier(a);
  if (tierDelta !== 0) {
    return tierDelta;
  }

  const timestampDelta = getReminderTimestamp(b) - getReminderTimestamp(a);
  if (timestampDelta !== 0) {
    return timestampDelta;
  }

  const favoriteDelta = Number(Boolean(b.isFavorite)) - Number(Boolean(a.isFavorite));
  if (favoriteDelta !== 0) {
    return favoriteDelta;
  }

  return a.id.localeCompare(b.id);
}

export function selectBestReminderNote(notes: Note[]) {
  if (notes.length === 0) {
    return null;
  }

  return [...notes].sort(compareReminderNotes)[0] ?? null;
}

export function getReminderPlaceGroups(notes: Note[]): ReminderPlaceGroup[] {
  const groups = new Map<string, Note[]>();

  for (const note of notes) {
    const key = getReminderPlaceKey(note);
    const existing = groups.get(key);
    if (existing) {
      existing.push(note);
      continue;
    }

    groups.set(key, [note]);
  }

  return Array.from(groups.entries())
    .map(([key, groupNotes]) => {
      const sortedNotes = [...groupNotes].sort(compareReminderNotes);
      const representativeNote = sortedNotes[0];
      const normalizedLocationName =
        representativeNote.locationName?.trim() ||
        groupNotes.find((note) => note.locationName?.trim())?.locationName?.trim() ||
        null;

      return {
        key,
        notes: sortedNotes,
        representativeNote,
        bestNote: representativeNote,
        locationName: normalizedLocationName,
        latitude: representativeNote.latitude,
        longitude: representativeNote.longitude,
      };
    })
    .sort((a, b) => compareReminderNotes(a.representativeNote, b.representativeNote));
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

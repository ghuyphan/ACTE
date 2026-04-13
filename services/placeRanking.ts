import { normalizeForMatching, normalizePlaceName } from './textNormalization';

type PlaceRankingNoteType = 'text' | 'photo';

export interface PlaceRankingCandidate {
  id: string;
  type: PlaceRankingNoteType;
  content: string;
  locationName: string | null;
  latitude: number;
  longitude: number;
  radius: number | null;
  isFavorite?: boolean;
  hasDoodle?: boolean;
  hasStickers?: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface PlaceRankingGroup<T extends PlaceRankingCandidate> {
  key: string;
  notes: T[];
  representativeNote: T;
  bestReminderNote: T;
  bestWidgetNote: T;
  locationName: string | null;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

const PLACE_COORDINATE_PRECISION = 4;
const STRONG_PREFERENCE_SIGNAL_PATTERNS = [
  /\bdoesn'?t like\b/i,
  /\bdislikes?\b/i,
  /\bprefer(?:s|red)?\b/i,
  /\bavoid\b/i,
  /\bskip\b/i,
  /\bwithout\b/i,
  /\ballergic\b/i,
  /\border\b/i,
  /\bget the\b/i,
  /\bno onions?\b/i,
  /\bno mayo\b/i,
  /\bkhong thich\b/i,
  /\bkhong an\b/i,
  /\bkhong uong\b/i,
  /\bdung goi\b/i,
  /\btranh\b/i,
];
const MEDIUM_PREFERENCE_SIGNAL_PATTERNS = [
  /\blikes?\b/i,
  /\bfavo(?:u)?rite\b/i,
  /\bthich\b/i,
  /\bghet\b/i,
];

function getRoundedCoordinate(value: number) {
  return Number.isFinite(value) ? value.toFixed(PLACE_COORDINATE_PRECISION) : '0.0000';
}

function getSelectionTimestamp(note: Pick<PlaceRankingCandidate, 'createdAt' | 'updatedAt'>) {
  const timestamp = new Date(note.updatedAt ?? note.createdAt ?? 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getUsableTextContent(note: Pick<PlaceRankingCandidate, 'type' | 'content'>) {
  if (note.type !== 'text') {
    return '';
  }

  return typeof note.content === 'string' ? note.content.trim() : '';
}

export function getReminderSignalStrength(note: Pick<PlaceRankingCandidate, 'type' | 'content'>) {
  const normalizedContent = normalizeForMatching(getUsableTextContent(note));
  if (!normalizedContent) {
    return 0;
  }

  if (STRONG_PREFERENCE_SIGNAL_PATTERNS.some((pattern) => pattern.test(normalizedContent))) {
    return 2;
  }

  if (MEDIUM_PREFERENCE_SIGNAL_PATTERNS.some((pattern) => pattern.test(normalizedContent))) {
    return 1;
  }

  return 0;
}

export function getReminderUtilityTier(
  note: Pick<PlaceRankingCandidate, 'type' | 'content'>
) {
  const usableText = getUsableTextContent(note);
  if (usableText) {
    const signalStrength = getReminderSignalStrength(note);
    if (signalStrength >= 2) {
      return 4;
    }

    if (signalStrength === 1) {
      return 3;
    }

    return 2;
  }

  return note.type === 'photo' ? 1 : 0;
}

export function compareByReminderUtility<
  T extends Pick<PlaceRankingCandidate, 'id' | 'type' | 'content' | 'createdAt' | 'updatedAt' | 'isFavorite'>
>(left: T, right: T) {
  const utilityDelta = getReminderUtilityTier(right) - getReminderUtilityTier(left);
  if (utilityDelta !== 0) {
    return utilityDelta;
  }

  const timestampDelta = getSelectionTimestamp(right) - getSelectionTimestamp(left);
  if (timestampDelta !== 0) {
    return timestampDelta;
  }

  const favoriteDelta = Number(Boolean(right.isFavorite)) - Number(Boolean(left.isFavorite));
  if (favoriteDelta !== 0) {
    return favoriteDelta;
  }

  return left.id.localeCompare(right.id);
}

export function getWidgetVisualPriority(
  note: Pick<PlaceRankingCandidate, 'type' | 'hasDoodle' | 'hasStickers'>
) {
  if (note.type === 'photo') {
    return 3;
  }

  if (note.hasStickers) {
    return 2;
  }

  if (note.hasDoodle) {
    return 1;
  }

  return 0;
}

export function compareByWidgetSurface<
  T extends Pick<
    PlaceRankingCandidate,
    'id' | 'type' | 'content' | 'createdAt' | 'updatedAt' | 'isFavorite' | 'hasDoodle' | 'hasStickers'
  >
>(left: T, right: T) {
  const visualPriorityDelta = getWidgetVisualPriority(right) - getWidgetVisualPriority(left);
  if (visualPriorityDelta !== 0) {
    return visualPriorityDelta;
  }

  return compareByReminderUtility(left, right);
}

export function getPlaceKey(
  note: Pick<PlaceRankingCandidate, 'locationName' | 'latitude' | 'longitude'>
) {
  const locationKey = normalizePlaceName(note.locationName);
  const latitudeKey = getRoundedCoordinate(note.latitude);
  const longitudeKey = getRoundedCoordinate(note.longitude);

  if (locationKey) {
    return `${locationKey}:${latitudeKey}:${longitudeKey}`;
  }

  return `${latitudeKey}:${longitudeKey}`;
}

function getPlaceRadius<T extends Pick<PlaceRankingCandidate, 'radius'>>(notes: T[]) {
  return Math.max(
    1,
    ...notes.map((note) => {
      const radius = note.radius ?? 0;
      return Number.isFinite(radius) ? radius : 0;
    })
  );
}

export function getPlaceGroups<T extends PlaceRankingCandidate>(notes: T[]): PlaceRankingGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const note of notes) {
    const key = getPlaceKey(note);
    const existing = groups.get(key);
    if (existing) {
      existing.push(note);
      continue;
    }

    groups.set(key, [note]);
  }

  return Array.from(groups.entries())
    .map(([key, groupNotes]) => {
      const reminderSortedNotes = [...groupNotes].sort(compareByReminderUtility);
      const widgetSortedNotes = [...groupNotes].sort(compareByWidgetSurface);
      const representativeNote = reminderSortedNotes[0];
      const normalizedLocationName =
        representativeNote.locationName?.trim() ||
        groupNotes.find((note) => note.locationName?.trim())?.locationName?.trim() ||
        null;

      return {
        key,
        notes: reminderSortedNotes,
        representativeNote,
        bestReminderNote: representativeNote,
        bestWidgetNote: widgetSortedNotes[0] ?? representativeNote,
        locationName: normalizedLocationName,
        latitude: representativeNote.latitude,
        longitude: representativeNote.longitude,
        radiusMeters: getPlaceRadius(groupNotes),
      };
    })
    .sort((left, right) => compareByReminderUtility(left.bestReminderNote, right.bestReminderNote));
}

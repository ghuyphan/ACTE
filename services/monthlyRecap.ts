import type { Note } from './database';
import {
  parseStoredStickerPlacements,
  type StickerRenderMode,
} from './stickerPlacementPayload';

export type MonthlyRecapObjectKind = 'postcard' | 'polaroid' | 'stamp';

export interface MonthlyRecapMonth {
  year: number;
  month: number;
  monthKey: string;
  label: string;
  timeZone: string;
  start: Date;
  endExclusive: Date;
}

export interface MonthlyRecapMonthEntry {
  monthDate: Date;
  monthKey: string;
  notes: Note[];
}

export interface MonthlyRecapObject {
  id: string;
  kind: MonthlyRecapObjectKind;
  noteId: string;
  createdAt: string;
  title: string;
  subtitle: string | null;
  noteCount: number;
  noteIds: string[];
  placeKey: string | null;
}

export interface MonthlyRecapDay {
  dateKey: string;
  dayOfMonth: number;
  weekdayIndex: number;
  noteCount: number;
  stampCount: number;
  overflowCount: number;
  markerKind: MonthlyRecapObjectKind | null;
  primaryObject: MonthlyRecapObject | null;
  noteIds: string[];
  hasPhoto: boolean;
  hasDecorations: boolean;
}

export interface MonthlyRecapPlaceGroup {
  key: string;
  locationName: string | null;
  latitude: number;
  longitude: number;
  notes: Note[];
  representativeNote: Note;
  postcard: MonthlyRecapObject;
}

export interface MonthlyRecapHighlightItem {
  id: string;
  kind: 'postcard' | 'polaroid';
  noteId: string;
  createdAt: string;
  title: string;
  subtitle: string | null;
  noteCount: number;
  noteIds: string[];
  placeKey: string | null;
}

export interface MonthlyRecapHeroPostcard extends MonthlyRecapHighlightItem {
  kind: 'postcard';
}

export interface MonthlyRecapStats {
  noteCount: number;
  textNoteCount: number;
  photoNoteCount: number;
  favoriteCount: number;
  placeCount: number;
  dayCount: number;
  decoratedCount: number;
}

export interface MonthlyRecapStickerUsage {
  assetId: string;
  count: number;
  previewUri: string;
  mimeType: string;
  assetWidth: number;
  assetHeight: number;
  outlineEnabled: boolean;
  renderMode: StickerRenderMode;
}

export interface MonthlyRecap {
  month: MonthlyRecapMonth;
  stats: MonthlyRecapStats;
  days: MonthlyRecapDay[];
  placeGroups: MonthlyRecapPlaceGroup[];
  highlights: MonthlyRecapHighlightItem[];
  heroPostcard: MonthlyRecapHeroPostcard | null;
  objects: MonthlyRecapObject[];
  stickerUsage: MonthlyRecapStickerUsage[];
}

export interface MonthlyRecapOptions {
  year: number;
  month: number;
  timeZone?: string;
}

export interface CachedMonthlyRecapEntry {
  digest: string;
  recap: MonthlyRecap;
}

export interface BuildRecapMonthEntriesOptions {
  timeZone?: string;
  monthWindow?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_INDEX_BY_LABEL: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

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
  return Number.isFinite(value) ? value.toFixed(4) : '0.0000';
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(values.year ?? 1970);
  const month = Number(values.month ?? 1);
  const day = Number(values.day ?? 1);
  const hour = Number(values.hour ?? 0);
  const minute = Number(values.minute ?? 0);
  const second = Number(values.second ?? 0);

  return Date.UTC(year, month - 1, day, hour, minute, second) - date.getTime();
}

function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0
) {
  const baseUtc = Date.UTC(year, month, day, hour, minute, second, millisecond);
  let utcMillis = baseUtc;

  for (let index = 0; index < 4; index += 1) {
    const offset = getTimeZoneOffsetMs(new Date(utcMillis), timeZone);
    const nextUtcMillis = baseUtc - offset;
    if (nextUtcMillis === utcMillis) {
      break;
    }

    utcMillis = nextUtcMillis;
  }

  return new Date(utcMillis);
}

function getZonedDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year ?? 1970),
    month: Number(values.month ?? 1),
    day: Number(values.day ?? 1),
    weekdayIndex: WEEKDAY_INDEX_BY_LABEL[String(values.weekday ?? 'Sun')] ?? 0,
  };
}

function getDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function getMonthIndex(year: number, month: number) {
  return year * 12 + month;
}

function getMonthKeyFromParts(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function hashDigestValue(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16);
}

function getNoteTimestamp(note: Pick<Note, 'createdAt'>) {
  const timestamp = new Date(note.createdAt ?? 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getNotePlaceKey(note: Pick<Note, 'locationName' | 'latitude' | 'longitude'>) {
  const locationKey = normalizePlaceName(note.locationName);
  const latitudeKey = getRoundedCoordinate(note.latitude);
  const longitudeKey = getRoundedCoordinate(note.longitude);

  if (locationKey) {
    return `${locationKey}:${latitudeKey}:${longitudeKey}`;
  }

  return `${latitudeKey}:${longitudeKey}`;
}

function hasDecoration(note: Pick<Note, 'hasDoodle' | 'hasStickers'>) {
  return Boolean(note.hasDoodle || note.hasStickers);
}

function getObjectTitle(note: Pick<Note, 'type' | 'locationName' | 'content'>) {
  if (note.locationName?.trim()) {
    return note.locationName.trim();
  }

  if (note.type === 'photo') {
    return 'Photo memory';
  }

  const text = typeof note.content === 'string' ? note.content.trim() : '';
  return text || 'Memory';
}

function getObjectSubtitle(note: Pick<Note, 'type' | 'locationName' | 'content'>) {
  if (note.type === 'photo') {
    return 'Polaroid';
  }

  if (note.locationName?.trim()) {
    return 'Postcard';
  }

  return 'Postcard';
}

function buildObjectId(prefix: string, noteId: string) {
  return `${prefix}:${noteId}`;
}

function buildRecapObject(note: Note): MonthlyRecapObject {
  const kind: MonthlyRecapObjectKind = note.type === 'photo' ? 'polaroid' : 'postcard';
  return {
    id: buildObjectId(kind, note.id),
    kind,
    noteId: note.id,
    createdAt: note.createdAt,
    title: getObjectTitle(note),
    subtitle: getObjectSubtitle(note),
    noteCount: 1,
    noteIds: [note.id],
    placeKey: getNotePlaceKey(note),
  };
}

function compareNotesForRecap(a: Note, b: Note) {
  const favoriteDelta = Number(Boolean(b.isFavorite)) - Number(Boolean(a.isFavorite));
  if (favoriteDelta !== 0) {
    return favoriteDelta;
  }

  const timestampDelta = getNoteTimestamp(b) - getNoteTimestamp(a);
  if (timestampDelta !== 0) {
    return timestampDelta;
  }

  return a.id.localeCompare(b.id);
}

export function getMonthRange(year: number, month: number, timeZone = 'UTC'): MonthlyRecapMonth {
  const start = zonedTimeToUtc(year, month, 1, timeZone);
  const endExclusive = zonedTimeToUtc(year, month + 1, 1, timeZone);
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'long',
    year: 'numeric',
  }).format(start);

  return {
    year,
    month,
    monthKey: `${year}-${String(month + 1).padStart(2, '0')}`,
    label,
    timeZone,
    start,
    endExclusive,
  };
}

export function getRecapMonthKeyForDate(date: Date, timeZone = 'UTC') {
  const { year, month } = getZonedDateParts(date, timeZone);
  return getMonthKeyFromParts(year, month - 1);
}

export function buildMonthlyRecapDigest(notes: Note[]) {
  const normalizedNotes = [...notes].sort(compareNotesForRecap);
  const digestSource = normalizedNotes
    .map((note) =>
      [
        note.id,
        note.type,
        note.content,
        note.photoLocalUri ?? '',
        note.photoSyncedLocalUri ?? '',
        note.photoRemoteBase64 ?? '',
        note.isLivePhoto ? '1' : '0',
        note.pairedVideoLocalUri ?? '',
        note.pairedVideoSyncedLocalUri ?? '',
        note.pairedVideoRemotePath ?? '',
        note.locationName ?? '',
        note.promptId ?? '',
        note.promptTextSnapshot ?? '',
        note.promptAnswer ?? '',
        note.moodEmoji ?? '',
        note.noteColor ?? '',
        String(note.latitude),
        String(note.longitude),
        String(note.radius),
        note.isFavorite ? '1' : '0',
        note.hasDoodle ? '1' : '0',
        note.doodleStrokesJson ?? '',
        note.hasStickers ? '1' : '0',
        note.stickerPlacementsJson ?? '',
        note.createdAt,
        note.updatedAt ?? '',
      ].join('\u001f')
    )
    .join('\u001e');

  return `${normalizedNotes.length}:${hashDigestValue(digestSource)}`;
}

export function buildRecapMonthEntries(
  notes: Note[],
  options: BuildRecapMonthEntriesOptions = {}
): MonthlyRecapMonthEntry[] {
  const timeZone = options.timeZone ?? 'UTC';
  const monthWindow = Math.max(options.monthWindow ?? 12, 1);
  let latestMonthIndex: number | null = null;
  let earliestMonthIndex: number | null = null;
  const notesByMonth = new Map<string, Note[]>();

  for (const note of notes) {
    const timestamp = new Date(note.createdAt);
    if (Number.isNaN(timestamp.getTime())) {
      continue;
    }

    const { year, month } = getZonedDateParts(timestamp, timeZone);
    const monthIndex = getMonthIndex(year, month - 1);
    const monthKey = getMonthKeyFromParts(year, month - 1);
    const existingMonthNotes = notesByMonth.get(monthKey);

    if (existingMonthNotes) {
      existingMonthNotes.push(note);
    } else {
      notesByMonth.set(monthKey, [note]);
    }

    if (latestMonthIndex === null || monthIndex > latestMonthIndex) {
      latestMonthIndex = monthIndex;
    }

    if (earliestMonthIndex === null || monthIndex < earliestMonthIndex) {
      earliestMonthIndex = monthIndex;
    }
  }

  if (latestMonthIndex === null || earliestMonthIndex === null) {
    return [];
  }

  const minimumWindowStart = latestMonthIndex - (monthWindow - 1);
  const firstMonthIndex = Math.min(earliestMonthIndex, minimumWindowStart);
  const months: MonthlyRecapMonthEntry[] = [];

  for (let monthIndex = latestMonthIndex; monthIndex >= firstMonthIndex; monthIndex -= 1) {
    const year = Math.floor(monthIndex / 12);
    const month = monthIndex - year * 12;
    const monthKey = getMonthKeyFromParts(year, month);

    months.push({
      monthDate: new Date(year, month, 1),
      monthKey,
      notes: notesByMonth.get(monthKey) ?? [],
    });
  }

  return months;
}

export function getNotesForMonth(notes: Note[], range: MonthlyRecapMonth) {
  const startTime = range.start.getTime();
  const endTime = range.endExclusive.getTime();

  return notes.filter((note) => {
    const timestamp = getNoteTimestamp(note);
    return timestamp >= startTime && timestamp < endTime;
  });
}

function buildMonthObjectsFromScopedNotes(scopedNotes: Note[]): MonthlyRecapObject[] {
  return [...scopedNotes].sort(compareNotesForRecap).map((note) => buildRecapObject(note));
}

export function buildMonthObjects(notes: Note[], range?: MonthlyRecapMonth): MonthlyRecapObject[] {
  const scopedNotes = range ? getNotesForMonth(notes, range) : notes;
  return buildMonthObjectsFromScopedNotes(scopedNotes);
}

function getMonthPlaceGroupsFromScopedNotes(scopedNotes: Note[]): MonthlyRecapPlaceGroup[] {
  const groups = new Map<string, Note[]>();

  for (const note of scopedNotes) {
    const key = getNotePlaceKey(note);
    const existing = groups.get(key);
    if (existing) {
      existing.push(note);
      continue;
    }

    groups.set(key, [note]);
  }

  return Array.from(groups.entries())
    .map(([key, groupNotes]) => {
      const sortedNotes = [...groupNotes].sort(compareNotesForRecap);
      const representativeNote = sortedNotes[0];
      return {
        key,
        locationName:
          representativeNote.locationName?.trim() ||
          groupNotes.find((note) => note.locationName?.trim())?.locationName?.trim() ||
          null,
        latitude: representativeNote.latitude,
        longitude: representativeNote.longitude,
        notes: sortedNotes,
        representativeNote,
        postcard: {
          ...buildRecapObject(representativeNote),
          subtitle: representativeNote.locationName?.trim() || 'Postcard',
          noteCount: sortedNotes.length,
          noteIds: sortedNotes.map((note) => note.id),
          placeKey: key,
        } satisfies MonthlyRecapObject,
      };
    })
    .sort((a, b) => {
      const countDelta = b.notes.length - a.notes.length;
      if (countDelta !== 0) {
        return countDelta;
      }

      const timestampDelta = getNoteTimestamp(b.representativeNote) - getNoteTimestamp(a.representativeNote);
      if (timestampDelta !== 0) {
        return timestampDelta;
      }

      return a.key.localeCompare(b.key);
    });
}

export function getMonthPlaceGroups(notes: Note[], range?: MonthlyRecapMonth): MonthlyRecapPlaceGroup[] {
  const scopedNotes = range ? getNotesForMonth(notes, range) : notes;
  return getMonthPlaceGroupsFromScopedNotes(scopedNotes);
}

function getMonthHighlightsFromScopedNotes(scopedNotes: Note[]) {
  const placeGroups = getMonthPlaceGroupsFromScopedNotes(scopedNotes);
  const highlights: MonthlyRecapHighlightItem[] = [];

  for (const group of placeGroups.slice(0, 3)) {
    const representative = group.representativeNote;
    highlights.push({
      id: `highlight:postcard:${group.key}`,
      kind: 'postcard',
      noteId: representative.id,
      createdAt: representative.createdAt,
      title: group.locationName || getObjectTitle(representative),
      subtitle: `${group.notes.length} note${group.notes.length === 1 ? '' : 's'}`,
      noteCount: group.notes.length,
      noteIds: group.notes.map((note) => note.id),
      placeKey: group.key,
    });
  }

  const photoNotes = scopedNotes
    .filter((note) => note.type === 'photo')
    .sort(compareNotesForRecap);

  const usedNoteIds = new Set(highlights.flatMap((highlight) => highlight.noteIds));

  for (const note of photoNotes) {
    if (usedNoteIds.has(note.id)) {
      continue;
    }

    highlights.push({
      id: `highlight:polaroid:${note.id}`,
      kind: 'polaroid',
      noteId: note.id,
      createdAt: note.createdAt,
      title: getObjectTitle(note),
      subtitle: note.locationName?.trim() || 'Photo memory',
      noteCount: 1,
      noteIds: [note.id],
      placeKey: getNotePlaceKey(note),
    });

    if (highlights.length >= 5) {
      break;
    }
  }

  return highlights
    .sort((a, b) => {
      const timestampDelta = getNoteTimestamp({ createdAt: b.createdAt }) - getNoteTimestamp({ createdAt: a.createdAt });
      if (timestampDelta !== 0) {
        return timestampDelta;
      }

      return a.id.localeCompare(b.id);
    })
    .slice(0, 5);
}

export function getMonthHighlights(notes: Note[], range?: MonthlyRecapMonth) {
  const scopedNotes = range ? getNotesForMonth(notes, range) : notes;
  return getMonthHighlightsFromScopedNotes(scopedNotes);
}

function buildMonthDayBucketsFromScopedNotes(notes: Note[], range: MonthlyRecapMonth) {
  const daysInMonth = getDaysInMonth(range.year, range.month);
  const notesByDay = new Map<number, Note[]>();

  for (const note of notes) {
    const timestamp = new Date(note.createdAt);
    if (Number.isNaN(timestamp.getTime())) {
      continue;
    }

    const { day } = getZonedDateParts(timestamp, range.timeZone);
    const existing = notesByDay.get(day);
    if (existing) {
      existing.push(note);
      continue;
    }

    notesByDay.set(day, [note]);
  }

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const dayNotes = [...(notesByDay.get(day) ?? [])].sort(compareNotesForRecap);
    const firstNote = dayNotes[0] ?? null;
    const dayStart = zonedTimeToUtc(range.year, range.month, day, range.timeZone);
    const { weekdayIndex } = getZonedDateParts(dayStart, range.timeZone);
    const dateKey = `${range.year}-${String(range.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    return {
      dateKey,
      dayOfMonth: day,
      weekdayIndex,
      noteCount: dayNotes.length,
      stampCount: Math.min(dayNotes.length, 3),
      overflowCount: Math.max(0, dayNotes.length - 3),
      markerKind: dayNotes.length > 0 ? ('stamp' as const) : null,
      primaryObject: firstNote ? buildRecapObject(firstNote) : null,
      noteIds: dayNotes.map((note) => note.id),
      hasPhoto: dayNotes.some((note) => note.type === 'photo'),
      hasDecorations: dayNotes.some((note) => hasDecoration(note)),
    };
  });
}

export function buildMonthDayBuckets(notes: Note[], range: MonthlyRecapMonth) {
  const scopedNotes = getNotesForMonth(notes, range);
  return buildMonthDayBucketsFromScopedNotes(scopedNotes, range);
}

function getMonthStatsFromScopedNotes(scopedNotes: Note[], range?: MonthlyRecapMonth): MonthlyRecapStats {
  const dayKeys = new Set<string>();
  const placeKeys = new Set<string>();

  for (const note of scopedNotes) {
    placeKeys.add(getNotePlaceKey(note));
    const timestamp = new Date(note.createdAt);
    if (!Number.isNaN(timestamp.getTime())) {
      if (range) {
        const { year, month, day } = getZonedDateParts(timestamp, range.timeZone);
        dayKeys.add(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      } else {
        dayKeys.add(timestamp.toISOString().slice(0, 10));
      }
    }
  }

  return {
    noteCount: scopedNotes.length,
    textNoteCount: scopedNotes.filter((note) => note.type === 'text').length,
    photoNoteCount: scopedNotes.filter((note) => note.type === 'photo').length,
    favoriteCount: scopedNotes.filter((note) => note.isFavorite).length,
    placeCount: placeKeys.size,
    dayCount: dayKeys.size,
    decoratedCount: scopedNotes.filter((note) => hasDecoration(note)).length,
  };
}

export function getMonthStats(notes: Note[], range?: MonthlyRecapMonth): MonthlyRecapStats {
  const scopedNotes = range ? getNotesForMonth(notes, range) : notes;
  return getMonthStatsFromScopedNotes(scopedNotes, range);
}

function getMonthStickerUsageFromScopedNotes(scopedNotes: Note[]): MonthlyRecapStickerUsage[] {
  const usageByAssetId = new Map<
    string,
    MonthlyRecapStickerUsage & {
      stampCount: number;
    }
  >();

  for (const note of scopedNotes) {
    for (const placement of parseStoredStickerPlacements(note.stickerPlacementsJson)) {
      const previewUri = placement.asset.localUri;
      if (!previewUri) {
        continue;
      }

      const existing = usageByAssetId.get(placement.assetId);
      if (existing) {
        existing.count += 1;
        existing.stampCount += placement.renderMode === 'stamp' ? 1 : 0;
        existing.outlineEnabled = existing.outlineEnabled || placement.outlineEnabled !== false;
        continue;
      }

      usageByAssetId.set(placement.assetId, {
        assetId: placement.assetId,
        count: 1,
        previewUri,
        mimeType: placement.asset.mimeType,
        assetWidth: Math.max(placement.asset.width ?? 100, 1),
        assetHeight: Math.max(placement.asset.height ?? 100, 1),
        outlineEnabled: placement.outlineEnabled !== false,
        renderMode: placement.renderMode === 'stamp' ? 'stamp' : 'default',
        stampCount: placement.renderMode === 'stamp' ? 1 : 0,
      });
    }
  }

  return Array.from(usageByAssetId.values())
    .map(({ stampCount, ...usage }) => ({
      ...usage,
      renderMode: (stampCount >= usage.count / 2 ? 'stamp' : 'default') as StickerRenderMode,
    }))
    .sort((left, right) => {
      const countDelta = right.count - left.count;
      if (countDelta !== 0) {
        return countDelta;
      }

      return left.assetId.localeCompare(right.assetId);
    });
}

export function getMonthStickerUsage(notes: Note[], range?: MonthlyRecapMonth): MonthlyRecapStickerUsage[] {
  const scopedNotes = range ? getNotesForMonth(notes, range) : notes;
  return getMonthStickerUsageFromScopedNotes(scopedNotes);
}

export function buildMonthlyRecapFromScopedNotes(
  scopedNotes: Note[],
  options: MonthlyRecapOptions
): MonthlyRecap {
  const timeZone = options.timeZone ?? 'UTC';
  const month = getMonthRange(options.year, options.month, timeZone);
  const placeGroups = getMonthPlaceGroupsFromScopedNotes(scopedNotes);
  const days = buildMonthDayBucketsFromScopedNotes(scopedNotes, month);
  const highlights = getMonthHighlightsFromScopedNotes(scopedNotes);
  const objects = buildMonthObjectsFromScopedNotes(scopedNotes);
  const stats = getMonthStatsFromScopedNotes(scopedNotes, month);
  const stickerUsage = getMonthStickerUsageFromScopedNotes(scopedNotes);
  const heroPostcard = (highlights.find((highlight) => highlight.kind === 'postcard') ?? null) as MonthlyRecapHeroPostcard | null;

  return {
    month,
    stats,
    days,
    placeGroups,
    highlights,
    heroPostcard,
    objects,
    stickerUsage,
  };
}

export function buildMonthlyRecap(notes: Note[], options: MonthlyRecapOptions): MonthlyRecap {
  const timeZone = options.timeZone ?? 'UTC';
  const month = getMonthRange(options.year, options.month, timeZone);
  const scopedNotes = getNotesForMonth(notes, month);

  return buildMonthlyRecapFromScopedNotes(scopedNotes, options);
}

export function serializeMonthlyRecap(recap: MonthlyRecap): string {
  return JSON.stringify({
    ...recap,
    month: {
      ...recap.month,
      start: recap.month.start.toISOString(),
      endExclusive: recap.month.endExclusive.toISOString(),
    },
  });
}

export function deserializeMonthlyRecap(payload: string): MonthlyRecap | null {
  try {
    const parsed = JSON.parse(payload) as MonthlyRecap & {
      month: MonthlyRecapMonth & {
        start: string;
        endExclusive: string;
      };
    };

    return {
      ...parsed,
      month: {
        ...parsed.month,
        start: new Date(parsed.month.start),
        endExclusive: new Date(parsed.month.endExclusive),
      },
    };
  } catch {
    return null;
  }
}

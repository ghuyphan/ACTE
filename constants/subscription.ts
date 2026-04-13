import { Platform } from 'react-native';

export type PlanTier = 'free' | 'plus';

export const FREE_PHOTO_NOTE_LIMIT = 5;
export const PLUS_PHOTO_NOTE_LIMIT = null;

export const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '';
export const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '';
export const REVENUECAT_PRO_ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ??
  process.env.EXPO_PUBLIC_REVENUECAT_PLUS_ENTITLEMENT_ID ??
  'Noto Pro';
export const REVENUECAT_OFFERING_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_OFFERING_ID ??
  process.env.EXPO_PUBLIC_REVENUECAT_PLUS_OFFERING_ID ??
  'default';

// Backward-compatible aliases for older app code that still uses "plus" naming.
export const REVENUECAT_PLUS_ENTITLEMENT_ID = REVENUECAT_PRO_ENTITLEMENT_ID;
export const REVENUECAT_PLUS_OFFERING_ID = REVENUECAT_OFFERING_ID;
const REVENUECAT_PLACEHOLDER_API_KEYS = new Set([
  'appl_mock_replace_me',
  'goog_mock_replace_me',
]);

export function getRevenueCatApiKey(platformOS = Platform.OS) {
  if (platformOS === 'ios') {
    return REVENUECAT_IOS_API_KEY;
  }

  if (platformOS === 'android') {
    return REVENUECAT_ANDROID_API_KEY;
  }

  return '';
}

export function isRevenueCatConfigured(platformOS = Platform.OS) {
  const apiKey = getRevenueCatApiKey(platformOS).trim();
  return apiKey.length > 0 && !REVENUECAT_PLACEHOLDER_API_KEYS.has(apiKey);
}

export function getPhotoNoteLimitForTier(tier: PlanTier) {
  return tier === 'plus' ? PLUS_PHOTO_NOTE_LIMIT : FREE_PHOTO_NOTE_LIMIT;
}

export function countPhotoNotes<T extends { type: string }>(notes: T[]) {
  return notes.filter((note) => note.type === 'photo').length;
}

export function getLocalPhotoUsageDateKey(now = new Date()) {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameLocalCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function countPhotoNotesCreatedOnDay<T extends { type: string; createdAt?: string | null }>(
  notes: T[],
  day = new Date()
) {
  return notes.filter((note) => {
    if (note.type !== 'photo' || !note.createdAt) {
      return false;
    }

    const createdAt = new Date(note.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      return false;
    }

    return isSameLocalCalendarDay(createdAt, day);
  }).length;
}

export function countPhotoNotesCreatedToday<T extends { type: string; createdAt?: string | null }>(
  notes: T[],
  now = new Date()
) {
  return countPhotoNotesCreatedOnDay(notes, now);
}

export function canCreatePhotoNote(tier: PlanTier, photoNoteCount: number) {
  const limit = getPhotoNoteLimitForTier(tier);
  return limit === null || photoNoteCount < limit;
}

export function getRemainingPhotoSlots(tier: PlanTier, photoNoteCount: number) {
  const limit = getPhotoNoteLimitForTier(tier);
  if (limit === null) {
    return null;
  }

  return Math.max(limit - photoNoteCount, 0);
}

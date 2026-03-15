import { Platform } from 'react-native';

export type PlanTier = 'free' | 'plus';

export const FREE_PHOTO_NOTE_LIMIT = 10;
export const PLUS_PHOTO_NOTE_LIMIT = null;

export const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '';
export const REVENUECAT_PLUS_ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_PLUS_ENTITLEMENT_ID ?? 'plus';
export const REVENUECAT_PLUS_OFFERING_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_PLUS_OFFERING_ID ?? '';

export function isRevenueCatConfigured(platformOS = Platform.OS) {
  return platformOS === 'ios' && REVENUECAT_IOS_API_KEY.trim().length > 0;
}

export function getPhotoNoteLimitForTier(tier: PlanTier) {
  return tier === 'plus' ? PLUS_PHOTO_NOTE_LIMIT : FREE_PHOTO_NOTE_LIMIT;
}

export function countPhotoNotes<T extends { type: string }>(notes: T[]) {
  return notes.filter((note) => note.type === 'photo').length;
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


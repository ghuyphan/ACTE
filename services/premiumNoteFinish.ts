import type { PlanTier } from '../constants/subscription';
import {
  DEFAULT_NOTE_COLOR_ID,
  getEditableTextNoteColor,
  getNoteColorPreset,
  getNoteColorFinish,
  isAppThemeDefaultNoteColor,
  isPremiumNoteColor,
  normalizeSavedTextNoteColor,
} from './noteAppearance';

export const HOLOGRAM_NOTE_COLOR_ID = 'holo-foil';
export const PREVIEWABLE_PREMIUM_NOTE_COLOR_IDS = [HOLOGRAM_NOTE_COLOR_ID];

export type PremiumNoteSaveDecision =
  | 'allow_save'
  | 'upsell_required'
  | 'preserve_existing_premium';

interface GetPremiumNoteSaveDecisionOptions {
  tier: PlanTier;
  selectedNoteColor?: string | null;
  existingNoteColor?: string | null;
}

export function isHologramNoteColor(noteColor?: string | null) {
  return getNoteColorFinish(noteColor) === 'holo';
}

export function isPreviewablePremiumNoteColor(noteColor?: string | null) {
  return typeof noteColor === 'string' && PREVIEWABLE_PREMIUM_NOTE_COLOR_IDS.includes(noteColor);
}

export function getPremiumNoteSaveDecision({
  tier,
  selectedNoteColor,
  existingNoteColor,
}: GetPremiumNoteSaveDecisionOptions): PremiumNoteSaveDecision {
  if (!isPremiumNoteColor(selectedNoteColor)) {
    return 'allow_save';
  }

  if (tier === 'plus') {
    return 'allow_save';
  }

  if (
    isPremiumNoteColor(existingNoteColor) &&
    normalizeSavedTextNoteColor(existingNoteColor) === normalizeSavedTextNoteColor(selectedNoteColor)
  ) {
    return 'preserve_existing_premium';
  }

  return 'upsell_required';
}

export function getFallbackFreeNoteColor(
  lastFreeNoteColor?: string | null,
  currentNoteColor?: string | null
) {
  if (lastFreeNoteColor == null || isAppThemeDefaultNoteColor(lastFreeNoteColor)) {
    return null;
  }

  if (typeof lastFreeNoteColor === 'string' && lastFreeNoteColor.trim()) {
    if (getNoteColorPreset(lastFreeNoteColor) && !isPremiumNoteColor(lastFreeNoteColor)) {
      return normalizeSavedTextNoteColor(lastFreeNoteColor);
    }

    if (!getNoteColorPreset(lastFreeNoteColor)) {
      const normalizedCurrent = getEditableTextNoteColor(currentNoteColor);
      if (normalizedCurrent == null) {
        return null;
      }

      return DEFAULT_NOTE_COLOR_ID;
    }
  }

  const normalizedCurrent = getEditableTextNoteColor(currentNoteColor);
  if (normalizedCurrent == null) {
    return null;
  }

  if (getNoteColorPreset(normalizedCurrent) && !isPremiumNoteColor(normalizedCurrent)) {
    return normalizeSavedTextNoteColor(normalizedCurrent);
  }

  return DEFAULT_NOTE_COLOR_ID;
}

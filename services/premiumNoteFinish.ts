import type { PlanTier } from '../constants/subscription';
import {
  DEFAULT_NOTE_COLOR_ID,
  getNoteColorPreset,
  getNoteColorFinish,
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
  if (!isHologramNoteColor(selectedNoteColor)) {
    return 'allow_save';
  }

  if (tier === 'plus') {
    return 'allow_save';
  }

  if (isHologramNoteColor(existingNoteColor)) {
    return 'preserve_existing_premium';
  }

  return 'upsell_required';
}

export function getFallbackFreeNoteColor(
  lastFreeNoteColor?: string | null,
  currentNoteColor?: string | null
) {
  if (typeof lastFreeNoteColor === 'string' && lastFreeNoteColor.trim()) {
    if (getNoteColorPreset(lastFreeNoteColor) && !isPremiumNoteColor(lastFreeNoteColor)) {
      return normalizeSavedTextNoteColor(lastFreeNoteColor);
    }

    if (!getNoteColorPreset(lastFreeNoteColor)) {
      return DEFAULT_NOTE_COLOR_ID;
    }
  }

  if (
    currentNoteColor &&
    getNoteColorPreset(currentNoteColor) &&
    !isPremiumNoteColor(currentNoteColor)
  ) {
    return normalizeSavedTextNoteColor(currentNoteColor);
  }

  return DEFAULT_NOTE_COLOR_ID;
}

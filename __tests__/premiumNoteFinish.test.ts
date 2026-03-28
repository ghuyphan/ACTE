import { DEFAULT_NOTE_COLOR_ID } from '../constants/noteColors';
import {
  HOLOGRAM_NOTE_COLOR_ID,
  getFallbackFreeNoteColor,
  getPremiumNoteSaveDecision,
  isHologramNoteColor,
  isPreviewablePremiumNoteColor,
} from '../services/premiumNoteFinish';

describe('premiumNoteFinish', () => {
  it('only treats the hologram finish as previewable premium content', () => {
    expect(isHologramNoteColor(HOLOGRAM_NOTE_COLOR_ID)).toBe(true);
    expect(isHologramNoteColor('aurora-rgb')).toBe(false);
    expect(isPreviewablePremiumNoteColor(HOLOGRAM_NOTE_COLOR_ID)).toBe(true);
    expect(isPreviewablePremiumNoteColor('chrome-rare')).toBe(false);
    expect(isPreviewablePremiumNoteColor(null)).toBe(false);
  });

  it('allows saves when the selected finish is not hologram gated', () => {
    expect(
      getPremiumNoteSaveDecision({
        tier: 'free',
        selectedNoteColor: 'sunset-coral',
      })
    ).toBe('allow_save');

    expect(
      getPremiumNoteSaveDecision({
        tier: 'free',
        selectedNoteColor: 'aurora-rgb',
      })
    ).toBe('allow_save');
  });

  it('requires an upsell when a free user selects hologram for a standard note', () => {
    expect(
      getPremiumNoteSaveDecision({
        tier: 'free',
        selectedNoteColor: HOLOGRAM_NOTE_COLOR_ID,
        existingNoteColor: 'jade-pop',
      })
    ).toBe('upsell_required');
  });

  it('preserves an existing hologram finish for free users editing old notes', () => {
    expect(
      getPremiumNoteSaveDecision({
        tier: 'free',
        selectedNoteColor: HOLOGRAM_NOTE_COLOR_ID,
        existingNoteColor: HOLOGRAM_NOTE_COLOR_ID,
      })
    ).toBe('preserve_existing_premium');

    expect(
      getPremiumNoteSaveDecision({
        tier: 'plus',
        selectedNoteColor: HOLOGRAM_NOTE_COLOR_ID,
        existingNoteColor: 'jade-pop',
      })
    ).toBe('allow_save');
  });

  it('falls back to the last known free color before using the default color', () => {
    expect(getFallbackFreeNoteColor('sunset-coral', HOLOGRAM_NOTE_COLOR_ID)).toBe('sunset-coral');
    expect(getFallbackFreeNoteColor('unknown-color', 'jade-pop')).toBe(DEFAULT_NOTE_COLOR_ID);
    expect(getFallbackFreeNoteColor('chrome-rare', 'jade-pop')).toBe('jade-pop');
    expect(getFallbackFreeNoteColor('chrome-rare', HOLOGRAM_NOTE_COLOR_ID)).toBe(DEFAULT_NOTE_COLOR_ID);
    expect(getFallbackFreeNoteColor(null, null)).toBe(DEFAULT_NOTE_COLOR_ID);
  });
});

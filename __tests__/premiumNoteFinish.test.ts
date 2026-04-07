import { getPremiumNoteSaveDecision } from '../services/premiumNoteFinish';

describe('premium note finish gating', () => {
  it('requires Plus for every premium finish on new free notes', () => {
    expect(
      getPremiumNoteSaveDecision({
        tier: 'free',
        selectedNoteColor: 'aurora-rgb',
      })
    ).toBe('upsell_required');
    expect(
      getPremiumNoteSaveDecision({
        tier: 'free',
        selectedNoteColor: 'holo-foil',
      })
    ).toBe('upsell_required');
    expect(
      getPremiumNoteSaveDecision({
        tier: 'free',
        selectedNoteColor: 'chrome-rare',
      })
    ).toBe('upsell_required');
  });

  it('lets free users keep the same premium finish they already own', () => {
    expect(
      getPremiumNoteSaveDecision({
        tier: 'free',
        existingNoteColor: 'aurora-rgb',
        selectedNoteColor: 'aurora-rgb',
      })
    ).toBe('preserve_existing_premium');
  });

  it('does not let free users switch between premium finishes', () => {
    expect(
      getPremiumNoteSaveDecision({
        tier: 'free',
        existingNoteColor: 'aurora-rgb',
        selectedNoteColor: 'chrome-rare',
      })
    ).toBe('upsell_required');
  });

  it('allows Plus users to save premium finishes', () => {
    expect(
      getPremiumNoteSaveDecision({
        tier: 'plus',
        selectedNoteColor: 'chrome-rare',
      })
    ).toBe('allow_save');
  });
});

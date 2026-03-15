import {
  FREE_PHOTO_NOTE_LIMIT,
  canCreatePhotoNote,
  countPhotoNotes,
  getPhotoNoteLimitForTier,
  getRemainingPhotoSlots,
} from '../constants/subscription';

describe('subscription photo rules', () => {
  it('counts only photo notes', () => {
    expect(
      countPhotoNotes([
        { type: 'photo' },
        { type: 'text' },
        { type: 'photo' },
      ])
    ).toBe(2);
  });

  it('enforces the free photo-note limit', () => {
    expect(getPhotoNoteLimitForTier('free')).toBe(FREE_PHOTO_NOTE_LIMIT);
    expect(canCreatePhotoNote('free', FREE_PHOTO_NOTE_LIMIT - 1)).toBe(true);
    expect(canCreatePhotoNote('free', FREE_PHOTO_NOTE_LIMIT)).toBe(false);
    expect(getRemainingPhotoSlots('free', FREE_PHOTO_NOTE_LIMIT - 2)).toBe(2);
  });

  it('keeps plus photo-note access effectively unlimited', () => {
    expect(getPhotoNoteLimitForTier('plus')).toBeNull();
    expect(canCreatePhotoNote('plus', 999)).toBe(true);
    expect(getRemainingPhotoSlots('plus', 999)).toBeNull();
  });
});

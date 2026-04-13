import {
  FREE_PHOTO_NOTE_LIMIT,
  canCreatePhotoNote,
  countPhotoNotes,
  countPhotoNotesCreatedOnDay,
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

  it('counts only photo notes created on the requested day', () => {
    expect(
      countPhotoNotesCreatedOnDay(
        [
          { type: 'photo', createdAt: '2026-04-13T01:00:00.000Z' },
          { type: 'photo', createdAt: '2026-04-13T22:30:00.000Z' },
          { type: 'photo', createdAt: '2026-04-12T23:59:59.000Z' },
          { type: 'text', createdAt: '2026-04-13T09:00:00.000Z' },
        ],
        new Date('2026-04-13T12:00:00.000Z')
      )
    ).toBe(2);
  });

  it('enforces the free daily photo-note limit', () => {
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

import {
  getCaptureNoteGradient,
  getGradientStickerMotionVariant,
  getNoteColorStickerMotion,
  getTextNoteCardGradient,
} from '../services/noteAppearance';

describe('noteAppearance', () => {
  it('keeps saved text-note gradients stable for the same note', () => {
    expect(getTextNoteCardGradient({ text: 'Ca phe ☕️', noteId: '1', emoji: '☕️' })).toEqual(
      getTextNoteCardGradient({ text: 'Ca phe ☕️', noteId: '1', emoji: '☕️' })
    );
  });

  it('lets emoji influence, but not fully replace, the saved card gradient', () => {
    expect(getTextNoteCardGradient({ text: 'Cafe note', noteId: '1', emoji: '☕️' })).not.toEqual(
      getTextNoteCardGradient({ text: 'Cafe note', noteId: '1', emoji: null })
    );
  });

  it('keeps the capture gradient fixed regardless of note content', () => {
    expect(getCaptureNoteGradient({ text: 'Just a quiet note' })).toEqual(
      getCaptureNoteGradient({ text: 'Different note', emoji: '🌿' })
    );
  });

  it('uses the configured marigold default gradient when no note color is selected', () => {
    expect(getCaptureNoteGradient({ text: 'Just a quiet note' })).toEqual(['#F6D365', '#FDA085']);
  });

  it('matches the capture gradient to the saved note gradient when a note color is selected', () => {
    expect(getCaptureNoteGradient({ noteColor: 'sunset-coral' })).toEqual(
      getTextNoteCardGradient({ text: 'Cafe note', noteId: '1', noteColor: 'sunset-coral' })
    );
  });

  it('falls back to a stable hashed gradient when no emoji palette matches', () => {
    expect(getTextNoteCardGradient({ text: 'Just a quiet note', noteId: 'note-123' })).toEqual(
      getTextNoteCardGradient({ text: 'Just a quiet note', noteId: 'note-123' })
    );
  });

  it('marks blue card gradients as water motion', () => {
    expect(
      getGradientStickerMotionVariant(getTextNoteCardGradient({
        text: 'Ocean day',
        noteId: 'note-water',
        noteColor: 'sky-blue',
      }))
    ).toBe('water');
  });

  it('exposes explicit water motion for blue preset cards', () => {
    expect(getNoteColorStickerMotion('sky-blue')).toBe('water');
    expect(getNoteColorStickerMotion('pool-teal')).toBe('water');
    expect(getNoteColorStickerMotion('periwinkle-ink')).toBe('water');
  });

  it('keeps warm card gradients on the default physics motion', () => {
    expect(
      getGradientStickerMotionVariant(getTextNoteCardGradient({
        text: 'Sunset cafe',
        noteId: 'note-physics',
        noteColor: 'sunset-coral',
      }))
    ).toBe('physics');
  });

  it('leaves non-blue preset cards on the default motion unless inferred otherwise', () => {
    expect(getNoteColorStickerMotion('sunset-coral')).toBeNull();
  });
});

import {
  APP_THEME_DEFAULT_NOTE_COLOR_ID,
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

  it('keeps the capture gradient stable for a given theme fallback regardless of note content', () => {
    const fallbackGradient: [string, string] = ['#D8E9C1', '#BEE7D7'];

    expect(getCaptureNoteGradient({ text: 'Just a quiet note', fallbackGradient })).toEqual(
      getCaptureNoteGradient({ text: 'Different note', emoji: '🌿', fallbackGradient })
    );
  });

  it('uses the provided theme fallback gradient when no note color is selected', () => {
    expect(
      getCaptureNoteGradient({
        text: 'Just a quiet note',
        fallbackGradient: ['#D9D3FF', '#F3CBE9'],
      })
    ).toEqual(['#D9D3FF', '#F3CBE9']);
  });

  it('keeps the legacy marigold fallback when no theme gradient is provided', () => {
    expect(getCaptureNoteGradient({ text: 'Just a quiet note' })).toEqual(['#F6D365', '#FDA085']);
  });

  it('matches the capture gradient to the saved note gradient when a note color is selected', () => {
    expect(getCaptureNoteGradient({ noteColor: 'sunset-coral' })).toEqual(
      getTextNoteCardGradient({ text: 'Cafe note', noteId: '1', noteColor: 'sunset-coral' })
    );
  });

  it('uses the theme fallback for saved notes that stay on the app default color', () => {
    expect(
      getTextNoteCardGradient({
        text: 'Just a quiet note',
        noteId: 'note-default',
        noteColor: APP_THEME_DEFAULT_NOTE_COLOR_ID,
        fallbackGradient: ['#D9D3FF', '#F3CBE9'],
      })
    ).toEqual(['#D9D3FF', '#F3CBE9']);
  });

  it('falls back to the original capture gradient when a saved default note has no theme context', () => {
    expect(
      getTextNoteCardGradient({
        text: 'Just a quiet note',
        noteId: 'note-default',
        noteColor: APP_THEME_DEFAULT_NOTE_COLOR_ID,
      })
    ).toEqual(['#F6D365', '#FDA085']);
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

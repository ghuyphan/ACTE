import {
  APP_THEME_DEFAULT_NOTE_COLOR_ID,
  getCaptureNoteGradient,
  getGradientStickerMotionVariant,
  getNoteColorStickerMotion,
  resolveSavedTextNoteColor,
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

  it('gives newly detected mood emojis their own visual direction', () => {
    expect(getTextNoteCardGradient({ text: 'Pool day', noteId: 'mood-water', emoji: '🌊' })).not.toEqual(
      getTextNoteCardGradient({ text: 'Pool day', noteId: 'mood-water', emoji: null })
    );
    expect(getTextNoteCardGradient({ text: 'Birthday', noteId: 'mood-party', emoji: '🎉' })).not.toEqual(
      getTextNoteCardGradient({ text: 'Birthday', noteId: 'mood-party', emoji: null })
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

  it('can freeze the current app theme into a concrete saved note color', () => {
    expect(
      resolveSavedTextNoteColor(null, {
        appTheme: 'peach',
        colorScheme: 'light',
      })
    ).toBe('peach-theme-light');

    expect(
      resolveSavedTextNoteColor(APP_THEME_DEFAULT_NOTE_COLOR_ID, {
        appTheme: 'matcha',
        colorScheme: 'dark',
      })
    ).toBe('matcha-theme-dark');
  });

  it('uses the provided color scheme for selected adaptive theme colors', () => {
    expect(
      getCaptureNoteGradient({
        noteColor: 'peach-theme',
        colorScheme: 'dark',
      })
    ).toEqual(['#F4C4A4', '#F0ADC2']);

    expect(
      resolveSavedTextNoteColor('peach-theme', {
        colorScheme: 'dark',
      })
    ).toBe('peach-theme-dark');
  });

  it('uses dark-mode variants for regular selected capture colors', () => {
    expect(
      getCaptureNoteGradient({
        noteColor: 'marigold-glow',
        colorScheme: 'dark',
      })
    ).toEqual(['#F2C96F', '#F19A7A']);

    expect(
      getCaptureNoteGradient({
        noteColor: 'sky-blue',
        colorScheme: 'dark',
      })
    ).toEqual(['#7EA7D8', '#8FCBE0']);

    expect(
      getCaptureNoteGradient({
        noteColor: 'sky-blue',
        colorScheme: 'light',
      })
    ).toEqual(['#A1C4FD', '#C2E9FB']);
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

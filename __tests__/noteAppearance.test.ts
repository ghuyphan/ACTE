import { getCaptureNoteGradient, getTextNoteCardGradient } from '../services/noteAppearance';

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

  it('falls back to a stable hashed gradient when no emoji palette matches', () => {
    expect(getTextNoteCardGradient({ text: 'Just a quiet note', noteId: 'note-123' })).toEqual(
      getTextNoteCardGradient({ text: 'Just a quiet note', noteId: 'note-123' })
    );
  });
});

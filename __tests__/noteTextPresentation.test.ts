import { formatNoteTextWithEmoji } from '../services/noteTextPresentation';

describe('noteTextPresentation', () => {
  it('keeps plain note text unchanged even when a mood emoji exists', () => {
    expect(formatNoteTextWithEmoji('Coffee catch-up', '☕️')).toBe('Coffee catch-up');
  });

  it('still trims surrounding whitespace from the displayed note text', () => {
    expect(formatNoteTextWithEmoji('  Quiet corner table  ', '✨')).toBe('Quiet corner table');
  });
});

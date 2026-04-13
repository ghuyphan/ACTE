import {
  formatNoteTextWithEmoji,
  getNotePreviewText,
  getSharedPostPreviewText,
} from '../services/noteTextPresentation';

describe('noteTextPresentation', () => {
  it('keeps plain note text unchanged even when a mood emoji exists', () => {
    expect(formatNoteTextWithEmoji('Coffee catch-up', '☕️')).toBe('Coffee catch-up');
  });

  it('still trims surrounding whitespace from the displayed note text', () => {
    expect(formatNoteTextWithEmoji('  Quiet corner table  ', '✨')).toBe('Quiet corner table');
  });

  it('builds note preview text from captions, fallbacks, and emoji-formatted text', () => {
    expect(
      getNotePreviewText(
        {
          type: 'photo',
          content: 'file:///photo.jpg',
          caption: '  Golden hour in District 3  ',
        },
        {
          photoLabel: 'Photo memory',
          emptyLabel: 'No note content',
          maxLength: 120,
        }
      )
    ).toBe('Golden hour in District 3');

    expect(
      getNotePreviewText(
        {
          type: 'text',
          content: '  Cà phê sáng  ',
          moodEmoji: '☕️',
        },
        {
          photoLabel: 'Photo memory',
          emptyLabel: 'No note content',
        }
      )
    ).toBe('Cà phê sáng');
  });

  it('uses shared post photo text before falling back to a photo label', () => {
    expect(
      getSharedPostPreviewText(
        {
          type: 'photo',
          text: '  Shared sunset caption  ',
        },
        {
          photoLabel: 'Photo memory',
          emptyLabel: 'No shared text',
          maxLength: 120,
        }
      )
    ).toBe('Shared sunset caption');

    expect(
      getSharedPostPreviewText(
        {
          type: 'photo',
          text: '   ',
        },
        {
          photoLabel: 'Photo memory',
          emptyLabel: 'No shared text',
        }
      )
    ).toBe('Photo memory');
  });
});

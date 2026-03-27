import { applyCommittedInlineEmoji, resolveAutoNoteEmoji, resolveInlineNoteEmojiSuggestion } from '../services/noteDecorations';

describe('noteDecorations', () => {
  it('suggests an emoji from the active phrase without mutating the raw text', () => {
    expect(resolveInlineNoteEmojiSuggestion('Still thinking about coffee')).toEqual({
      emoji: '☕️',
      matchedText: 'coffee',
      matchedKeyword: 'coffee',
      exact: true,
    });
  });

  it('supports partial keyword suggestions while typing the active word', () => {
    expect(resolveInlineNoteEmojiSuggestion('Need a cof')).toEqual({
      emoji: '☕️',
      matchedText: 'cof',
      matchedKeyword: 'coffee',
      exact: false,
    });
  });

  it('keeps the suggestion stable when the user has just typed a trailing space', () => {
    expect(resolveInlineNoteEmojiSuggestion('Need a coffee ')).toEqual({
      emoji: '☕️',
      matchedText: 'coffee',
      matchedKeyword: 'coffee',
      exact: true,
    });
  });

  it('inserts an emoji inline when a recognized phrase is committed with whitespace', () => {
    expect(applyCommittedInlineEmoji('Need ca phe', 'Need ca phe ')).toBe('Need ca phe ☕️ ');
  });

  it('inserts an emoji inline when a recognized word is committed with punctuation', () => {
    expect(applyCommittedInlineEmoji('Them hanh', 'Them hanh,')).toBe('Them hanh 🧅,');
    expect(applyCommittedInlineEmoji('Them hành', 'Them hành...')).toBe('Them hành 🧅...');
  });

  it('does not duplicate an emoji when spacing continues after insertion', () => {
    expect(applyCommittedInlineEmoji('Need ca phe ☕️ ', 'Need ca phe ☕️  ')).toBe('Need ca phe ☕️  ');
  });

  it('supports local garnish-style keywords for garlic, shallot, and chili', () => {
    expect(
      resolveAutoNoteEmoji({
        type: 'text',
        content: 'Hanh phi on top',
        locationName: 'District 1',
      })
    ).toBe('🧅');
    expect(
      resolveAutoNoteEmoji({
        type: 'text',
        content: 'Banh mi with garlic butter',
        locationName: 'District 1',
      })
    ).toBe('🧄');
    expect(
      resolveAutoNoteEmoji({
        type: 'text',
        content: 'Chili oil dip',
        locationName: 'District 1',
      })
    ).toBe('🌶️');
  });

  it('matches accented Vietnamese garnish keywords with the more specific food emoji', () => {
    expect(
      resolveAutoNoteEmoji({
        type: 'text',
        content: 'Phở nhiều hành lá',
        locationName: 'Quận 1',
      })
    ).toBe('🧅');
    expect(
      resolveAutoNoteEmoji({
        type: 'text',
        content: 'Nước chấm thêm tỏi',
        locationName: 'Quận 1',
      })
    ).toBe('🧄');
    expect(
      resolveAutoNoteEmoji({
        type: 'text',
        content: 'Chấm với ớt xanh',
        locationName: 'Quận 1',
      })
    ).toBe('🌶️');
  });

  it('still resolves the saved note emoji from the full note content', () => {
    expect(
      resolveAutoNoteEmoji({
        type: 'text',
        content: 'Lovely coffee catch-up',
        locationName: 'Downtown cafe',
      })
    ).toBe('☕️');
  });

  it('matches Vietnamese text that includes the letter d-stroke once normalized', () => {
    expect(
      resolveAutoNoteEmoji({
        type: 'text',
        content: 'Đi bộ một vòng hồ',
        locationName: 'Đà Lạt',
      })
    ).toBe('🚶');
  });

  it('covers common brand and category keywords for saved note emoji detection', () => {
    expect(
      resolveAutoNoteEmoji({
        type: 'text',
        content: 'Highlands catch-up before work',
        locationName: 'District 3',
      })
    ).toBe('☕️');
    expect(
      resolveAutoNoteEmoji({
        type: 'text',
        content: 'Late hojicha and waffle stop',
        locationName: 'Phu Nhuan',
      })
    ).toBe('🧋');
    expect(
      resolveAutoNoteEmoji({
        type: 'text',
        content: 'Aeon run for a few gifts',
        locationName: 'Tan Phu',
      })
    ).toBe('🛍️');
  });
});

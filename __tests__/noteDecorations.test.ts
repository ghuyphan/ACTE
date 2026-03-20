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

  it('still resolves the saved note emoji from the full note content', () => {
    expect(
      resolveAutoNoteEmoji({
        type: 'text',
        content: 'Lovely coffee catch-up',
        locationName: 'Downtown cafe',
      })
    ).toBe('☕️');
  });
});

import { AUTO_NOTE_EMOJIS } from './noteDecorations';

const LEADING_EMOJI_PATTERN = /^\p{Extended_Pictographic}(?:\uFE0F)?\s+/u;

export function formatNoteTextWithEmoji(text: string, emoji?: string | null) {
  const trimmedText = typeof text === 'string' ? text.trim() : '';
  const trimmedEmoji = typeof emoji === 'string' ? emoji.trim() : '';

  if (!trimmedText) {
    return trimmedText;
  }

  if (!trimmedEmoji) {
    return trimmedText;
  }

  if (
    trimmedText.startsWith(`${trimmedEmoji} `) ||
    trimmedText.includes(trimmedEmoji) ||
    LEADING_EMOJI_PATTERN.test(trimmedText)
  ) {
    return trimmedText;
  }

  return `${trimmedEmoji} ${trimmedText}`;
}

export function stripAutoEmojiPrefix(text: string) {
  const value = typeof text === 'string' ? text : '';

  for (const emoji of AUTO_NOTE_EMOJIS) {
    const prefix = `${emoji} `;
    if (value.startsWith(prefix)) {
      return value.slice(prefix.length);
    }
  }

  return value;
}

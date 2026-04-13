export function formatNoteTextWithEmoji(text: string, _emoji?: string | null) {
  const trimmedText = typeof text === 'string' ? text.trim() : '';
  return trimmedText;
}

function truncatePreviewText(text: string, maxLength: number | null | undefined) {
  if (!maxLength || text.length <= maxLength) {
    return text;
  }

  return `${text.substring(0, maxLength)}…`;
}

export function getNotePreviewText(
  note: {
    type: 'text' | 'photo';
    content: string;
    caption?: string | null;
    moodEmoji?: string | null;
  },
  options: {
    photoLabel: string;
    emptyLabel: string;
    maxLength?: number;
  }
) {
  if (note.type === 'photo') {
    const caption = note.caption?.trim();
    return truncatePreviewText(caption?.length ? caption : options.photoLabel, options.maxLength);
  }

  const normalized = note.content.trim();
  if (!normalized) {
    return options.emptyLabel;
  }

  return truncatePreviewText(
    formatNoteTextWithEmoji(normalized, note.moodEmoji),
    options.maxLength
  );
}

export function getSharedPostPreviewText(
  post: {
    type: 'text' | 'photo';
    text: string;
  },
  options: {
    photoLabel: string;
    emptyLabel: string;
    maxLength?: number;
  }
) {
  const normalized = post.text.trim();
  if (!normalized) {
    return options.photoLabel && post.type === 'photo' ? options.photoLabel : options.emptyLabel;
  }

  return truncatePreviewText(normalized, options.maxLength);
}

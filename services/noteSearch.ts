interface SearchableNote {
  type: 'text' | 'photo';
  content: string;
  locationName: string | null;
}

function normalizeSegment(value: string | null | undefined) {
  return typeof value === 'string'
    ? value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
    : '';
}

export function buildNoteSearchText(note: SearchableNote) {
  const segments =
    note.type === 'photo'
      ? [note.locationName]
      : [note.content, note.locationName];

  return segments
    .map(normalizeSegment)
    .filter(Boolean)
    .join(' ')
    .trim();
}

export function tokenizeSearchQuery(query: string) {
  return normalizeSegment(query)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);
}

export function matchesNoteQuery(note: SearchableNote, query: string) {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) {
    return true;
  }

  const searchText = buildNoteSearchText(note);
  return tokens.every((token) => searchText.includes(token));
}

export function filterNotesByQuery<T extends SearchableNote>(notes: T[], query: string) {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) {
    return notes;
  }

  return notes.filter((note) => {
    const searchText = buildNoteSearchText(note);
    return tokens.every((token) => searchText.includes(token));
  });
}

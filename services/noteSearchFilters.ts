import type { Note } from './database';

export type NoteSearchFilter =
  | 'photo'
  | 'text'
  | 'favorite'
  | 'this_month'
  | 'stickers'
  | 'doodles'
  | 'prompts';

export interface NoteSearchFilterOption {
  id: NoteSearchFilter;
  icon: string;
  labelKey: string;
  fallbackLabel: string;
}

export const NOTE_SEARCH_FILTER_OPTIONS: NoteSearchFilterOption[] = [
  { id: 'photo', icon: 'image-outline', labelKey: 'search.filterPhotos', fallbackLabel: 'Photos' },
  { id: 'text', icon: 'document-text-outline', labelKey: 'search.filterText', fallbackLabel: 'Text' },
  { id: 'favorite', icon: 'heart-outline', labelKey: 'search.filterFavorites', fallbackLabel: 'Favorites' },
  { id: 'this_month', icon: 'calendar-outline', labelKey: 'search.filterThisMonth', fallbackLabel: 'This month' },
  { id: 'stickers', icon: 'sparkles-outline', labelKey: 'search.filterStickers', fallbackLabel: 'Stickers' },
  { id: 'doodles', icon: 'brush-outline', labelKey: 'search.filterDoodles', fallbackLabel: 'Doodles' },
  { id: 'prompts', icon: 'chatbubble-ellipses-outline', labelKey: 'search.filterPrompts', fallbackLabel: 'Prompts' },
];

function isThisMonth(note: Pick<Note, 'createdAt'>, now = new Date()) {
  const createdAt = new Date(note.createdAt);
  return (
    Number.isFinite(createdAt.getTime()) &&
    createdAt.getFullYear() === now.getFullYear() &&
    createdAt.getMonth() === now.getMonth()
  );
}

function matchesFilter(note: Note, filter: NoteSearchFilter, now: Date) {
  switch (filter) {
    case 'photo':
      return note.type === 'photo';
    case 'text':
      return note.type === 'text';
    case 'favorite':
      return note.isFavorite;
    case 'this_month':
      return isThisMonth(note, now);
    case 'stickers':
      return Boolean(note.hasStickers);
    case 'doodles':
      return Boolean(note.hasDoodle);
    case 'prompts':
      return Boolean(note.promptTextSnapshot?.trim() || note.promptAnswer?.trim());
  }
}

export function filterNotesBySearchFilters<T extends Note>(
  notes: T[],
  filters: readonly NoteSearchFilter[],
  now = new Date()
): T[] {
  if (filters.length === 0) {
    return notes;
  }

  return notes.filter((note) => filters.every((filter) => matchesFilter(note, filter, now)));
}

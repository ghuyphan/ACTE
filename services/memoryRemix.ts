import type { Note } from './database';
import type { SharedPost } from './sharedFeedService';

export type MemoryRemixSource = 'search' | 'month' | 'place' | 'favorites';

export type MemoryRemixItem =
  | { id: string; kind: 'note'; createdAt: string; note: Note }
  | { id: string; kind: 'shared-post'; createdAt: string; post: SharedPost };

export interface BuildMemoryRemixOptions {
  notes: Note[];
  sharedPosts?: SharedPost[];
  source: MemoryRemixSource;
  limit?: number;
  now?: Date;
  placeName?: string | null;
}

const DEFAULT_REMIX_LIMIT = 6;

function getCreatedAtMs(item: MemoryRemixItem) {
  const timestamp = new Date(item.createdAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizePlaceName(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase() ?? '';
}

function isThisMonth(createdAt: string, now: Date) {
  const date = new Date(createdAt);
  return (
    Number.isFinite(date.getTime()) &&
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function getItemScore(item: MemoryRemixItem) {
  if (item.kind === 'note') {
    return (
      (item.note.isFavorite ? 8 : 0) +
      (item.note.type === 'photo' ? 5 : 0) +
      (item.note.hasStickers ? 3 : 0) +
      (item.note.hasDoodle ? 2 : 0) +
      (item.note.promptTextSnapshot ? 1 : 0)
    );
  }

  return (
    (item.post.type === 'photo' ? 5 : 0) +
    (item.post.hasStickers ? 3 : 0) +
    (item.post.doodleStrokesJson ? 2 : 0)
  );
}

export function buildMemoryRemixItems({
  notes,
  sharedPosts = [],
  source,
  limit = DEFAULT_REMIX_LIMIT,
  now = new Date(),
  placeName = null,
}: BuildMemoryRemixOptions): MemoryRemixItem[] {
  const requestedPlace = normalizePlaceName(placeName);
  const allItems: MemoryRemixItem[] = [
    ...notes.map((note) => ({
      id: note.id,
      kind: 'note' as const,
      note,
      createdAt: note.createdAt,
    })),
    ...sharedPosts.map((post) => ({
      id: post.id,
      kind: 'shared-post' as const,
      post,
      createdAt: post.createdAt,
    })),
  ];

  const filteredItems = allItems.filter((item) => {
    switch (source) {
      case 'favorites':
        return item.kind === 'note' && item.note.isFavorite;
      case 'month':
        return isThisMonth(item.createdAt, now);
      case 'place': {
        const itemPlace = item.kind === 'note'
          ? normalizePlaceName(item.note.locationName)
          : normalizePlaceName(item.post.placeName);
        return requestedPlace.length > 0 && itemPlace === requestedPlace;
      }
      case 'search':
        return true;
    }
  });

  return filteredItems
    .sort((left, right) => {
      const scoreDelta = getItemScore(right) - getItemScore(left);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      return getCreatedAtMs(right) - getCreatedAtMs(left);
    })
    .slice(0, Math.max(0, limit));
}

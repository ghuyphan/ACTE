import type { Note } from '../../../services/database';
import {
  parseNoteStickerPlacements,
  type StickerAsset,
  type StickerRenderMode,
  type StickerStampStyle,
} from '../../../services/noteStickers';

export interface CreatedStickerLibraryItem {
  id: string;
  asset: StickerAsset;
  assetId: string;
  renderMode: StickerRenderMode;
  stampStyle?: StickerStampStyle;
  usageCount: number;
  lastUsedAt: string;
}

export type CreatedStickerLibrarySectionKey = 'today' | 'yesterday' | 'earlier';

export interface CreatedStickerLibrarySection {
  key: CreatedStickerLibrarySectionKey;
  items: CreatedStickerLibraryItem[];
}

interface CachedCreatedStickerLibraryItem extends CreatedStickerLibraryItem {
  assetCreatedAtMs: number;
  lastUsedAtMs: number;
}

interface NoteStickerLibraryCacheEntry {
  signature: string;
  items: CachedCreatedStickerLibraryItem[];
}

const noteStickerLibraryCache = new Map<string, NoteStickerLibraryCacheEntry>();

function getTimestampMs(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getNoteStickerLibrarySignature(
  note: Pick<Note, 'createdAt' | 'updatedAt' | 'stickerPlacementsJson'>
) {
  return `${note.updatedAt ?? ''}|${note.createdAt}|${note.stickerPlacementsJson ?? ''}`;
}

function buildCreatedStickerLibraryItemsForNote(note: Note): CachedCreatedStickerLibraryItem[] {
  if (!note.stickerPlacementsJson) {
    return [];
  }

  const signature = getNoteStickerLibrarySignature(note);
  const cachedEntry = noteStickerLibraryCache.get(note.id);
  if (cachedEntry?.signature === signature) {
    return cachedEntry.items;
  }

  const placements = parseNoteStickerPlacements(note.stickerPlacementsJson);
  const itemsById = new Map<string, CachedCreatedStickerLibraryItem>();
  const lastUsedAt = note.updatedAt ?? note.createdAt;
  const lastUsedAtMs = getTimestampMs(lastUsedAt);

  for (const placement of placements) {
    const renderMode = placement.renderMode === 'stamp' ? 'stamp' : 'default';
    const stampStyle = renderMode === 'stamp' && placement.stampStyle === 'circle' ? 'circle' : 'classic';
    const itemId =
      renderMode === 'stamp'
        ? `${placement.asset.id}:${renderMode}:${stampStyle}`
        : `${placement.asset.id}:${renderMode}`;
    const assetCreatedAtMs = getTimestampMs(placement.asset.createdAt);
    const existing = itemsById.get(itemId);

    if (!existing) {
      itemsById.set(itemId, {
        id: itemId,
        asset: placement.asset,
        assetId: placement.asset.id,
        renderMode,
        stampStyle: renderMode === 'stamp' ? stampStyle : undefined,
        usageCount: 1,
        lastUsedAt,
        lastUsedAtMs,
        assetCreatedAtMs,
      });
      continue;
    }

    existing.usageCount += 1;
    if (lastUsedAtMs >= existing.lastUsedAtMs) {
      existing.lastUsedAt = lastUsedAt;
      existing.lastUsedAtMs = lastUsedAtMs;
    }
    if (assetCreatedAtMs > existing.assetCreatedAtMs) {
      existing.assetCreatedAtMs = assetCreatedAtMs;
    }
  }

  const items = Array.from(itemsById.values());
  noteStickerLibraryCache.set(note.id, {
    signature,
    items,
  });

  return items;
}

export function buildCreatedStickerLibrary(notes: readonly Note[]): CreatedStickerLibraryItem[] {
  const activeNoteIds = new Set<string>();
  const itemsById = new Map<string, CachedCreatedStickerLibraryItem>();

  for (const note of notes) {
    activeNoteIds.add(note.id);

    if (!note.stickerPlacementsJson) {
      continue;
    }

    const noteItems = buildCreatedStickerLibraryItemsForNote(note);

    for (const noteItem of noteItems) {
      const existing = itemsById.get(noteItem.id);
      if (!existing) {
        itemsById.set(noteItem.id, {
          ...noteItem,
        });
        continue;
      }

      existing.usageCount += noteItem.usageCount;
      if (noteItem.lastUsedAtMs > existing.lastUsedAtMs) {
        existing.lastUsedAt = noteItem.lastUsedAt;
        existing.lastUsedAtMs = noteItem.lastUsedAtMs;
      }
      if (noteItem.assetCreatedAtMs > existing.assetCreatedAtMs) {
        existing.assetCreatedAtMs = noteItem.assetCreatedAtMs;
      }
    }
  }

  for (const cachedNoteId of noteStickerLibraryCache.keys()) {
    if (!activeNoteIds.has(cachedNoteId)) {
      noteStickerLibraryCache.delete(cachedNoteId);
    }
  }

  return Array.from(itemsById.values()).sort((left, right) => {
    const lastUsedDelta = right.lastUsedAtMs - left.lastUsedAtMs;
    if (lastUsedDelta !== 0) {
      return lastUsedDelta;
    }

    return right.assetCreatedAtMs - left.assetCreatedAtMs;
  });
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDayDifference(left: Date, right: Date) {
  const leftDay = startOfLocalDay(left).getTime();
  const rightDay = startOfLocalDay(right).getTime();

  return Math.round((leftDay - rightDay) / (24 * 60 * 60 * 1000));
}

export function groupCreatedStickerLibrary(
  items: readonly CreatedStickerLibraryItem[],
  now = new Date()
): CreatedStickerLibrarySection[] {
  const grouped: CreatedStickerLibrarySection[] = [
    { key: 'today', items: [] },
    { key: 'yesterday', items: [] },
    { key: 'earlier', items: [] },
  ];

  for (const item of items) {
    const itemDate = new Date(item.lastUsedAt);
    const dayDifference = Number.isNaN(itemDate.getTime())
      ? 2
      : getDayDifference(now, itemDate);

    if (dayDifference <= 0) {
      grouped[0].items.push(item);
      continue;
    }

    if (dayDifference === 1) {
      grouped[1].items.push(item);
      continue;
    }

    grouped[2].items.push(item);
  }

  return grouped.filter((section) => section.items.length > 0);
}

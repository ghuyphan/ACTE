import type { Note } from '../../../services/database';
import { parseNoteStickerPlacements, type StickerAsset, type StickerRenderMode } from '../../../services/noteStickers';

export interface CreatedStickerLibraryItem {
  id: string;
  asset: StickerAsset;
  assetId: string;
  renderMode: StickerRenderMode;
  usageCount: number;
  lastUsedAt: string;
}

export type CreatedStickerLibrarySectionKey = 'today' | 'yesterday' | 'earlier';

export interface CreatedStickerLibrarySection {
  key: CreatedStickerLibrarySectionKey;
  items: CreatedStickerLibraryItem[];
}

export function buildCreatedStickerLibrary(notes: readonly Note[]): CreatedStickerLibraryItem[] {
  const itemsById = new Map<string, CreatedStickerLibraryItem>();

  for (const note of notes) {
    const placements = parseNoteStickerPlacements(note.stickerPlacementsJson);

    for (const placement of placements) {
      const renderMode = placement.renderMode === 'stamp' ? 'stamp' : 'default';
      const itemId = `${placement.asset.id}:${renderMode}`;
      const lastUsedAt = note.updatedAt ?? note.createdAt ?? placement.asset.createdAt;
      const existing = itemsById.get(itemId);

      if (!existing) {
        itemsById.set(itemId, {
          id: itemId,
          asset: placement.asset,
          assetId: placement.asset.id,
          renderMode,
          usageCount: 1,
          lastUsedAt,
        });
        continue;
      }

      itemsById.set(itemId, {
        ...existing,
        usageCount: existing.usageCount + 1,
        lastUsedAt:
          new Date(lastUsedAt).getTime() > new Date(existing.lastUsedAt).getTime()
            ? lastUsedAt
            : existing.lastUsedAt,
      });
    }
  }

  return Array.from(itemsById.values()).sort((left, right) => {
    const lastUsedDelta =
      new Date(right.lastUsedAt).getTime() - new Date(left.lastUsedAt).getTime();
    if (lastUsedDelta !== 0) {
      return lastUsedDelta;
    }

    return new Date(right.asset.createdAt).getTime() - new Date(left.asset.createdAt).getTime();
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

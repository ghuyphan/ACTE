import type { Note } from '../../../services/database';
import { parseNoteStickerPlacements, type StickerRenderMode } from '../../../services/noteStickers';
import type { StickerAsset } from '../../../services/noteStickers';

export interface CreatedStickerLibraryItem {
  id: string;
  asset: StickerAsset;
  assetId: string;
  renderMode: StickerRenderMode;
  usageCount: number;
  lastUsedAt: string;
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

jest.mock('expo-crypto', () => ({
  randomUUID: jest
    .fn()
    .mockReturnValueOnce('test-uuid-1234')
    .mockReturnValueOnce('test-uuid-5678')
    .mockReturnValue('test-uuid-9012'),
}));

import {
  bringStickerPlacementToFront,
  createStickerPlacement,
  duplicateStickerPlacement,
  normalizeStickerPlacements,
  parseNoteStickerPlacements,
  setStickerPlacementOutlineEnabled,
  updateStickerPlacementTransform,
  type StickerAsset,
} from '../services/noteStickers';

const baseAsset: StickerAsset = {
  id: 'sticker-1',
  ownerUid: '__local__',
  localUri: 'file:///stickers/sticker-1.png',
  remotePath: null,
  mimeType: 'image/png',
  width: 240,
  height: 180,
  createdAt: '2026-03-26T00:00:00.000Z',
  updatedAt: null,
  source: 'import',
};

describe('noteStickers helpers', () => {
  it('parses valid placements and rejects invalid values', () => {
    const validPlacement = createStickerPlacement(baseAsset);
    expect(parseNoteStickerPlacements(JSON.stringify([validPlacement]))).toHaveLength(1);
    expect(parseNoteStickerPlacements('{"bad":true}')).toEqual([]);
    expect(parseNoteStickerPlacements(null)).toEqual([]);
  });

  it('duplicates and normalizes placements', () => {
    const firstPlacement = createStickerPlacement(baseAsset);
    const duplicated = duplicateStickerPlacement([firstPlacement], firstPlacement.id);

    expect(duplicated).toHaveLength(2);
    expect(duplicated[0]?.zIndex).toBe(1);
    expect(duplicated[1]?.zIndex).toBe(2);
    expect(duplicated[1]?.x).toBeGreaterThan(firstPlacement.x);
    expect(duplicated[1]?.y).toBeGreaterThan(firstPlacement.y);
  });

  it('stagger new stickers so they do not all spawn at the exact same center point', () => {
    const firstPlacement = createStickerPlacement(baseAsset);
    const secondPlacement = createStickerPlacement({ ...baseAsset, id: 'sticker-2' }, [firstPlacement]);
    const thirdPlacement = createStickerPlacement(
      { ...baseAsset, id: 'sticker-3' },
      [firstPlacement, secondPlacement]
    );

    expect(firstPlacement.x).toBe(0.5);
    expect(firstPlacement.y).toBe(0.5);
    expect(secondPlacement.x).not.toBe(firstPlacement.x);
    expect(secondPlacement.y).not.toBe(firstPlacement.y);
    expect(thirdPlacement.x).not.toBe(secondPlacement.x);
  });

  it('updates transforms and brings stickers to front', () => {
    const firstPlacement = createStickerPlacement(baseAsset);
    const secondPlacement = createStickerPlacement({ ...baseAsset, id: 'sticker-2' }, [firstPlacement]);
    const resized = updateStickerPlacementTransform([firstPlacement, secondPlacement], firstPlacement.id, {
      scale: 1.8,
      rotation: 30,
    });
    const broughtToFront = bringStickerPlacementToFront(resized, firstPlacement.id);
    const normalized = normalizeStickerPlacements(broughtToFront);

    expect(normalized.find((placement) => placement.id === firstPlacement.id)?.scale).toBe(1.8);
    expect(normalized.find((placement) => placement.id === firstPlacement.id)?.rotation).toBe(30);
    expect(normalized[normalized.length - 1]?.id).toBe(firstPlacement.id);
  });

  it('lets stickers disable the generated outline explicitly', () => {
    const placement = createStickerPlacement(baseAsset);
    const toggled = setStickerPlacementOutlineEnabled([placement], placement.id, false);

    expect(toggled[0]?.outlineEnabled).toBe(false);
    expect(parseNoteStickerPlacements(JSON.stringify(toggled))[0]?.outlineEnabled).toBe(false);
  });
});

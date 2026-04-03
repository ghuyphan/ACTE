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
  setStickerPlacementMotionLocked,
  setStickerPlacementOutlineEnabled,
  setStickerPlacementRenderMode,
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

  it('persists the sticker motion lock flag per sticker', () => {
    const firstPlacement = {
      ...createStickerPlacement(baseAsset),
      id: 'placement-1',
    };
    const secondPlacement = {
      ...createStickerPlacement({ ...baseAsset, id: 'sticker-2' }, [firstPlacement]),
      id: 'placement-2',
    };
    const locked = setStickerPlacementMotionLocked([firstPlacement, secondPlacement], firstPlacement.id, true);
    const parsed = parseNoteStickerPlacements(JSON.stringify(locked));

    expect(parsed.find((placement) => placement.id === firstPlacement.id)?.motionLocked).toBe(true);
    expect(parsed.find((placement) => placement.id === secondPlacement.id)?.motionLocked).toBe(false);
  });

  it('persists the sticker render mode per sticker', () => {
    const placement = createStickerPlacement(baseAsset);
    const stamped = setStickerPlacementRenderMode([placement], placement.id, 'stamp');
    const parsed = parseNoteStickerPlacements(JSON.stringify(stamped));

    expect(stamped[0]?.renderMode).toBe('stamp');
    expect(parsed[0]?.renderMode).toBe('stamp');
  });

  it('defaults imported opaque images into stamp render mode', () => {
    const placement = createStickerPlacement({
      ...baseAsset,
      suggestedRenderMode: 'stamp',
    });

    expect(placement.renderMode).toBe('stamp');
    expect('suggestedRenderMode' in placement.asset).toBe(false);
  });

  it('lets new placements start in stamp mode explicitly', () => {
    const placement = createStickerPlacement(baseAsset, [], { renderMode: 'stamp' });

    expect(placement.renderMode).toBe('stamp');
  });

  it('keeps new stickers unlocked by default', () => {
    const lockedPlacement = {
      ...createStickerPlacement(baseAsset),
      motionLocked: true,
    };
    const nextPlacement = createStickerPlacement(
      { ...baseAsset, id: 'sticker-2' },
      [lockedPlacement]
    );

    expect(nextPlacement.motionLocked).toBe(false);
  });
});

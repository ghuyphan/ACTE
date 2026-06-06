import {
  findUnreferencedStickerPackUris,
  orderStickerPackItems,
  validateStickerPackDraft,
} from '../services/stickerPacks';

describe('public sticker packs', () => {
  it('validates item count, uniqueness, lengths, and thumbnail membership', () => {
    expect(
      validateStickerPackDraft({
        name: '',
        description: 'x'.repeat(201),
        assetIds: ['a', 'a'],
        thumbnailAssetId: 'missing',
      }).errors
    ).toEqual([
      'name-required',
      'description-too-long',
      'too-few-items',
      'duplicate-items',
      'thumbnail-not-in-pack',
    ]);

    expect(
      validateStickerPackDraft({
        name: 'A good pack',
        description: 'Three favorites',
        assetIds: ['a', 'b', 'c'],
        thumbnailAssetId: 'b',
      })
    ).toEqual({ valid: true, errors: [] });
  });

  it('preserves server ordering for previews and picker sections', () => {
    expect(orderStickerPackItems([{ position: 2 }, { position: 0 }, { position: 1 }]))
      .toEqual([{ position: 0 }, { position: 1 }, { position: 2 }]);
  });

  it('keeps cached files referenced by existing note placements', () => {
    const used = 'file:///sticker-packs/pack/revision/used.png';
    const unused = 'file:///sticker-packs/pack/revision/unused.png';
    expect(
      findUnreferencedStickerPackUris(
        [used, unused],
        [JSON.stringify([{ asset: { localUri: used } }])]
      )
    ).toEqual([unused]);
  });
});

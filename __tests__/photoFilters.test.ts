jest.mock('@shopify/react-native-skia', () => ({
  BlendMode: {
    SrcOver: 'srcOver',
    Screen: 'screen',
    SoftLight: 'softLight',
    Multiply: 'multiply',
  },
  ImageFormat: { JPEG: 'jpeg' },
  TileMode: { Clamp: 'clamp' },
  Skia: {},
}));

import { PHOTO_FILTER_PRESETS } from '../services/photoFilters';

describe('photoFilters', () => {
  it('keeps non-original filter bias values in a safe normalized range', () => {
    for (const preset of PHOTO_FILTER_PRESETS) {
      if (preset.id === 'original') {
        continue;
      }

      const biasValues = [
        preset.renderMatrix[4],
        preset.renderMatrix[9],
        preset.renderMatrix[14],
        preset.renderMatrix[19],
      ];

      expect(biasValues.every((value) => Math.abs(value) <= 1)).toBe(true);
    }
  });
});

import { PHOTO_FILTER_PRESETS } from '../services/photoFilters';

describe('photoFilters', () => {
  it('keeps non-original filter bias values in a safe normalized range', () => {
    for (const preset of PHOTO_FILTER_PRESETS) {
      if (preset.id === 'original') {
        continue;
      }

      const biasValues = [preset.matrix[4], preset.matrix[9], preset.matrix[14], preset.matrix[19]];

      expect(biasValues.every((value) => Math.abs(value) <= 1)).toBe(true);
    }
  });
});

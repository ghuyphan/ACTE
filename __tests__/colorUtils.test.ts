import { withAlpha } from '../utils/colors';

describe('color utilities', () => {
  it('applies alpha to hex and rgb colors', () => {
    expect(withAlpha('#ffffff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
    expect(withAlpha('#000', 0.25)).toBe('rgba(0, 0, 0, 0.25)');
    expect(withAlpha('rgb(12, 34, 56)', 0.8)).toBe('rgba(12, 34, 56, 0.8)');
    expect(withAlpha('rgba(12, 34, 56, 0.2)', 0.9)).toBe('rgba(12, 34, 56, 0.9)');
  });
});

import { getStickerRestAnchorY } from '../hooks/useStickerPhysics';

describe('useStickerPhysics', () => {
  it('keeps standard physics stickers anchored to their original vertical position', () => {
    expect(getStickerRestAnchorY(180, 300, 'physics')).toBe(180);
  });

  it('pulls water stickers up toward the surface when they start below it', () => {
    expect(getStickerRestAnchorY(240, 300, 'water')).toBeCloseTo(171.34, 2);
  });

  it('preserves higher water stickers near their original placement with a small lift', () => {
    expect(getStickerRestAnchorY(120, 300, 'water')).toBeCloseTo(105.05, 2);
  });

  it('gives water stickers slightly different resting heights across the canvas', () => {
    const left = getStickerRestAnchorY(240, 300, 'water', 40);
    const right = getStickerRestAnchorY(240, 300, 'water', 220);

    expect(left).not.toBeCloseTo(right, 3);
  });
});

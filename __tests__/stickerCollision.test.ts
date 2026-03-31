import {
  detectRoundedStickerCollision,
  getStickerCollisionGeometry,
} from '../hooks/stickerCollision';

describe('stickerCollision', () => {
  it('uses a broad-phase radius that encloses the rotated sticker bounds', () => {
    const geometry = getStickerCollisionGeometry(120, 80);

    expect(geometry.broadPhaseRadius).toBeCloseTo(Math.hypot(60, 40));
    expect(geometry.cornerRadius).toBeGreaterThan(0);
    expect(geometry.coreHalfWidth).toBeLessThan(60);
    expect(geometry.coreHalfHeight).toBeLessThan(40);
  });

  it('catches diagonal square overlaps that a single inscribed circle would miss', () => {
    const geometry = getStickerCollisionGeometry(100, 100);
    const collision = detectRoundedStickerCollision(
      { ...geometry, x: 0, y: 0, rotation: 0 },
      { ...geometry, x: 86, y: 86, rotation: 0 }
    );

    expect(collision).not.toBeNull();
    expect(collision?.overlap ?? 0).toBeGreaterThan(0);
  });

  it('keeps diagonally separated stickers from colliding once the rounded corners clear', () => {
    const geometry = getStickerCollisionGeometry(100, 100);
    const collision = detectRoundedStickerCollision(
      { ...geometry, x: 0, y: 0, rotation: 0 },
      { ...geometry, x: 105, y: 105, rotation: 0 }
    );

    expect(collision).toBeNull();
  });

  it('resolves rotated overlaps with a stable collision normal', () => {
    const geometry = getStickerCollisionGeometry(120, 90);
    const collision = detectRoundedStickerCollision(
      { ...geometry, x: 0, y: 0, rotation: 22 },
      { ...geometry, x: 90, y: 18, rotation: -18 }
    );

    expect(collision).not.toBeNull();
    expect(collision?.normalX ?? 0).toBeGreaterThan(0);
    expect(Math.hypot(collision?.normalX ?? 0, collision?.normalY ?? 0)).toBeCloseTo(1, 5);
  });
});

import {
  detectStickerCollision,
  getStickerCollisionGeometry,
} from '../hooks/stickerCollision';

describe('stickerCollision', () => {
  it('uses a simple circle radius derived from the sticker size', () => {
    const geometry = getStickerCollisionGeometry(120, 80);

    expect(geometry.collisionRadius).toBeGreaterThan(0);
    expect(geometry.collisionRadius).toBeLessThanOrEqual(40);
  });

  it('detects a collision when two sticker circles overlap', () => {
    const geometry = getStickerCollisionGeometry(100, 100);
    const collision = detectStickerCollision(
      { ...geometry, x: 0, y: 0, rotation: 0 },
      { ...geometry, x: 60, y: 0, rotation: 0 }
    );

    expect(collision).not.toBeNull();
    expect(collision?.overlap ?? 0).toBeGreaterThan(0);
  });

  it('keeps separated sticker circles from colliding', () => {
    const geometry = getStickerCollisionGeometry(100, 100);
    const collision = detectStickerCollision(
      { ...geometry, x: 0, y: 0, rotation: 0 },
      { ...geometry, x: 110, y: 0, rotation: 0 }
    );

    expect(collision).toBeNull();
  });

  it('uses a deterministic normal when stickers perfectly overlap', () => {
    const geometry = getStickerCollisionGeometry(120, 90);
    const collision = detectStickerCollision(
      { ...geometry, x: 0, y: 0, rotation: 22 },
      { ...geometry, x: 0, y: 0, rotation: -18 }
    );

    expect(collision).not.toBeNull();
    expect(collision?.normalX ?? 0).toBe(1);
    expect(collision?.normalY ?? 0).toBe(0);
    expect(Math.hypot(collision?.normalX ?? 0, collision?.normalY ?? 0)).toBeCloseTo(1, 5);
  });
});

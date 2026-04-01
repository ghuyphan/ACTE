import {
  getStickerMotionActivity,
  getStickerRestAnchorY,
  resolveStickerCollisions,
  type StickerPhysicsState,
} from '../hooks/useStickerPhysics';

function createPhysicsSticker(
  id: string,
  x: number,
  y: number
): StickerPhysicsState {
  return {
    id,
    anchorX: x,
    anchorY: y,
    width: 120,
    height: 90,
    collisionRadius: 41,
    collisionHalfWidth: 56,
    collisionHalfHeight: 41,
    baseRotation: 0,
    opacity: 1,
    x,
    y,
    vx: 0,
    vy: 0,
    rotation: 0,
    angularVelocity: 0,
    jellyScaleX: 1,
    jellyScaleY: 1,
  };
}

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

  it('stays calm when the device is nearly flat and still', () => {
    expect(getStickerMotionActivity(0.04, 0.02, 0.01, 0, 1 / 60)).toBe(0);
  });

  it('wakes up when the device tilts meaningfully', () => {
    expect(getStickerMotionActivity(0.32, 0.02, 0.01, 0, 1 / 60)).toBeGreaterThan(0.5);
  });

  it('decays motion activity once the device settles down', () => {
    expect(getStickerMotionActivity(0.03, 0.01, 0.01, 1, 1 / 60)).toBeLessThan(1);
  });

  it('caps overlap correction so stacked stickers do not jump across the canvas in one solve', () => {
    const stickers = [
      createPhysicsSticker('left', 150, 150),
      createPhysicsSticker('middle', 150, 150),
      createPhysicsSticker('right', 150, 150),
    ];

    resolveStickerCollisions(stickers, { width: 320, height: 320 }, 0.92, 0.86);

    stickers.forEach((sticker) => {
      expect(Number.isFinite(sticker.x)).toBe(true);
      expect(Number.isFinite(sticker.y)).toBe(true);
      expect(Math.abs(sticker.x - 150)).toBeLessThanOrEqual(54);
      expect(Math.abs(sticker.y - 150)).toBeLessThanOrEqual(54);
    });
  });

  it('keeps two colliding stickers bounded across repeated collision solves', () => {
    const left = createPhysicsSticker('left', 136, 150);
    const right = createPhysicsSticker('right', 184, 150);
    left.vx = 340;
    right.vx = -340;

    for (let frame = 0; frame < 12; frame += 1) {
      left.x += left.vx * (1 / 60);
      right.x += right.vx * (1 / 60);
      resolveStickerCollisions([left, right], { width: 320, height: 320 }, 0.92, 0.86);
    }

    expect(Number.isFinite(left.x)).toBe(true);
    expect(Number.isFinite(right.x)).toBe(true);
    expect(left.x).toBeGreaterThanOrEqual(left.width / 2);
    expect(right.x).toBeLessThanOrEqual(320 - right.width / 2);
    expect(Math.abs(left.vx)).toBeLessThan(340);
    expect(Math.abs(right.vx)).toBeLessThan(340);
    expect(right.x - left.x).toBeGreaterThan(10);
  });

  it('does not add extra sideways drag when stickers collide edge-to-edge', () => {
    const left = createPhysicsSticker('left', 150, 150);
    const right = createPhysicsSticker('right', 214, 150);
    left.vx = 240;
    right.vx = -240;
    left.vy = 120;
    right.vy = -120;

    resolveStickerCollisions([left, right], { width: 360, height: 320 }, 0.92, 0.86);

    expect(Math.abs(left.vy)).toBeGreaterThan(100);
    expect(Math.abs(right.vy)).toBeGreaterThan(100);
  });
});

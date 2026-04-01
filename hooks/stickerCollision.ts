export interface StickerCollisionGeometry {
  collisionRadius: number;
}

export interface StickerCollisionBody extends StickerCollisionGeometry {
  x: number;
  y: number;
  rotation: number;
}

export interface StickerCollisionResult {
  normalX: number;
  normalY: number;
  overlap: number;
}

const MIN_COLLISION_RADIUS = 10;
const COLLISION_RADIUS_RATIO = 0.46;
const MIN_DISTANCE_EPSILON = 0.0001;

function clamp(value: number, minValue: number, maxValue: number) {
  'worklet';
  return Math.min(maxValue, Math.max(minValue, value));
}

export function getStickerCollisionGeometry(
  width: number,
  height: number
): StickerCollisionGeometry {
  'worklet';

  const shortestSide = Math.max(Math.min(width, height), 0);

  return {
    collisionRadius: clamp(shortestSide * COLLISION_RADIUS_RATIO, MIN_COLLISION_RADIUS, shortestSide / 2),
  };
}

export function detectStickerCollision(
  left: StickerCollisionBody,
  right: StickerCollisionBody
): StickerCollisionResult | null {
  'worklet';

  const dx = right.x - left.x;
  const dy = right.y - left.y;
  const radiusSum = left.collisionRadius + right.collisionRadius;
  const distanceSquared = dx * dx + dy * dy;

  if (distanceSquared >= radiusSum * radiusSum) {
    return null;
  }

  if (distanceSquared <= MIN_DISTANCE_EPSILON) {
    return {
      normalX: 1,
      normalY: 0,
      overlap: radiusSum,
    };
  }

  const distance = Math.sqrt(distanceSquared);

  return {
    normalX: dx / distance,
    normalY: dy / distance,
    overlap: radiusSum - distance,
  };
}

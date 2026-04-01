export interface StickerCollisionGeometry {
  collisionRadius: number;
  collisionHalfWidth: number;
  collisionHalfHeight: number;
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
const COLLISION_HORIZONTAL_INSET = 4;
const COLLISION_VERTICAL_INSET = 4;
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

  const safeWidth = Math.max(width, 0);
  const safeHeight = Math.max(height, 0);
  const collisionHalfWidth = clamp(
    safeWidth / 2 - COLLISION_HORIZONTAL_INSET,
    MIN_COLLISION_RADIUS,
    safeWidth / 2
  );
  const collisionHalfHeight = clamp(
    safeHeight / 2 - COLLISION_VERTICAL_INSET,
    MIN_COLLISION_RADIUS,
    safeHeight / 2
  );

  return {
    collisionRadius: Math.min(collisionHalfWidth, collisionHalfHeight),
    collisionHalfWidth,
    collisionHalfHeight,
  };
}

function getDirectionalEllipseRadius(
  body: StickerCollisionBody,
  directionX: number,
  directionY: number
) {
  'worklet';

  const rotationRadians = (body.rotation * Math.PI) / 180;
  const cos = Math.cos(rotationRadians);
  const sin = Math.sin(rotationRadians);
  const localDirectionX = directionX * cos + directionY * sin;
  const localDirectionY = -directionX * sin + directionY * cos;
  const widthDenominator = Math.max(body.collisionHalfWidth * body.collisionHalfWidth, MIN_DISTANCE_EPSILON);
  const heightDenominator = Math.max(
    body.collisionHalfHeight * body.collisionHalfHeight,
    MIN_DISTANCE_EPSILON
  );
  const denominator = Math.sqrt(
    localDirectionX * localDirectionX / widthDenominator +
      localDirectionY * localDirectionY / heightDenominator
  );

  if (denominator <= MIN_DISTANCE_EPSILON) {
    return body.collisionRadius;
  }

  return 1 / denominator;
}

export function detectStickerCollision(
  left: StickerCollisionBody,
  right: StickerCollisionBody
): StickerCollisionResult | null {
  'worklet';

  const dx = right.x - left.x;
  const dy = right.y - left.y;
  const distanceSquared = dx * dx + dy * dy;

  if (distanceSquared <= MIN_DISTANCE_EPSILON) {
    const supportDistance =
      getDirectionalEllipseRadius(left, 1, 0) + getDirectionalEllipseRadius(right, -1, 0);

    return {
      normalX: 1,
      normalY: 0,
      overlap: supportDistance,
    };
  }

  const distance = Math.sqrt(distanceSquared);
  const normalX = dx / distance;
  const normalY = dy / distance;
  const supportDistance =
    getDirectionalEllipseRadius(left, normalX, normalY) +
    getDirectionalEllipseRadius(right, -normalX, -normalY);

  if (distance >= supportDistance) {
    return null;
  }

  return {
    normalX,
    normalY,
    overlap: supportDistance - distance,
  };
}

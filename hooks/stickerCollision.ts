export interface StickerCollisionGeometry {
  broadPhaseRadius: number;
  coreHalfWidth: number;
  coreHalfHeight: number;
  cornerRadius: number;
}

export interface StickerCollisionBody extends StickerCollisionGeometry {
  x: number;
  y: number;
  rotation: number;
}

export interface StickerCollisionFrame {
  axisXx: number;
  axisXy: number;
  axisYx: number;
  axisYy: number;
}

export interface StickerCollisionResult {
  normalX: number;
  normalY: number;
  overlap: number;
}

const DEGREES_TO_RADIANS = Math.PI / 180;
const CORNER_RADIUS_RATIO = 0.18;
const MIN_CORE_HALF_EXTENT = 2;

function clamp(value: number, minValue: number, maxValue: number) {
  'worklet';
  return Math.min(maxValue, Math.max(minValue, value));
}

export function getStickerCollisionGeometry(
  width: number,
  height: number
): StickerCollisionGeometry {
  'worklet';

  const halfWidth = Math.max(width / 2, 0);
  const halfHeight = Math.max(height / 2, 0);
  const minimumCoreHalfExtent = Math.min(MIN_CORE_HALF_EXTENT, halfWidth, halfHeight);
  const maxCornerRadius = Math.max(Math.min(halfWidth, halfHeight) - minimumCoreHalfExtent, 0);
  const desiredCornerRadius = Math.min(width, height) * CORNER_RADIUS_RATIO;
  const cornerRadius = clamp(desiredCornerRadius, 0, maxCornerRadius);

  return {
    broadPhaseRadius: Math.hypot(halfWidth, halfHeight),
    coreHalfWidth: Math.max(halfWidth - cornerRadius, minimumCoreHalfExtent),
    coreHalfHeight: Math.max(halfHeight - cornerRadius, minimumCoreHalfExtent),
    cornerRadius,
  };
}

export function getStickerCollisionFrame(rotation: number): StickerCollisionFrame {
  'worklet';

  const rotationRadians = rotation * DEGREES_TO_RADIANS;
  const cosRotation = Math.cos(rotationRadians);
  const sinRotation = Math.sin(rotationRadians);

  return {
    axisXx: cosRotation,
    axisXy: sinRotation,
    axisYx: -sinRotation,
    axisYy: cosRotation,
  };
}

function getProjectionRadius(
  collider: StickerCollisionGeometry,
  frame: StickerCollisionFrame,
  axisX: number,
  axisY: number
) {
  'worklet';

  const projectionOnX = Math.abs(axisX * frame.axisXx + axisY * frame.axisXy);
  const projectionOnY = Math.abs(axisX * frame.axisYx + axisY * frame.axisYy);

  return (
    collider.coreHalfWidth * projectionOnX +
    collider.coreHalfHeight * projectionOnY +
    collider.cornerRadius
  );
}

export function detectRoundedStickerCollision(
  left: StickerCollisionBody,
  right: StickerCollisionBody,
  leftFrame = getStickerCollisionFrame(left.rotation),
  rightFrame = getStickerCollisionFrame(right.rotation)
): StickerCollisionResult | null {
  'worklet';

  const dx = right.x - left.x;
  const dy = right.y - left.y;
  const broadPhaseDistance = left.broadPhaseRadius + right.broadPhaseRadius;
  const distanceSquared = dx * dx + dy * dy;

  if (distanceSquared >= broadPhaseDistance * broadPhaseDistance) {
    return null;
  }

  let minimumOverlap = Number.POSITIVE_INFINITY;
  let collisionNormalX = 0;
  let collisionNormalY = 0;

  const testAxis = (axisX: number, axisY: number) => {
    'worklet';

    const signedDistance = dx * axisX + dy * axisY;
    const centerDistance = Math.abs(signedDistance);
    const leftProjection = getProjectionRadius(left, leftFrame, axisX, axisY);
    const rightProjection = getProjectionRadius(right, rightFrame, axisX, axisY);
    const overlap = leftProjection + rightProjection - centerDistance;

    if (overlap <= 0) {
      return false;
    }

    if (overlap < minimumOverlap) {
      const normalDirection = signedDistance < 0 ? -1 : 1;
      minimumOverlap = overlap;
      collisionNormalX = axisX * normalDirection;
      collisionNormalY = axisY * normalDirection;
    }

    return true;
  };

  if (!testAxis(leftFrame.axisXx, leftFrame.axisXy)) {
    return null;
  }

  if (!testAxis(leftFrame.axisYx, leftFrame.axisYy)) {
    return null;
  }

  if (!testAxis(rightFrame.axisXx, rightFrame.axisXy)) {
    return null;
  }

  if (!testAxis(rightFrame.axisYx, rightFrame.axisYy)) {
    return null;
  }

  return {
    normalX: collisionNormalX,
    normalY: collisionNormalY,
    overlap: minimumOverlap,
  };
}

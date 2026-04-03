export interface StickerCollisionGeometry {
  collisionRadius: number;
  collisionHalfWidth: number;
  collisionHalfHeight: number;
}

export type StickerCollisionShape = 'ellipse' | 'rect';

export interface StickerCollisionBody extends StickerCollisionGeometry {
  collisionShape?: StickerCollisionShape;
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
  height: number,
  options: {
    horizontalInset?: number;
    verticalInset?: number;
  } = {}
): StickerCollisionGeometry {
  'worklet';

  const safeWidth = Math.max(width, 0);
  const safeHeight = Math.max(height, 0);
  const horizontalInset =
    typeof options.horizontalInset === 'number' ? Math.max(options.horizontalInset, 0) : COLLISION_HORIZONTAL_INSET;
  const verticalInset =
    typeof options.verticalInset === 'number' ? Math.max(options.verticalInset, 0) : COLLISION_VERTICAL_INSET;
  const collisionHalfWidth = clamp(
    safeWidth / 2 - horizontalInset,
    MIN_COLLISION_RADIUS,
    safeWidth / 2
  );
  const collisionHalfHeight = clamp(
    safeHeight / 2 - verticalInset,
    MIN_COLLISION_RADIUS,
    safeHeight / 2
  );

  return {
    collisionRadius: Math.min(collisionHalfWidth, collisionHalfHeight),
    collisionHalfWidth,
    collisionHalfHeight,
  };
}

function getDirectionalSupportDistance(
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

  if (body.collisionShape === 'rect') {
    return (
      Math.abs(localDirectionX) * body.collisionHalfWidth +
      Math.abs(localDirectionY) * body.collisionHalfHeight
    );
  }

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

function getRectAxes(body: StickerCollisionBody) {
  'worklet';

  const rotationRadians = (body.rotation * Math.PI) / 180;
  const cos = Math.cos(rotationRadians);
  const sin = Math.sin(rotationRadians);

  return {
    xAxisX: cos,
    xAxisY: sin,
    yAxisX: -sin,
    yAxisY: cos,
  };
}

function projectRectOntoAxis(
  body: StickerCollisionBody,
  axisX: number,
  axisY: number
) {
  'worklet';

  const axes = getRectAxes(body);
  const centerProjection = body.x * axisX + body.y * axisY;
  const radius =
    Math.abs(axisX * axes.xAxisX + axisY * axes.xAxisY) * body.collisionHalfWidth +
    Math.abs(axisX * axes.yAxisX + axisY * axes.yAxisY) * body.collisionHalfHeight;

  return {
    centerProjection,
    radius,
  };
}

function detectRectRectCollision(
  left: StickerCollisionBody,
  right: StickerCollisionBody
): StickerCollisionResult | null {
  'worklet';

  const leftAxes = getRectAxes(left);
  const rightAxes = getRectAxes(right);
  const candidateAxes = [
    { x: leftAxes.xAxisX, y: leftAxes.xAxisY },
    { x: leftAxes.yAxisX, y: leftAxes.yAxisY },
    { x: rightAxes.xAxisX, y: rightAxes.xAxisY },
    { x: rightAxes.yAxisX, y: rightAxes.yAxisY },
  ];
  let smallestOverlap = Number.POSITIVE_INFINITY;
  let collisionNormalX = 1;
  let collisionNormalY = 0;
  const deltaX = right.x - left.x;
  const deltaY = right.y - left.y;

  for (let index = 0; index < candidateAxes.length; index += 1) {
    const axis = candidateAxes[index];
    const leftProjection = projectRectOntoAxis(left, axis.x, axis.y);
    const rightProjection = projectRectOntoAxis(right, axis.x, axis.y);
    const centerDistance = rightProjection.centerProjection - leftProjection.centerProjection;
    const overlap = leftProjection.radius + rightProjection.radius - Math.abs(centerDistance);

    if (overlap <= 0) {
      return null;
    }

    if (overlap < smallestOverlap) {
      smallestOverlap = overlap;
      const direction = centerDistance < 0 ? -1 : 1;
      collisionNormalX = axis.x * direction;
      collisionNormalY = axis.y * direction;
    }
  }

  if (deltaX * collisionNormalX + deltaY * collisionNormalY < 0) {
    collisionNormalX *= -1;
    collisionNormalY *= -1;
  }

  return {
    normalX: collisionNormalX,
    normalY: collisionNormalY,
    overlap: smallestOverlap,
  };
}

export function detectStickerCollision(
  left: StickerCollisionBody,
  right: StickerCollisionBody
): StickerCollisionResult | null {
  'worklet';

  if (left.collisionShape === 'rect' && right.collisionShape === 'rect') {
    return detectRectRectCollision(left, right);
  }

  const dx = right.x - left.x;
  const dy = right.y - left.y;
  const distanceSquared = dx * dx + dy * dy;

  if (distanceSquared <= MIN_DISTANCE_EPSILON) {
    const supportDistance =
      getDirectionalSupportDistance(left, 1, 0) + getDirectionalSupportDistance(right, -1, 0);

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
    getDirectionalSupportDistance(left, normalX, normalY) +
    getDirectionalSupportDistance(right, -normalX, -normalY);

  if (distance >= supportDistance) {
    return null;
  }

  return {
    normalX,
    normalY,
    overlap: supportDistance - distance,
  };
}

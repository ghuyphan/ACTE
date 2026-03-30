import { useEffect, useMemo } from 'react';
import {
  SensorType,
  useAnimatedSensor,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import type { NoteStickerPlacement } from '../services/noteStickers';
import {
  getStickerDimensions,
  sortStickerPlacements,
  type StickerCanvasLayout,
} from '../components/stickerCanvasMetrics';

interface StickerPhysicsDescriptor {
  id: string;
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
  radius: number;
  rotation: number;
  opacity: number;
}

export interface StickerPhysicsState extends StickerPhysicsDescriptor {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface UseStickerPhysicsParams {
  placements: NoteStickerPlacement[];
  layout: StickerCanvasLayout;
  isActive: boolean;
  sizeMultiplier?: number;
  minimumBaseSize?: number;
  debugTiltOverride?: SharedValue<{
    enabled: boolean;
    x: number;
    y: number;
  }>;
}

const MAX_FRAME_DELTA_MS = 32;
const TILT_ACCELERATION = 1180;
const RESTORE_ACCELERATION = 10.5;
const LINEAR_DAMPING = 0.965;
const BOUNDARY_RESTITUTION = 0.72;
const COLLISION_RESTITUTION = 0.78;
const MAX_SENSOR_COMPONENT = 1.15;
const FLAT_RESTORE_THRESHOLD = 0.28;
const MIN_DISTANCE_EPSILON = 0.001;
const COLLISION_ITERATIONS = 2;

function clamp(value: number, minValue: number, maxValue: number) {
  'worklet';
  return Math.min(maxValue, Math.max(minValue, value));
}

function applyBoundaryConstraint(sticker: StickerPhysicsState, layout: StickerCanvasLayout) {
  'worklet';

  const halfWidth = sticker.width / 2;
  const halfHeight = sticker.height / 2;
  const minX = halfWidth;
  const maxX = Math.max(halfWidth, layout.width - halfWidth);
  const minY = halfHeight;
  const maxY = Math.max(halfHeight, layout.height - halfHeight);

  if (sticker.x < minX) {
    sticker.x = minX;
    if (sticker.vx < 0) {
      sticker.vx = -sticker.vx * BOUNDARY_RESTITUTION;
    }
  } else if (sticker.x > maxX) {
    sticker.x = maxX;
    if (sticker.vx > 0) {
      sticker.vx = -sticker.vx * BOUNDARY_RESTITUTION;
    }
  }

  if (sticker.y < minY) {
    sticker.y = minY;
    if (sticker.vy < 0) {
      sticker.vy = -sticker.vy * BOUNDARY_RESTITUTION;
    }
  } else if (sticker.y > maxY) {
    sticker.y = maxY;
    if (sticker.vy > 0) {
      sticker.vy = -sticker.vy * BOUNDARY_RESTITUTION;
    }
  }
}

function resolveStickerCollisions(stickers: StickerPhysicsState[], layout: StickerCanvasLayout) {
  'worklet';

  for (let iteration = 0; iteration < COLLISION_ITERATIONS; iteration += 1) {
    for (let leftIndex = 0; leftIndex < stickers.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < stickers.length; rightIndex += 1) {
        const left = stickers[leftIndex];
        const right = stickers[rightIndex];
        const dx = right.x - left.x;
        const dy = right.y - left.y;
        const minDistance = left.radius + right.radius;
        const distanceSquared = dx * dx + dy * dy;

        if (distanceSquared >= minDistance * minDistance) {
          continue;
        }

        const distance = Math.max(Math.sqrt(distanceSquared), MIN_DISTANCE_EPSILON);
        const normalX = dx / distance;
        const normalY = dy / distance;
        const overlap = minDistance - distance;
        const correction = overlap / 2;

        left.x -= normalX * correction;
        left.y -= normalY * correction;
        right.x += normalX * correction;
        right.y += normalY * correction;

        const relativeVelocityX = right.vx - left.vx;
        const relativeVelocityY = right.vy - left.vy;
        const separatingVelocity = relativeVelocityX * normalX + relativeVelocityY * normalY;

        if (separatingVelocity < 0) {
          const impulse = (-(1 + COLLISION_RESTITUTION) * separatingVelocity) / 2;
          left.vx -= impulse * normalX;
          left.vy -= impulse * normalY;
          right.vx += impulse * normalX;
          right.vy += impulse * normalY;
        }

        applyBoundaryConstraint(left, layout);
        applyBoundaryConstraint(right, layout);
      }
    }
  }
}

export function useStickerPhysics({
  placements,
  layout,
  isActive,
  sizeMultiplier = 1,
  minimumBaseSize = 68,
  debugTiltOverride,
}: UseStickerPhysicsParams): SharedValue<StickerPhysicsState[]> {
  const gravitySensor = useAnimatedSensor(SensorType.GRAVITY, { interval: 'auto' });
  const activeSharedValue = useSharedValue(isActive);
  const physicsState = useSharedValue<StickerPhysicsState[]>([]);
  const hasValidLayout = layout.width > 1 && layout.height > 1;

  const descriptors = useMemo<StickerPhysicsDescriptor[]>(
    () =>
      sortStickerPlacements(placements).map((placement) => {
        const dimensions = getStickerDimensions(placement, layout, sizeMultiplier, minimumBaseSize);
        return {
          id: placement.id,
          anchorX: placement.x * layout.width,
          anchorY: placement.y * layout.height,
          width: dimensions.width,
          height: dimensions.height,
          radius: Math.max(dimensions.width, dimensions.height) / 2,
          rotation: placement.rotation,
          opacity: placement.opacity,
        };
      }),
    [layout, minimumBaseSize, placements, sizeMultiplier]
  );

  useEffect(() => {
    activeSharedValue.value = isActive;
  }, [activeSharedValue, isActive]);

  useEffect(() => {
    const previousStates = physicsState.value;
    const previousById = new Map(previousStates.map((state) => [state.id, state] as const));

    physicsState.value = descriptors.map((descriptor) => {
      const previousState = previousById.get(descriptor.id);
      const nextX = previousState && isActive ? previousState.x : descriptor.anchorX;
      const nextY = previousState && isActive ? previousState.y : descriptor.anchorY;

      return {
        ...descriptor,
        x: nextX,
        y: nextY,
        vx: previousState && isActive ? previousState.vx : 0,
        vy: previousState && isActive ? previousState.vy : 0,
      };
    });
  }, [descriptors, isActive, physicsState]);

  const frameCallback = useFrameCallback((frameInfo) => {
    'worklet';

    if (!activeSharedValue.value || !hasValidLayout || physicsState.value.length === 0) {
      return;
    }

    const deltaTimeMs = frameInfo.timeSincePreviousFrame ?? 16.667;
    const dt = Math.min(deltaTimeMs, MAX_FRAME_DELTA_MS) / 1000;
    const damping = Math.pow(LINEAR_DAMPING, dt * 60);
    const sensor = gravitySensor.sensor.value;
    const tiltOverride = debugTiltOverride?.value;
    const normalizedGravityX = clamp(
      tiltOverride?.enabled ? tiltOverride.x : sensor.x / 9.81,
      -MAX_SENSOR_COMPONENT,
      MAX_SENSOR_COMPONENT
    );
    const normalizedGravityY = clamp(
      tiltOverride?.enabled ? tiltOverride.y : -sensor.y / 9.81,
      -MAX_SENSOR_COMPONENT,
      MAX_SENSOR_COMPONENT
    );
    const tiltMagnitude = Math.sqrt(
      normalizedGravityX * normalizedGravityX + normalizedGravityY * normalizedGravityY
    );
    const flatRestoreFactor = clamp(1 - tiltMagnitude / FLAT_RESTORE_THRESHOLD, 0, 1);
    const nextStates = physicsState.value.map((state) => ({ ...state }));

    for (let index = 0; index < nextStates.length; index += 1) {
      const sticker = nextStates[index];
      const restoreX = (sticker.anchorX - sticker.x) * RESTORE_ACCELERATION * flatRestoreFactor;
      const restoreY = (sticker.anchorY - sticker.y) * RESTORE_ACCELERATION * flatRestoreFactor;

      sticker.vx += (normalizedGravityX * TILT_ACCELERATION + restoreX) * dt;
      sticker.vy += (normalizedGravityY * TILT_ACCELERATION + restoreY) * dt;
      sticker.vx *= damping;
      sticker.vy *= damping;
      sticker.x += sticker.vx * dt;
      sticker.y += sticker.vy * dt;

      applyBoundaryConstraint(sticker, layout);
    }

    resolveStickerCollisions(nextStates, layout);
    physicsState.value = nextStates;
  }, false);

  useEffect(() => {
    frameCallback.setActive(isActive && hasValidLayout && descriptors.length > 0);
    return () => {
      frameCallback.setActive(false);
    };
  }, [descriptors.length, frameCallback, hasValidLayout, isActive]);

  return physicsState;
}

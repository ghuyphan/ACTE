import { useEffect, useMemo } from 'react';
import {
  SensorType,
  useAnimatedSensor,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import type { NoteStickerPlacement } from '../services/noteStickers';
import type { StickerMotionVariant } from '../services/noteAppearance';
import {
  getStickerDimensions,
  sortStickerPlacements,
  type StickerCanvasLayout,
} from '../components/stickerCanvasMetrics';
import {
  detectRoundedStickerCollision,
  getStickerCollisionFrame,
  getStickerCollisionGeometry,
} from './stickerCollision';

interface StickerPhysicsDescriptor {
  id: string;
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
  broadPhaseRadius: number;
  coreHalfWidth: number;
  coreHalfHeight: number;
  cornerRadius: number;
  baseRotation: number;
  opacity: number;
}

export interface StickerPhysicsState extends StickerPhysicsDescriptor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  angularVelocity: number;
  jellyScaleX: number;
  jellyScaleY: number;
}

interface UseStickerPhysicsParams {
  placements: NoteStickerPlacement[];
  layout: StickerCanvasLayout;
  isActive: boolean;
  motionVariant?: StickerMotionVariant;
  sizeMultiplier?: number;
  minimumBaseSize?: number;
  debugTiltOverride?: SharedValue<{
    enabled: boolean;
    x: number;
    y: number;
  }>;
}

type StickerMotionProfile = {
  tiltAcceleration: number;
  crossAcceleration: number;
  restoreAcceleration: number;
  minimumRestoreFactor: number;
  linearDamping: number;
  angularDamping: number;
  rotationRestoreAcceleration: number;
  boundaryRestitution: number;
  collisionRestitution: number;
  orbitalStrength: number;
  orbitalLimit: number;
  jellyResponse: number;
  maxJellyStretch: number;
  jellyCompression: number;
  jellyRotationFactor: number;
  jellyRotationResponse: number;
  velocityNormalization: number;
  minJellyScale: number;
  floatLift: number;
  bobAmplitude: number;
  bobSpeed: number;
  waveStrengthX: number;
  waveStrengthY: number;
  waveSpeedX: number;
  waveSpeedY: number;
  waterLineRatio: number;
  buoyancyStrength: number;
  downwardTiltMultiplier: number;
  upwardTiltMultiplier: number;
  waterBandHeight: number;
  surfaceDriftAmplitude: number;
};

const MAX_FRAME_DELTA_MS = 32;
const TILT_ACCELERATION = 1510;
const TILT_CROSS_ACCELERATION = 185;
const RESTORE_ACCELERATION = 8.1;
const LINEAR_DAMPING = 0.978;
const ANGULAR_DAMPING = 0.952;
const ROTATION_RESTORE_ACCELERATION = 8.5;
const BOUNDARY_RESTITUTION = 0.86;
const COLLISION_RESTITUTION = 0.92;
const MAX_SENSOR_COMPONENT = 1.15;
const FLAT_RESTORE_THRESHOLD = 0.28;
const COLLISION_ITERATIONS = 3;
const COLLISION_SPIN_FACTOR = 0.34;
const BOUNDARY_SPIN_FACTOR = 0.18;
const MAX_ANGULAR_VELOCITY = 165;
const MAX_LINEAR_VELOCITY = 1550;

const PHYSICS_PROFILE: StickerMotionProfile = {
  tiltAcceleration: 1510,
  crossAcceleration: 185,
  restoreAcceleration: 8.1,
  minimumRestoreFactor: 0,
  linearDamping: 0.978,
  angularDamping: 0.952,
  rotationRestoreAcceleration: 8.5,
  boundaryRestitution: 0.86,
  collisionRestitution: 0.92,
  orbitalStrength: 0.55,
  orbitalLimit: 160,
  jellyResponse: 0.24,
  maxJellyStretch: 0.14,
  jellyCompression: 0.72,
  jellyRotationFactor: 0.00018,
  jellyRotationResponse: 0.2,
  velocityNormalization: 1080,
  minJellyScale: 0.92,
  floatLift: 0,
  bobAmplitude: 0,
  bobSpeed: 0,
  waveStrengthX: 0,
  waveStrengthY: 0,
  waveSpeedX: 0,
  waveSpeedY: 0,
  waterLineRatio: 1,
  buoyancyStrength: 0,
  downwardTiltMultiplier: 1,
  upwardTiltMultiplier: 1,
  waterBandHeight: 0,
  surfaceDriftAmplitude: 0,
};

const WATER_PROFILE: StickerMotionProfile = {
  tiltAcceleration: 520,
  crossAcceleration: 150,
  restoreAcceleration: 6.4,
  minimumRestoreFactor: 0.58,
  linearDamping: 0.988,
  angularDamping: 0.966,
  rotationRestoreAcceleration: 5.7,
  boundaryRestitution: 0.72,
  collisionRestitution: 0.84,
  orbitalStrength: 0.62,
  orbitalLimit: 150,
  jellyResponse: 0.22,
  maxJellyStretch: 0.09,
  jellyCompression: 0.42,
  jellyRotationFactor: 0.00014,
  jellyRotationResponse: 0.18,
  velocityNormalization: 920,
  minJellyScale: 0.985,
  floatLift: 16,
  bobAmplitude: 9,
  bobSpeed: 1.5,
  waveStrengthX: 58,
  waveStrengthY: 36,
  waveSpeedX: 1.45,
  waveSpeedY: 1.2,
  waterLineRatio: 0.56,
  buoyancyStrength: 460,
  downwardTiltMultiplier: 0.28,
  upwardTiltMultiplier: 0.72,
  waterBandHeight: 26,
  surfaceDriftAmplitude: 10,
};

function getMotionProfile(motionVariant: StickerMotionVariant) {
  'worklet';
  return motionVariant === 'water' ? WATER_PROFILE : PHYSICS_PROFILE;
}

export function getStickerRestAnchorY(
  anchorY: number,
  layoutHeight: number,
  motionVariant: StickerMotionVariant,
  anchorX = 0
) {
  'worklet';
  const profile = motionVariant === 'water' ? WATER_PROFILE : PHYSICS_PROFILE;
  if (motionVariant !== 'water') {
    return anchorY;
  }

  const surfaceY = layoutHeight * profile.waterLineRatio;
  const surfaceDrift =
    Math.sin(anchorX * 0.019) * profile.surfaceDriftAmplitude +
    Math.cos(anchorX * 0.008) * profile.surfaceDriftAmplitude * 0.35;
  const restingAnchorY =
    anchorY <= surfaceY
      ? anchorY + surfaceDrift * 0.3
      : surfaceY + Math.min((anchorY - surfaceY) * 0.22, profile.waterBandHeight) + surfaceDrift;

  return restingAnchorY - profile.floatLift;
}

function clamp(value: number, minValue: number, maxValue: number) {
  'worklet';
  return Math.min(maxValue, Math.max(minValue, value));
}

function clampVelocity(sticker: StickerPhysicsState) {
  'worklet';

  sticker.vx = clamp(sticker.vx, -MAX_LINEAR_VELOCITY, MAX_LINEAR_VELOCITY);
  sticker.vy = clamp(sticker.vy, -MAX_LINEAR_VELOCITY, MAX_LINEAR_VELOCITY);
  sticker.angularVelocity = clamp(
    sticker.angularVelocity,
    -MAX_ANGULAR_VELOCITY,
    MAX_ANGULAR_VELOCITY
  );
}

function applyBoundaryConstraint(
  sticker: StickerPhysicsState,
  layout: StickerCanvasLayout,
  boundaryRestitution: number
) {
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
      sticker.vx = -sticker.vx * boundaryRestitution;
      sticker.angularVelocity += Math.abs(sticker.vx) * BOUNDARY_SPIN_FACTOR;
    }
  } else if (sticker.x > maxX) {
    sticker.x = maxX;
    if (sticker.vx > 0) {
      sticker.vx = -sticker.vx * boundaryRestitution;
      sticker.angularVelocity -= Math.abs(sticker.vx) * BOUNDARY_SPIN_FACTOR;
    }
  }

  if (sticker.y < minY) {
    sticker.y = minY;
    if (sticker.vy < 0) {
      sticker.vy = -sticker.vy * boundaryRestitution;
      sticker.angularVelocity -= Math.abs(sticker.vy) * BOUNDARY_SPIN_FACTOR;
    }
  } else if (sticker.y > maxY) {
    sticker.y = maxY;
    if (sticker.vy > 0) {
      sticker.vy = -sticker.vy * boundaryRestitution;
      sticker.angularVelocity += Math.abs(sticker.vy) * BOUNDARY_SPIN_FACTOR;
    }
  }
}

function resolveStickerCollisions(
  stickers: StickerPhysicsState[],
  layout: StickerCanvasLayout,
  collisionRestitution: number,
  boundaryRestitution: number
) {
  'worklet';

  const collisionFrames = stickers.map((sticker) => getStickerCollisionFrame(sticker.rotation));

  for (let iteration = 0; iteration < COLLISION_ITERATIONS; iteration += 1) {
    for (let leftIndex = 0; leftIndex < stickers.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < stickers.length; rightIndex += 1) {
        const left = stickers[leftIndex];
        const right = stickers[rightIndex];
        const collision = detectRoundedStickerCollision(
          left,
          right,
          collisionFrames[leftIndex],
          collisionFrames[rightIndex]
        );

        if (!collision) {
          continue;
        }
        const { normalX, normalY, overlap } = collision;
        const correction = overlap / 2;

        left.x -= normalX * correction;
        left.y -= normalY * correction;
        right.x += normalX * correction;
        right.y += normalY * correction;

        const relativeVelocityX = right.vx - left.vx;
        const relativeVelocityY = right.vy - left.vy;
        const separatingVelocity = relativeVelocityX * normalX + relativeVelocityY * normalY;

        if (separatingVelocity < 0) {
          const impulse = (-(1 + collisionRestitution) * separatingVelocity) / 2;
          left.vx -= impulse * normalX;
          left.vy -= impulse * normalY;
          right.vx += impulse * normalX;
          right.vy += impulse * normalY;

          const tangentialVelocity =
            relativeVelocityX * -normalY + relativeVelocityY * normalX;
          const spinImpulse = tangentialVelocity * COLLISION_SPIN_FACTOR;
          left.angularVelocity -= spinImpulse;
          right.angularVelocity += spinImpulse;
          left.vx -= normalY * spinImpulse * 0.12;
          left.vy += normalX * spinImpulse * 0.12;
          right.vx += normalY * spinImpulse * 0.12;
          right.vy -= normalX * spinImpulse * 0.12;
        }

        clampVelocity(left);
        clampVelocity(right);
        applyBoundaryConstraint(left, layout, boundaryRestitution);
        applyBoundaryConstraint(right, layout, boundaryRestitution);
      }
    }
  }
}

export function useStickerPhysics({
  placements,
  layout,
  isActive,
  motionVariant = 'physics',
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
        const collisionGeometry = getStickerCollisionGeometry(
          dimensions.width,
          dimensions.height
        );
        return {
          id: placement.id,
          anchorX: placement.x * layout.width,
          anchorY: placement.y * layout.height,
          width: dimensions.width,
          height: dimensions.height,
          broadPhaseRadius: collisionGeometry.broadPhaseRadius,
          coreHalfWidth: collisionGeometry.coreHalfWidth,
          coreHalfHeight: collisionGeometry.coreHalfHeight,
          cornerRadius: collisionGeometry.cornerRadius,
          baseRotation: placement.rotation,
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
        rotation: previousState && isActive ? previousState.rotation : descriptor.baseRotation,
        angularVelocity: previousState && isActive ? previousState.angularVelocity : 0,
        jellyScaleX: previousState && isActive ? previousState.jellyScaleX : 1,
        jellyScaleY: previousState && isActive ? previousState.jellyScaleY : 1,
      };
    });
  }, [descriptors, isActive, physicsState]);

  const frameCallback = useFrameCallback((frameInfo) => {
    'worklet';

    if (!activeSharedValue.value || !hasValidLayout || physicsState.value.length === 0) {
      return;
    }

    const profile = getMotionProfile(motionVariant);
    const deltaTimeMs = frameInfo.timeSincePreviousFrame ?? 16.667;
    const dt = Math.min(deltaTimeMs, MAX_FRAME_DELTA_MS) / 1000;
    const elapsedSeconds = (frameInfo.timeSinceFirstFrame ?? 0) / 1000;
    const damping = Math.pow(profile.linearDamping, dt * 60);
    const angularDamping = Math.pow(profile.angularDamping, dt * 60);
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
      const surfaceY = layout.height * profile.waterLineRatio;
      const bobOffsetY =
        profile.bobAmplitude > 0
          ? Math.sin(elapsedSeconds * profile.bobSpeed + index * 0.9 + sticker.anchorX * 0.003) *
            profile.bobAmplitude
          : 0;
      const targetAnchorY =
        getStickerRestAnchorY(sticker.anchorY, layout.height, motionVariant, sticker.anchorX) +
        bobOffsetY;
      const restoreFactor = Math.max(profile.minimumRestoreFactor, flatRestoreFactor);
      const restoreX =
        (sticker.anchorX - sticker.x) * profile.restoreAcceleration * restoreFactor;
      const restoreY =
        (targetAnchorY - sticker.y) * profile.restoreAcceleration * restoreFactor;
      const crossAxisX = normalizedGravityY * profile.crossAcceleration;
      const crossAxisY = -normalizedGravityX * profile.crossAcceleration;
      const stickerOffsetX = sticker.x - sticker.anchorX;
      const stickerOffsetY = sticker.y - sticker.anchorY;
      const orbitalX = clamp(
        stickerOffsetY * -profile.orbitalStrength,
        -profile.orbitalLimit,
        profile.orbitalLimit
      );
      const orbitalY = clamp(
        stickerOffsetX * profile.orbitalStrength,
        -profile.orbitalLimit,
        profile.orbitalLimit
      );
      const waveSeed = index * 0.82 + sticker.anchorX * 0.0027 + sticker.anchorY * 0.0014;
      const waveX =
        profile.waveStrengthX > 0
          ? Math.sin(elapsedSeconds * profile.waveSpeedX + waveSeed) * profile.waveStrengthX
          : 0;
      const waveY =
        profile.waveStrengthY > 0
          ? Math.cos(elapsedSeconds * profile.waveSpeedY + waveSeed * 1.35) * profile.waveStrengthY
          : 0;
      const verticalTiltMultiplier =
        normalizedGravityY >= 0
          ? profile.downwardTiltMultiplier
          : profile.upwardTiltMultiplier;
      const submergedDepth = Math.max(sticker.y - surfaceY, 0);
      const buoyancyY =
        motionVariant === 'water'
          ? -submergedDepth * (profile.buoyancyStrength / Math.max(layout.height, 1))
          : 0;

      sticker.vx +=
        (normalizedGravityX * profile.tiltAcceleration + crossAxisX + orbitalX + restoreX + waveX) *
        dt;
      sticker.vy +=
        (
          normalizedGravityY * profile.tiltAcceleration * verticalTiltMultiplier +
          crossAxisY +
          orbitalY +
          restoreY +
          waveY +
          buoyancyY
        ) * dt;
      sticker.vx *= damping;
      sticker.vy *= damping;
      clampVelocity(sticker);
      sticker.x += sticker.vx * dt;
      sticker.y += sticker.vy * dt;
      sticker.angularVelocity +=
        (normalizedGravityX * sticker.vy - normalizedGravityY * sticker.vx) * 0.0024 * dt;
      sticker.angularVelocity +=
        (sticker.baseRotation - sticker.rotation) *
        profile.rotationRestoreAcceleration *
        Math.max(0.12, flatRestoreFactor) *
        dt;
      sticker.angularVelocity += (orbitalX - orbitalY) * 0.006 * dt;
      sticker.angularVelocity *= angularDamping;
      clampVelocity(sticker);
      sticker.rotation += sticker.angularVelocity * dt;

      const normalizedVx = clamp(Math.abs(sticker.vx) / profile.velocityNormalization, 0, 1);
      const normalizedVy = clamp(Math.abs(sticker.vy) / profile.velocityNormalization, 0, 1);
      const targetJellyX =
        clamp(
          1 +
            normalizedVx * profile.maxJellyStretch -
            normalizedVy * profile.maxJellyStretch * profile.jellyCompression,
          profile.minJellyScale,
          1 + profile.maxJellyStretch
        );
      const targetJellyY =
        clamp(
          1 +
            normalizedVy * profile.maxJellyStretch -
            normalizedVx * profile.maxJellyStretch * profile.jellyCompression,
          profile.minJellyScale,
          1 + profile.maxJellyStretch
        );
      const jellyStep = 1 - Math.pow(1 - profile.jellyResponse, dt * 60);
      sticker.jellyScaleX += (targetJellyX - sticker.jellyScaleX) * jellyStep;
      sticker.jellyScaleY += (targetJellyY - sticker.jellyScaleY) * jellyStep;
      sticker.rotation +=
        (sticker.vx - sticker.vy) * profile.jellyRotationFactor * profile.jellyRotationResponse;

      applyBoundaryConstraint(sticker, layout, profile.boundaryRestitution);
    }

    resolveStickerCollisions(
      nextStates,
      layout,
      profile.collisionRestitution,
      profile.boundaryRestitution
    );
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

import { useEffect, useMemo } from 'react';
import {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { WindowRect } from '../home/capture/stickerCreationTypes';

const ENTRY_DURATION_MS = 500;
const ENTRY_DURATION_REDUCED_MS = 210;
const ENTRY_MIN_ARC_LIFT = 18;
const ENTRY_MAX_ARC_LIFT = 42;
const ENTRY_MAX_TILT_DEGREES = 5;

export interface StickerEntryAnimation {
  placementId: string;
  sourceRect: WindowRect;
  startDelayMs?: number;
}

interface UseStickerEntryAnimationOptions {
  canvasWindowRect: WindowRect | null;
  entryAnimation?: StickerEntryAnimation | null;
  frameHeight: number;
  frameWidth: number;
  normalizedScale: number;
  onComplete?: (placementId: string) => void;
  placementId: string;
  targetLeft: number;
  targetTop: number;
}

export function useStickerEntryAnimation({
  canvasWindowRect,
  entryAnimation,
  frameHeight,
  frameWidth,
  normalizedScale,
  onComplete,
  placementId,
  targetLeft,
  targetTop,
}: UseStickerEntryAnimationOptions) {
  const reduceMotionEnabled = useReducedMotion();
  const entryAnimationActive = Boolean(entryAnimation);
  const entryProgress = useSharedValue(entryAnimationActive ? 0 : 1);
  const entryMotion = useMemo(() => {
    if (!entryAnimation || !canvasWindowRect) {
      return null;
    }

    const targetCenterX = canvasWindowRect.x + targetLeft + frameWidth / 2;
    const targetCenterY = canvasWindowRect.y + targetTop + frameHeight / 2;
    const sourceCenterX = entryAnimation.sourceRect.x + entryAnimation.sourceRect.width / 2;
    const sourceCenterY = entryAnimation.sourceRect.y + entryAnimation.sourceRect.height / 2;
    const renderedTargetWidth = Math.max(frameWidth * normalizedScale, 1);
    const renderedTargetHeight = Math.max(frameHeight * normalizedScale, 1);
    const initialScale = Math.max(
      0.18,
      Math.min(
        entryAnimation.sourceRect.width / renderedTargetWidth,
        entryAnimation.sourceRect.height / renderedTargetHeight
      )
    );
    const travelDistance = Math.hypot(
      sourceCenterX - targetCenterX,
      sourceCenterY - targetCenterY
    );
    const directionSeed = sourceCenterX === targetCenterX
      ? targetCenterY - sourceCenterY
      : sourceCenterX - targetCenterX;
    const tiltDirection = directionSeed >= 0 ? 1 : -1;

    return {
      translateX: sourceCenterX - targetCenterX,
      translateY: sourceCenterY - targetCenterY,
      scale: Number.isFinite(initialScale) ? initialScale : 1,
      arcLift: Math.min(
        ENTRY_MAX_ARC_LIFT,
        Math.max(ENTRY_MIN_ARC_LIFT, travelDistance * 0.12)
      ),
      tilt: travelDistance > 24
        ? tiltDirection * Math.min(ENTRY_MAX_TILT_DEGREES, 3 + travelDistance / 92)
        : 0,
    };
  }, [
    canvasWindowRect,
    entryAnimation,
    frameHeight,
    frameWidth,
    normalizedScale,
    targetLeft,
    targetTop,
  ]);

  useEffect(() => {
    if (!entryAnimationActive) {
      entryProgress.value = 1;
      return;
    }

    if (!entryMotion) {
      return;
    }

    entryProgress.value = 0;
    const handleComplete = (finished?: boolean) => {
      'worklet';

      if (finished && onComplete) {
        runOnJS(onComplete)(placementId);
      }
    };

    const timing = withTiming(
      1,
      {
        duration: reduceMotionEnabled ? ENTRY_DURATION_REDUCED_MS : ENTRY_DURATION_MS,
        easing: reduceMotionEnabled ? Easing.out(Easing.cubic) : Easing.out(Easing.quad),
      },
      handleComplete
    );
    const startDelayMs = Math.max(0, entryAnimation?.startDelayMs ?? 0);
    entryProgress.value = startDelayMs > 0 && !reduceMotionEnabled
      ? withDelay(startDelayMs, timing)
      : timing;
  }, [
    entryAnimation?.startDelayMs,
    entryAnimationActive,
    entryMotion,
    entryProgress,
    onComplete,
    placementId,
    reduceMotionEnabled,
  ]);

  const entryAnimatedStyle = useAnimatedStyle(() => {
    if (!entryMotion) {
      return {
        opacity: entryAnimationActive ? 0 : 1,
        transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
      };
    }

    const progress = entryProgress.value;
    const arcOffset = reduceMotionEnabled
      ? 0
      : interpolate(
          progress,
          [0, 0.52, 1],
          [0, -entryMotion.arcLift, 0],
          Extrapolation.CLAMP
        );
    const scale = reduceMotionEnabled
      ? interpolate(progress, [0, 1], [entryMotion.scale, 1], Extrapolation.CLAMP)
      : interpolate(
          progress,
          [0, 0.72, 0.9, 1],
          [entryMotion.scale, 1.025, 0.996, 1],
          Extrapolation.CLAMP
        );
    const rotateDegrees = reduceMotionEnabled
      ? 0
      : interpolate(
          progress,
          [0, 0.34, 0.74, 1],
          [0, entryMotion.tilt, -entryMotion.tilt * 0.16, 0],
          Extrapolation.CLAMP
        );

    return {
      opacity: 1,
      transform: [
        {
          translateX: interpolate(progress, [0, 1], [entryMotion.translateX, 0]),
        },
        {
          translateY: interpolate(progress, [0, 1], [entryMotion.translateY, 0]) + arcOffset,
        },
        { rotate: `${rotateDegrees}deg` },
        { scale },
      ],
    };
  }, [entryAnimationActive, entryMotion, entryProgress, reduceMotionEnabled]);

  return {
    entryAnimatedStyle,
    entryAnimationActive,
  };
}

export default useStickerEntryAnimation;

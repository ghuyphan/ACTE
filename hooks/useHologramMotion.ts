import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { useReducedMotion } from './useReducedMotion';

const DEFAULT_EDITOR_STRENGTH = 1;
const DEFAULT_SAVED_STRENGTH = 0.55;
const ROTATION_GAMMA_MAX = 0.55;
const ROTATION_BETA_MAX = 0.75;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getDeviceRotationValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

interface DeviceMotionModule {
  isAvailableAsync: () => Promise<boolean>;
  setUpdateInterval: (intervalMs: number) => void;
  addListener: (listener: (motion: { rotation?: { beta?: number; gamma?: number } }) => void) => {
    remove?: () => void;
  };
}

export function useHologramMotion({
  enabled,
  previewMode = 'saved',
  strength,
}: {
  enabled: boolean;
  previewMode?: 'saved' | 'editor';
  strength?: number;
}) {
  const reduceMotionEnabled = useReducedMotion();
  const tiltX = useRef(new Animated.Value(0)).current;
  const tiltY = useRef(new Animated.Value(0)).current;
  const [isMotionAvailable, setIsMotionAvailable] = useState(false);

  const effectiveStrength = useMemo(
    () => strength ?? (previewMode === 'editor' ? DEFAULT_EDITOR_STRENGTH : DEFAULT_SAVED_STRENGTH),
    [previewMode, strength]
  );

  useEffect(() => {
    let isActive = true;
    let subscription: { remove?: () => void } | null = null;

    const resetTilt = () => {
      tiltX.stopAnimation();
      tiltY.stopAnimation();
      Animated.parallel([
        Animated.spring(tiltX, {
          toValue: 0,
          speed: 18,
          bounciness: 0,
          useNativeDriver: true,
        }),
        Animated.spring(tiltY, {
          toValue: 0,
          speed: 18,
          bounciness: 0,
          useNativeDriver: true,
        }),
      ]).start();
    };

    if (!enabled || reduceMotionEnabled) {
      setIsMotionAvailable(false);
      resetTilt();
      return;
    }

    import('expo-sensors')
      .then((module) => {
        const deviceMotion = (module as { DeviceMotion?: DeviceMotionModule }).DeviceMotion;
        if (!deviceMotion) {
          throw new Error('DeviceMotion unavailable');
        }

        return deviceMotion.isAvailableAsync().then((available) => ({
          available,
          deviceMotion,
        }));
      })
      .then(({ available, deviceMotion }) => {
        if (!isActive) {
          return;
        }

        setIsMotionAvailable(Boolean(available));
        if (!available) {
          resetTilt();
          return;
        }

        deviceMotion.setUpdateInterval(80);
        subscription = deviceMotion.addListener((motion) => {
          const nextTiltX =
            clamp(
              getDeviceRotationValue(motion.rotation?.gamma) / ROTATION_GAMMA_MAX,
              -1,
              1
            ) * effectiveStrength;
          const nextTiltY =
            clamp(
              getDeviceRotationValue(motion.rotation?.beta) / ROTATION_BETA_MAX,
              -1,
              1
            ) * effectiveStrength;

          Animated.parallel([
            Animated.spring(tiltX, {
              toValue: nextTiltX,
              speed: previewMode === 'editor' ? 22 : 18,
              bounciness: 0,
              useNativeDriver: true,
            }),
            Animated.spring(tiltY, {
              toValue: nextTiltY,
              speed: previewMode === 'editor' ? 22 : 18,
              bounciness: 0,
              useNativeDriver: true,
            }),
          ]).start();
        });
      })
      .catch(() => {
        if (isActive) {
          setIsMotionAvailable(false);
          resetTilt();
        }
      });

    return () => {
      isActive = false;
      subscription?.remove?.();
      resetTilt();
    };
  }, [effectiveStrength, enabled, previewMode, reduceMotionEnabled, tiltX, tiltY]);

  return {
    tiltX,
    tiltY,
    isInteractive: enabled && !reduceMotionEnabled && isMotionAvailable,
    reduceMotionEnabled,
  };
}

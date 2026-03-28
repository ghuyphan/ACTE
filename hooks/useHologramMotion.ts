import { useEffect, useMemo, useState } from 'react';
import { cancelAnimation, useSharedValue, withSpring } from 'react-native-reanimated';
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
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const [isMotionAvailable, setIsMotionAvailable] = useState(false);

  const effectiveStrength = useMemo(
    () => strength ?? (previewMode === 'editor' ? DEFAULT_EDITOR_STRENGTH : DEFAULT_SAVED_STRENGTH),
    [previewMode, strength]
  );

  useEffect(() => {
    let isActive = true;
    let subscription: { remove?: () => void } | null = null;

    const resetTilt = () => {
      cancelAnimation(tiltX);
      cancelAnimation(tiltY);
      tiltX.value = withSpring(0, { stiffness: 220, damping: 26 });
      tiltY.value = withSpring(0, { stiffness: 220, damping: 26 });
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

          tiltX.value = withSpring(nextTiltX, {
            stiffness: previewMode === 'editor' ? 260 : 220,
            damping: 28,
          });
          tiltY.value = withSpring(nextTiltY, {
            stiffness: previewMode === 'editor' ? 260 : 220,
            damping: 28,
          });
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

import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export type DualCameraFacing = 'front' | 'back';
export type DualCameraLayoutPreset = 'top-left';

export type DualCameraStillCapture = {
  primaryUri: string;
  secondaryUri: string;
  primaryFacing: DualCameraFacing;
  secondaryFacing: DualCameraFacing;
  width: number;
  height: number;
};

type DualCameraAvailability = {
  available?: boolean;
  supported?: boolean;
  reason?: string | null;
};

type NativeDualCameraModule = {
  getAvailabilityAsync(): Promise<DualCameraAvailability>;
};

const nativeDualCameraModule =
  Platform.OS === 'ios'
    ? requireOptionalNativeModule<NativeDualCameraModule>('NotoDualCamera')
    : null;

export function hasDualCameraNativeModule() {
  return Boolean(nativeDualCameraModule);
}

export async function getDualCameraAvailability() {
  if (!nativeDualCameraModule?.getAvailabilityAsync) {
    return {
      available: false,
      supported: false,
      reason: 'module-unavailable',
    };
  }

  try {
    const availability = await nativeDualCameraModule.getAvailabilityAsync();
    return {
      available: Boolean(availability.available ?? availability.supported),
      supported: Boolean(availability.supported ?? availability.available),
      reason: availability.reason ?? null,
    };
  } catch (error) {
    return {
      available: false,
      supported: false,
      reason: 'availability-failed',
    };
  }
}

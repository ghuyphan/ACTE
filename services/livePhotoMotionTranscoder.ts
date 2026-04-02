import { requireOptionalNativeModule } from 'expo-modules-core';

type NormalizeLivePhotoMotionResult = {
  uri: string;
  size?: number | null;
};

type NativeNotoLivePhotoMotionModule = {
  normalizeAsync(
    sourceUri: string,
    destinationBasePath: string,
    maxDurationSeconds: number,
    maxDimension: number
  ): Promise<NormalizeLivePhotoMotionResult>;
};

const nativeModule =
  requireOptionalNativeModule<NativeNotoLivePhotoMotionModule>('NotoLivePhotoMotion');

export async function normalizeLivePhotoMotionVideo(
  sourceUri: string,
  destinationBasePath: string,
  options: {
    maxDurationSeconds?: number;
    maxDimension?: number;
  } = {}
) {
  if (!nativeModule) {
    return null;
  }

  return nativeModule.normalizeAsync(
    sourceUri,
    destinationBasePath,
    options.maxDurationSeconds ?? 2,
    options.maxDimension ?? 540
  );
}

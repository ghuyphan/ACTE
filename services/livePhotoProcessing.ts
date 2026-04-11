import type { PlanTier } from '../constants/subscription';
import * as FileSystem from '../utils/fileSystem';
import {
  ensureLivePhotoVideoDirectory,
  getPairedVideoFileExtension,
  resolveStoredPairedVideoUri,
} from './livePhotoStorage';
import { normalizeLivePhotoMotionVideo } from './livePhotoMotionTranscoder';

export const LIVE_PHOTO_MAX_DURATION_SECONDS = 2;
export const LIVE_PHOTO_FREE_TARGET_BITRATE = 3_200_000;
export const LIVE_PHOTO_PLUS_TARGET_BITRATE = 6_000_000;

export function getLivePhotoTargetBitrate(tier: PlanTier) {
  return tier === 'plus'
    ? LIVE_PHOTO_PLUS_TARGET_BITRATE
    : LIVE_PHOTO_FREE_TARGET_BITRATE;
}

async function getVideoInfo(videoUri: string) {
  const normalizedVideoUri = resolveStoredPairedVideoUri(videoUri);
  if (!normalizedVideoUri) {
    return null;
  }

  const info = await FileSystem.getInfoAsync(normalizedVideoUri);
  if (!info.exists || info.isDirectory) {
    return null;
  }

  return {
    uri: normalizedVideoUri,
    size: typeof info.size === 'number' ? info.size : null,
  };
}

export async function optimizeLivePhotoVideo(
  sourceUri: string,
  destinationBasePath: string,
  tier: PlanTier = 'free'
) {
  const originalInfo = await getVideoInfo(sourceUri);
  if (!originalInfo) {
    return null;
  }

  try {
    const normalizedVideo = await normalizeLivePhotoMotionVideo(
      originalInfo.uri,
      destinationBasePath,
      {
        targetBitrate: getLivePhotoTargetBitrate(tier),
      }
    );
    if (normalizedVideo?.uri) {
      return {
        uri: normalizedVideo.uri,
        cleanupUri: null as string | null,
        alreadyPersisted: true,
      };
    }
  } catch (error) {
    console.warn('Failed to normalize live photo motion clip natively:', error);
  }

  return {
    uri: originalInfo.uri,
    cleanupUri: null as string | null,
    alreadyPersisted: false,
  };
}

export async function persistLivePhotoVideo(
  sourceUri: string,
  fileBasename: string,
  tier: PlanTier = 'free'
) {
  const directory = await ensureLivePhotoVideoDirectory();
  if (!directory) {
    return null;
  }

  const preparedVideo = await optimizeLivePhotoVideo(
    sourceUri,
    `${directory}${fileBasename}`,
    tier
  );
  if (!preparedVideo?.uri) {
    return null;
  }

  if (preparedVideo.alreadyPersisted) {
    return preparedVideo.uri;
  }

  const destinationPath =
    `${directory}${fileBasename}${getPairedVideoFileExtension(preparedVideo.uri)}`;

  try {
    await FileSystem.copyAsync({ from: preparedVideo.uri, to: destinationPath });
    return destinationPath;
  } finally {
    if (preparedVideo.cleanupUri) {
      await FileSystem.deleteAsync(preparedVideo.cleanupUri, { idempotent: true }).catch(() => undefined);
    }
  }
}

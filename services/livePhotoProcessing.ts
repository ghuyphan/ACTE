import * as FileSystem from '../utils/fileSystem';
import {
  ensureLivePhotoVideoDirectory,
  getPairedVideoFileExtension,
  MAX_SYNCABLE_LIVE_PHOTO_VIDEO_FILE_SIZE_BYTES,
  resolveStoredPairedVideoUri,
} from './livePhotoStorage';

export const LIVE_PHOTO_MAX_DURATION_SECONDS = 3;
const LIVE_PHOTO_VIDEO_MAX_SIZE = 540;

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

export async function optimizeLivePhotoVideo(sourceUri: string) {
  const originalInfo = await getVideoInfo(sourceUri);
  if (!originalInfo) {
    return null;
  }

  if (
    typeof originalInfo.size === 'number' &&
    originalInfo.size <= MAX_SYNCABLE_LIVE_PHOTO_VIDEO_FILE_SIZE_BYTES
  ) {
    return {
      uri: originalInfo.uri,
      cleanupUri: null as string | null,
    };
  }

  throw new Error('Live photo motion clip is too large right now. Pick a shorter clip.');
}

export async function persistLivePhotoVideo(sourceUri: string, fileBasename: string) {
  const directory = await ensureLivePhotoVideoDirectory();
  if (!directory) {
    return null;
  }

  const preparedVideo = await optimizeLivePhotoVideo(sourceUri);
  if (!preparedVideo?.uri) {
    return null;
  }

  const destinationPath = `${directory}${fileBasename}${getPairedVideoFileExtension(preparedVideo.uri)}`;

  try {
    await FileSystem.copyAsync({ from: preparedVideo.uri, to: destinationPath });
    return destinationPath;
  } finally {
    if (preparedVideo.cleanupUri) {
      await FileSystem.deleteAsync(preparedVideo.cleanupUri, { idempotent: true }).catch(() => undefined);
    }
  }
}

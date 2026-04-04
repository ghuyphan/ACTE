import * as FileSystem from '../utils/fileSystem';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import {
  ensureLivePhotoVideoDirectory,
  ensureSharedLivePhotoVideoCacheDirectory,
  MAX_SYNCABLE_LIVE_PHOTO_VIDEO_FILE_SIZE_BYTES,
  readPairedVideoAsArrayBuffer,
  resolveStoredPairedVideoUri,
} from './livePhotoStorage';
import {
  ensurePhotoDirectory,
  ensureSharedPhotoCacheDirectory,
  MAX_SYNCABLE_PHOTO_FILE_SIZE_BYTES,
  readPhotoAsArrayBuffer,
  resolveStoredPhotoUri,
} from './photoStorage';
import {
  getSupabaseErrorMessage,
  isSupabaseNetworkError,
  isSupabaseStorageObjectMissingError,
  requireSupabase,
} from '../utils/supabase';

export const NOTE_MEDIA_BUCKET = 'note-media';
export const SHARED_POST_MEDIA_BUCKET = 'shared-post-media';
export const ROOM_POST_MEDIA_BUCKET = 'room-post-media';
const UPLOAD_RETRY_DELAYS_MS = [250];
const PHOTO_UPLOAD_OPTIMIZATION_PRESETS = [
  { width: 1200, compress: 0.6 },
  { width: 960, compress: 0.4 },
  { width: 800, compress: 0.3 },
];
interface UploadStorageOptions {
  allowOverwrite?: boolean;
  contentType?: string;
}

interface DownloadMediaOptions {
  preferCached?: boolean;
}

interface PreparedUpload {
  uri: string;
  cleanupUri: string | null;
  contentType: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFileExtension(path: string | null | undefined, fallbackExtension: string) {
  const normalizedPath = typeof path === 'string' ? path.trim() : '';
  if (!normalizedPath) {
    return fallbackExtension;
  }

  const filename = normalizedPath.split('/').pop() ?? normalizedPath;
  const extensionIndex = filename.lastIndexOf('.');
  if (extensionIndex <= 0 || extensionIndex === filename.length - 1) {
    return fallbackExtension;
  }

  return filename.slice(extensionIndex).toLowerCase();
}

function getVideoContentType(path: string | null | undefined) {
  const extension = getFileExtension(path, '.mp4');
  if (extension === '.mov' || extension === '.qt') {
    return 'video/quicktime';
  }

  return 'video/mp4';
}

async function getLocalPhotoInfo(photoUri: string) {
  const normalizedPhotoUri = resolveStoredPhotoUri(photoUri);
  if (!normalizedPhotoUri) {
    return null;
  }

  const info = await FileSystem.getInfoAsync(normalizedPhotoUri);
  if (!info.exists || info.isDirectory) {
    return null;
  }

  return {
    uri: normalizedPhotoUri,
    size: typeof info.size === 'number' ? info.size : null,
  };
}

async function getLocalPairedVideoInfo(videoUri: string) {
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

async function optimizePhotoForUpload(photoUri: string) {
  const originalInfo = await getLocalPhotoInfo(photoUri);
  if (!originalInfo) {
    return null;
  }

  if (
    typeof originalInfo.size !== 'number' ||
    originalInfo.size <= MAX_SYNCABLE_PHOTO_FILE_SIZE_BYTES
  ) {
    return {
      uri: originalInfo.uri,
      cleanupUri: null as string | null,
    };
  }

  let currentUri = originalInfo.uri;
  let cleanupUri: string | null = null;

  for (const preset of PHOTO_UPLOAD_OPTIMIZATION_PRESETS) {
    const result = await manipulateAsync(
      currentUri,
      [{ resize: { width: preset.width } }],
      {
        compress: preset.compress,
        format: SaveFormat.JPEG,
      }
    );

    if (cleanupUri && cleanupUri !== originalInfo.uri) {
      await FileSystem.deleteAsync(cleanupUri, { idempotent: true }).catch(() => undefined);
    }

    cleanupUri = result.uri !== originalInfo.uri ? result.uri : null;
    currentUri = result.uri;

    const optimizedInfo = await getLocalPhotoInfo(result.uri);
    if (
      optimizedInfo &&
      (typeof optimizedInfo.size !== 'number' ||
        optimizedInfo.size <= MAX_SYNCABLE_PHOTO_FILE_SIZE_BYTES)
    ) {
      return {
        uri: result.uri,
        cleanupUri,
      };
    }
  }

  if (cleanupUri && cleanupUri !== originalInfo.uri) {
    await FileSystem.deleteAsync(cleanupUri, { idempotent: true }).catch(() => undefined);
  }

  throw new Error('Photo is too large to share right now. Try a smaller photo or retake it closer.');
}

async function optimizePairedVideoForUpload(videoUri: string) {
  const originalInfo = await getLocalPairedVideoInfo(videoUri);
  if (!originalInfo) {
    return null;
  }

  const bestSize =
    typeof originalInfo.size === 'number' ? originalInfo.size : Number.MAX_SAFE_INTEGER;
  if (bestSize > MAX_SYNCABLE_LIVE_PHOTO_VIDEO_FILE_SIZE_BYTES) {
    throw new Error('Live photo motion is too large to share right now. Please retake it closer.');
  }

  return {
    uri: originalInfo.uri,
    cleanupUri: null as string | null,
    contentType: getVideoContentType(originalInfo.uri),
  };
}

async function uploadBytesWithRetry(
  bucket: string,
  path: string,
  payload: ArrayBuffer,
  options: UploadStorageOptions = {}
) {
  for (let attempt = 0; attempt <= UPLOAD_RETRY_DELAYS_MS.length; attempt += 1) {
    const { error } = await requireSupabase().storage.from(bucket).upload(path, payload, {
      contentType: options.contentType ?? 'application/octet-stream',
      upsert: options.allowOverwrite === true,
    });

    if (!error) {
      return;
    }

    if (!isSupabaseNetworkError(error) || attempt === UPLOAD_RETRY_DELAYS_MS.length) {
      throw new Error(getSupabaseErrorMessage(error));
    }

    await sleep(UPLOAD_RETRY_DELAYS_MS[attempt] ?? 250);
  }
}

async function uploadPreparedFileToStorage(
  bucket: string,
  path: string,
  preparedFile: PreparedUpload | null,
  readPayload: (fileUri: string) => Promise<ArrayBuffer | null>,
  options: UploadStorageOptions = {}
) {
  if (!preparedFile?.uri) {
    return null;
  }

  try {
    const payload = await readPayload(preparedFile.uri);
    if (!payload) {
      return null;
    }

    await uploadBytesWithRetry(bucket, path, payload, {
      ...options,
      contentType: preparedFile.contentType,
    });
    return path;
  } finally {
    if (preparedFile.cleanupUri) {
      await FileSystem.deleteAsync(preparedFile.cleanupUri, { idempotent: true }).catch(() => undefined);
    }
  }
}

export async function uploadPhotoToStorage(
  bucket: string,
  path: string,
  photoUri: string | null | undefined,
  options: UploadStorageOptions = {}
) {
  if (!photoUri?.trim()) {
    return null;
  }

  const preparedPhoto = await optimizePhotoForUpload(photoUri);
  return uploadPreparedFileToStorage(
    bucket,
    path,
    preparedPhoto
      ? {
          ...preparedPhoto,
          contentType: 'image/jpeg',
        }
      : null,
    readPhotoAsArrayBuffer,
    options
  );
}

export async function uploadPairedVideoToStorage(
  bucket: string,
  path: string,
  videoUri: string | null | undefined,
  options: UploadStorageOptions = {}
) {
  if (!videoUri?.trim()) {
    return null;
  }

  const preparedVideo = await optimizePairedVideoForUpload(videoUri);
  return uploadPreparedFileToStorage(
    bucket,
    path,
    preparedVideo,
    readPairedVideoAsArrayBuffer,
    options
  );
}

async function createSignedDownloadUrl(bucket: string, path: string) {
  const { data, error } = await requireSupabase().storage.from(bucket).createSignedUrl(path, 60 * 5);
  if (error) {
    if (isSupabaseStorageObjectMissingError(error)) {
      return null;
    }
    throw error;
  }

  return data.signedUrl;
}

export async function downloadPhotoFromStorage(
  bucket: string,
  path: string | null | undefined,
  localId: string,
  options: DownloadMediaOptions = {}
) {
  if (!path?.trim()) {
    return null;
  }

  const directory =
    bucket === NOTE_MEDIA_BUCKET
      ? await ensurePhotoDirectory()
      : await ensureSharedPhotoCacheDirectory();

  if (!directory) {
    return null;
  }

  const destinationPath = `${directory}${localId}.jpg`;
  if (options.preferCached !== false) {
    const cachedInfo = await FileSystem.getInfoAsync(destinationPath).catch(() => null);
    if (cachedInfo?.exists && !cachedInfo.isDirectory) {
      return destinationPath;
    }
  }

  const signedUrl = await createSignedDownloadUrl(bucket, path);
  if (!signedUrl) {
    return null;
  }

  const result = await FileSystem.downloadAsync(signedUrl, destinationPath);
  return result.uri ?? destinationPath;
}

export async function downloadPairedVideoFromStorage(
  bucket: string,
  path: string | null | undefined,
  localId: string,
  options: DownloadMediaOptions = {}
) {
  if (!path?.trim()) {
    return null;
  }

  const directory =
    bucket === NOTE_MEDIA_BUCKET
      ? await ensureLivePhotoVideoDirectory()
      : await ensureSharedLivePhotoVideoCacheDirectory();

  if (!directory) {
    return null;
  }

  const extension = getFileExtension(path, '.mp4');
  const destinationPath = `${directory}${localId}${extension}`;
  if (options.preferCached !== false) {
    const cachedInfo = await FileSystem.getInfoAsync(destinationPath).catch(() => null);
    if (cachedInfo?.exists && !cachedInfo.isDirectory) {
      return destinationPath;
    }
  }

  const signedUrl = await createSignedDownloadUrl(bucket, path);
  if (!signedUrl) {
    return null;
  }

  const result = await FileSystem.downloadAsync(signedUrl, destinationPath);
  return result.uri ?? destinationPath;
}

async function deleteObjectFromStorage(bucket: string, path: string | null | undefined) {
  if (!path?.trim()) {
    return;
  }

  const { error } = await requireSupabase().storage.from(bucket).remove([path]);
  if (error) {
    throw error;
  }
}

export async function deletePhotoFromStorage(bucket: string, path: string | null | undefined) {
  await deleteObjectFromStorage(bucket, path);
}

export async function deletePairedVideoFromStorage(bucket: string, path: string | null | undefined) {
  await deleteObjectFromStorage(bucket, path);
}

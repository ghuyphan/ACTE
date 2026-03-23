import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import {
  ensurePhotoDirectory,
  MAX_SYNCABLE_PHOTO_FILE_SIZE_BYTES,
  readPhotoAsBase64,
  resolveStoredPhotoUri,
} from './photoStorage';
import {
  getSupabaseErrorMessage,
  isSupabaseNetworkError,
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

interface UploadPhotoOptions {
  allowOverwrite?: boolean;
}

interface DownloadPhotoOptions {
  preferCached?: boolean;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
        format: SaveFormat.WEBP,
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

async function uploadBytesWithRetry(
  bucket: string,
  path: string,
  payload: ArrayBuffer,
  options: UploadPhotoOptions = {}
) {
  for (let attempt = 0; attempt <= UPLOAD_RETRY_DELAYS_MS.length; attempt += 1) {
    const { error } = await requireSupabase().storage.from(bucket).upload(path, payload, {
      contentType: 'image/jpeg',
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

export async function uploadPhotoToStorage(
  bucket: string,
  path: string,
  photoUri: string | null | undefined,
  options: UploadPhotoOptions = {}
) {
  if (!photoUri?.trim()) {
    return null;
  }

  const preparedPhoto = await optimizePhotoForUpload(photoUri);
  if (!preparedPhoto?.uri) {
    return null;
  }

  try {
    const base64 = await readPhotoAsBase64(preparedPhoto.uri);
    if (!base64) {
      return null;
    }

    await uploadBytesWithRetry(bucket, path, decode(base64), options);
    return path;
  } finally {
    if (preparedPhoto.cleanupUri) {
      await FileSystem.deleteAsync(preparedPhoto.cleanupUri, { idempotent: true }).catch(() => undefined);
    }
  }
}

export async function downloadPhotoFromStorage(
  bucket: string,
  path: string | null | undefined,
  localId: string,
  options: DownloadPhotoOptions = {}
) {
  if (!path?.trim()) {
    return null;
  }

  const directory = await ensurePhotoDirectory();
  if (!directory) {
    return null;
  }

  const { data, error } = await requireSupabase().storage.from(bucket).createSignedUrl(path, 60 * 5);
  if (error) {
    throw error;
  }

  const destinationPath = `${directory}${localId}.jpg`;
  if (options.preferCached !== false) {
    const cachedInfo = await FileSystem.getInfoAsync(destinationPath).catch(() => null);
    if (cachedInfo?.exists && !cachedInfo.isDirectory) {
      return destinationPath;
    }
  }

  const result = await FileSystem.downloadAsync(data.signedUrl, destinationPath);
  return result.uri ?? destinationPath;
}

export async function deletePhotoFromStorage(bucket: string, path: string | null | undefined) {
  if (!path?.trim()) {
    return;
  }

  const { error } = await requireSupabase().storage.from(bucket).remove([path]);
  if (error) {
    throw error;
  }
}

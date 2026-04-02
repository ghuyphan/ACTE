import * as FileSystem from '../utils/fileSystem';
import type { Note } from './database';

export const LIVE_PHOTO_VIDEO_DIRECTORY = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}live-photo-videos/`
  : null;

export const SHARED_LIVE_PHOTO_VIDEO_CACHE_DIRECTORY = FileSystem.cacheDirectory
  ? `${FileSystem.cacheDirectory}shared-live-photo-videos/`
  : null;

export const MAX_SYNCABLE_LIVE_PHOTO_VIDEO_FILE_SIZE_BYTES = 2.5 * 1024 * 1024;

function extractFilename(fileUri: string | null | undefined) {
  const normalizedFileUri = typeof fileUri === 'string' ? fileUri.trim() : '';
  if (!normalizedFileUri) {
    return null;
  }

  const withoutHash = normalizedFileUri.split('#')[0] ?? normalizedFileUri;
  const withoutQuery = withoutHash.split('?')[0] ?? withoutHash;
  const segments = withoutQuery.split('/').filter(Boolean);
  const filename = segments[segments.length - 1];

  return filename ? decodeURIComponent(filename) : null;
}

export function getPairedVideoFileExtension(
  fileUri: string | null | undefined,
  fallbackExtension = '.mp4'
) {
  const filename = extractFilename(fileUri);
  if (!filename) {
    return fallbackExtension;
  }

  const extensionIndex = filename.lastIndexOf('.');
  if (extensionIndex <= 0 || extensionIndex === filename.length - 1) {
    return fallbackExtension;
  }

  const extension = filename.slice(extensionIndex).toLowerCase();
  switch (extension) {
    case '.mov':
    case '.mp4':
    case '.qt':
      return extension;
    default:
      return fallbackExtension;
  }
}

export function resolveStoredPairedVideoUri(fileUri: string | null | undefined): string {
  const normalizedFileUri = typeof fileUri === 'string' ? fileUri.trim() : '';
  if (!normalizedFileUri || !LIVE_PHOTO_VIDEO_DIRECTORY) {
    return normalizedFileUri;
  }

  if (normalizedFileUri.startsWith(LIVE_PHOTO_VIDEO_DIRECTORY)) {
    return normalizedFileUri;
  }

  const filename = extractFilename(normalizedFileUri);
  if (!filename) {
    return normalizedFileUri;
  }

  if (
    normalizedFileUri.startsWith('live-photo-videos/') ||
    normalizedFileUri.includes('/Documents/live-photo-videos/') ||
    !normalizedFileUri.includes('/')
  ) {
    return `${LIVE_PHOTO_VIDEO_DIRECTORY}${filename}`;
  }

  return normalizedFileUri;
}

export function getNotePairedVideoUri(
  note:
    | Pick<Note, 'type' | 'isLivePhoto' | 'pairedVideoLocalUri'>
    | null
    | undefined
) {
  if (!note || note.type !== 'photo' || !note.isLivePhoto) {
    return '';
  }

  return resolveStoredPairedVideoUri(note.pairedVideoLocalUri);
}

export async function ensureLivePhotoVideoDirectory() {
  if (!LIVE_PHOTO_VIDEO_DIRECTORY) {
    return null;
  }

  await FileSystem.makeDirectoryAsync(LIVE_PHOTO_VIDEO_DIRECTORY, { intermediates: true });
  return LIVE_PHOTO_VIDEO_DIRECTORY;
}

export async function ensureSharedLivePhotoVideoCacheDirectory() {
  if (!SHARED_LIVE_PHOTO_VIDEO_CACHE_DIRECTORY) {
    return null;
  }

  await FileSystem.makeDirectoryAsync(SHARED_LIVE_PHOTO_VIDEO_CACHE_DIRECTORY, {
    intermediates: true,
  });
  return SHARED_LIVE_PHOTO_VIDEO_CACHE_DIRECTORY;
}

export async function readPairedVideoAsBase64(fileUri: string) {
  const normalizedFileUri = resolveStoredPairedVideoUri(fileUri);
  if (!normalizedFileUri) {
    return null;
  }

  const info = await FileSystem.getInfoAsync(normalizedFileUri);
  if (!info.exists || info.isDirectory) {
    return null;
  }

  if (
    typeof info.size === 'number' &&
    info.size > MAX_SYNCABLE_LIVE_PHOTO_VIDEO_FILE_SIZE_BYTES
  ) {
    throw new Error('Live photo motion is too large to sync safely. Please retake it and try again.');
  }

  return FileSystem.readAsStringAsync(normalizedFileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

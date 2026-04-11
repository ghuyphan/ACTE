import * as FileSystem from '../utils/fileSystem';
import type { Note } from './database';
import {
  ensureStoredMediaDirectory,
  extractStoredFilename,
  readStoredMediaFile,
  resolveStoredMediaUri,
} from './storedMediaFiles';

export const LIVE_PHOTO_VIDEO_DIRECTORY = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}live-photo-videos/`
  : null;

export const SHARED_LIVE_PHOTO_VIDEO_CACHE_DIRECTORY = FileSystem.cacheDirectory
  ? `${FileSystem.cacheDirectory}shared-live-photo-videos/`
  : null;

export const MAX_SYNCABLE_LIVE_PHOTO_VIDEO_FILE_SIZE_BYTES = 2.5 * 1024 * 1024;

export function getPairedVideoFileExtension(
  fileUri: string | null | undefined,
  fallbackExtension = '.mp4'
) {
  const filename = extractStoredFilename(fileUri);
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
  return resolveStoredMediaUri(fileUri, {
    directory: LIVE_PHOTO_VIDEO_DIRECTORY,
    legacyDirectoryName: 'live-photo-videos',
  });
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
  return ensureStoredMediaDirectory(LIVE_PHOTO_VIDEO_DIRECTORY);
}

export async function ensureSharedLivePhotoVideoCacheDirectory() {
  return ensureStoredMediaDirectory(SHARED_LIVE_PHOTO_VIDEO_CACHE_DIRECTORY);
}

export async function readPairedVideoAsBase64(fileUri: string) {
  return readStoredMediaFile({
    fileUri,
    resolveUri: resolveStoredPairedVideoUri,
    maxFileSizeBytes: MAX_SYNCABLE_LIVE_PHOTO_VIDEO_FILE_SIZE_BYTES,
    tooLargeErrorMessage: 'Live photo motion is too large to sync safely. Please retake it and try again.',
    read: (resolvedVideoUri) => FileSystem.readAsStringAsync(resolvedVideoUri, {
      encoding: FileSystem.EncodingType.Base64,
    }),
  });
}

export async function readPairedVideoAsArrayBuffer(fileUri: string) {
  return readStoredMediaFile({
    fileUri,
    resolveUri: resolveStoredPairedVideoUri,
    maxFileSizeBytes: MAX_SYNCABLE_LIVE_PHOTO_VIDEO_FILE_SIZE_BYTES,
    tooLargeErrorMessage: 'Live photo motion is too large to sync safely. Please retake it and try again.',
    read: (resolvedVideoUri) => FileSystem.readAsArrayBufferAsync(resolvedVideoUri),
  });
}

import * as FileSystem from '../utils/fileSystem';
import type { Note } from './database';
import {
  ensureStoredMediaDirectory,
  extractStoredFilename,
  readStoredMediaFile,
  resolveStoredMediaUri,
} from './storedMediaFiles';

export const PHOTO_DIRECTORY = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}photos/`
  : null;
export const MAX_SYNCABLE_PHOTO_FILE_SIZE_BYTES = 700 * 1024;

export function extractPhotoFilename(photoUri: string | null | undefined): string | null {
  return extractStoredFilename(photoUri);
}

export function resolveStoredPhotoUri(photoUri: string | null | undefined): string {
  return resolveStoredMediaUri(photoUri, {
    directory: PHOTO_DIRECTORY,
    legacyDirectoryName: 'photos',
  });
}

export function getNotePhotoUri(
  note: Pick<
    Note,
    | 'type'
    | 'content'
    | 'photoLocalUri'
    | 'photoSyncedLocalUri'
    | 'captureVariant'
    | 'dualComposedPhotoLocalUri'
  > | null | undefined
) {
  if (!note || note.type !== 'photo') {
    return '';
  }

  const preferredPhotoUri =
    note.captureVariant === 'dual'
      ? note.dualComposedPhotoLocalUri ?? note.photoLocalUri ?? note.photoSyncedLocalUri ?? note.content
      : note.photoLocalUri ?? note.photoSyncedLocalUri ?? note.content;

  return resolveStoredPhotoUri(preferredPhotoUri);
}

export async function ensurePhotoDirectory() {
  return ensureStoredMediaDirectory(PHOTO_DIRECTORY);
}

export const SHARED_PHOTO_CACHE_DIRECTORY = FileSystem.cacheDirectory
  ? `${FileSystem.cacheDirectory}shared-photos/`
  : null;

export async function ensureSharedPhotoCacheDirectory() {
  return ensureStoredMediaDirectory(SHARED_PHOTO_CACHE_DIRECTORY);
}

export async function readPhotoAsBase64(photoUri: string) {
  return readStoredMediaFile({
    fileUri: photoUri,
    resolveUri: resolveStoredPhotoUri,
    maxFileSizeBytes: MAX_SYNCABLE_PHOTO_FILE_SIZE_BYTES,
    tooLargeErrorMessage: 'Photo is too large to sync safely. Please retake it with a lower resolution.',
    read: (resolvedPhotoUri) => FileSystem.readAsStringAsync(resolvedPhotoUri, {
      encoding: FileSystem.EncodingType.Base64,
    }),
  });
}

export async function readPhotoAsArrayBuffer(photoUri: string) {
  return readStoredMediaFile({
    fileUri: photoUri,
    resolveUri: resolveStoredPhotoUri,
    maxFileSizeBytes: MAX_SYNCABLE_PHOTO_FILE_SIZE_BYTES,
    tooLargeErrorMessage: 'Photo is too large to sync safely. Please retake it with a lower resolution.',
    read: (resolvedPhotoUri) => FileSystem.readAsArrayBufferAsync(resolvedPhotoUri),
  });
}

export async function writePhotoFromBase64(noteId: string, base64Data: string) {
  const directory = await ensurePhotoDirectory();
  if (!directory || !base64Data.trim()) {
    return null;
  }

  const destinationPath = `${directory}${noteId}.jpg`;
  await FileSystem.writeAsStringAsync(destinationPath, base64Data, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return destinationPath;
}

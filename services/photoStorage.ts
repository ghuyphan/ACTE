import * as FileSystem from '../utils/fileSystem';
import type { Note } from './database';

export const PHOTO_DIRECTORY = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}photos/`
  : null;
export const MAX_SYNCABLE_PHOTO_FILE_SIZE_BYTES = 700 * 1024;

export function extractPhotoFilename(photoUri: string | null | undefined): string | null {
  const normalizedPhotoUri = typeof photoUri === 'string' ? photoUri.trim() : '';
  if (!normalizedPhotoUri) {
    return null;
  }

  const withoutHash = normalizedPhotoUri.split('#')[0] ?? normalizedPhotoUri;
  const withoutQuery = withoutHash.split('?')[0] ?? withoutHash;
  const segments = withoutQuery.split('/').filter(Boolean);
  const filename = segments[segments.length - 1];

  return filename ? decodeURIComponent(filename) : null;
}

export function resolveStoredPhotoUri(photoUri: string | null | undefined): string {
  const normalizedPhotoUri = typeof photoUri === 'string' ? photoUri.trim() : '';
  if (!normalizedPhotoUri || !PHOTO_DIRECTORY) {
    return normalizedPhotoUri;
  }

  if (normalizedPhotoUri.startsWith(PHOTO_DIRECTORY)) {
    return normalizedPhotoUri;
  }

  const filename = extractPhotoFilename(normalizedPhotoUri);
  if (!filename) {
    return normalizedPhotoUri;
  }

  if (
    normalizedPhotoUri.startsWith('photos/') ||
    normalizedPhotoUri.includes('/Documents/photos/') ||
    !normalizedPhotoUri.includes('/')
  ) {
    return `${PHOTO_DIRECTORY}${filename}`;
  }

  return normalizedPhotoUri;
}

export function getNotePhotoUri(
  note: Pick<Note, 'type' | 'content' | 'photoLocalUri'> | null | undefined
) {
  if (!note || note.type !== 'photo') {
    return '';
  }

  return resolveStoredPhotoUri(note.photoLocalUri ?? note.content);
}

export async function ensurePhotoDirectory() {
  if (!PHOTO_DIRECTORY) {
    return null;
  }

  await FileSystem.makeDirectoryAsync(PHOTO_DIRECTORY, { intermediates: true });
  return PHOTO_DIRECTORY;
}

export const SHARED_PHOTO_CACHE_DIRECTORY = FileSystem.cacheDirectory
  ? `${FileSystem.cacheDirectory}shared-photos/`
  : null;

export async function ensureSharedPhotoCacheDirectory() {
  if (!SHARED_PHOTO_CACHE_DIRECTORY) {
    return null;
  }

  await FileSystem.makeDirectoryAsync(SHARED_PHOTO_CACHE_DIRECTORY, { intermediates: true });
  return SHARED_PHOTO_CACHE_DIRECTORY;
}

export async function readPhotoAsBase64(photoUri: string) {
  const normalizedPhotoUri = resolveStoredPhotoUri(photoUri);
  if (!normalizedPhotoUri) {
    return null;
  }

  const info = await FileSystem.getInfoAsync(normalizedPhotoUri);
  if (!info.exists || info.isDirectory) {
    return null;
  }

  if (typeof info.size === 'number' && info.size > MAX_SYNCABLE_PHOTO_FILE_SIZE_BYTES) {
    throw new Error('Photo is too large to sync safely. Please retake it with a lower resolution.');
  }

  return FileSystem.readAsStringAsync(normalizedPhotoUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export async function readPhotoAsArrayBuffer(photoUri: string) {
  const normalizedPhotoUri = resolveStoredPhotoUri(photoUri);
  if (!normalizedPhotoUri) {
    return null;
  }

  const info = await FileSystem.getInfoAsync(normalizedPhotoUri);
  if (!info.exists || info.isDirectory) {
    return null;
  }

  if (typeof info.size === 'number' && info.size > MAX_SYNCABLE_PHOTO_FILE_SIZE_BYTES) {
    throw new Error('Photo is too large to sync safely. Please retake it with a lower resolution.');
  }

  return FileSystem.readAsArrayBufferAsync(normalizedPhotoUri);
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

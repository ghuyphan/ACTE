import * as FileSystem from 'expo-file-system/legacy';

export const PHOTO_DIRECTORY = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}photos/`
  : null;

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

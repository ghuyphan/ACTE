import { extractStoredFilename } from './storedMediaFiles';

export function normalizeImageMimeType(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'image/jpg') {
    return 'image/jpeg';
  }

  return normalized;
}

export function inferImageMimeTypeFromName(name: string | null | undefined) {
  const normalizedName = typeof name === 'string' ? name.trim().toLowerCase() : '';
  if (normalizedName.endsWith('.png')) {
    return 'image/png';
  }

  if (normalizedName.endsWith('.webp')) {
    return 'image/webp';
  }

  if (normalizedName.endsWith('.jpg') || normalizedName.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  if (normalizedName.endsWith('.heic')) {
    return 'image/heic';
  }

  if (normalizedName.endsWith('.heif')) {
    return 'image/heif';
  }

  return '';
}

export function getFileExtension(path: string | null | undefined, fallbackExtension: string) {
  const filename = extractStoredFilename(path);
  if (!filename) {
    return fallbackExtension;
  }

  const extensionIndex = filename.lastIndexOf('.');
  if (extensionIndex <= 0 || extensionIndex === filename.length - 1) {
    return fallbackExtension;
  }

  return filename.slice(extensionIndex).toLowerCase();
}

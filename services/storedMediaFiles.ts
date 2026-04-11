import * as FileSystem from '../utils/fileSystem';

export function normalizeStoredFileUri(fileUri: string | null | undefined) {
  return typeof fileUri === 'string' ? fileUri.trim() : '';
}

export function extractStoredFilename(fileUri: string | null | undefined): string | null {
  const normalizedFileUri = normalizeStoredFileUri(fileUri);
  if (!normalizedFileUri) {
    return null;
  }

  const withoutHash = normalizedFileUri.split('#')[0] ?? normalizedFileUri;
  const withoutQuery = withoutHash.split('?')[0] ?? withoutHash;
  const segments = withoutQuery.split('/').filter(Boolean);
  const filename = segments[segments.length - 1];

  return filename ? decodeURIComponent(filename) : null;
}

export function resolveStoredMediaUri(
  fileUri: string | null | undefined,
  options: {
    directory: string | null;
    legacyDirectoryName: string;
  }
): string {
  const normalizedFileUri = normalizeStoredFileUri(fileUri);
  if (!normalizedFileUri || !options.directory) {
    return normalizedFileUri;
  }

  if (normalizedFileUri.startsWith(options.directory)) {
    return normalizedFileUri;
  }

  const filename = extractStoredFilename(normalizedFileUri);
  if (!filename) {
    return normalizedFileUri;
  }

  if (
    normalizedFileUri.startsWith(`${options.legacyDirectoryName}/`) ||
    normalizedFileUri.includes(`/Documents/${options.legacyDirectoryName}/`) ||
    !normalizedFileUri.includes('/')
  ) {
    return `${options.directory}${filename}`;
  }

  return normalizedFileUri;
}

export async function ensureStoredMediaDirectory(directory: string | null) {
  if (!directory) {
    return null;
  }

  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  return directory;
}

export async function readStoredMediaFile<Result>(options: {
  fileUri: string;
  resolveUri: (fileUri: string) => string;
  maxFileSizeBytes: number;
  tooLargeErrorMessage: string;
  read: (resolvedFileUri: string) => Promise<Result>;
}) {
  const normalizedFileUri = options.resolveUri(options.fileUri);
  if (!normalizedFileUri) {
    return null;
  }

  const info = await FileSystem.getInfoAsync(normalizedFileUri);
  if (!info.exists || info.isDirectory) {
    return null;
  }

  if (typeof info.size === 'number' && info.size > options.maxFileSizeBytes) {
    throw new Error(options.tooLargeErrorMessage);
  }

  return options.read(normalizedFileUri);
}

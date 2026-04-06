import * as FileSystem from '../utils/fileSystem';

export function normalizeStickerTempUri(uri: string | null | undefined) {
  const normalizedUri = typeof uri === 'string' ? uri.trim() : '';
  return normalizedUri || null;
}

export function getUniqueStickerTempUris(
  uris: readonly (string | null | undefined)[]
) {
  return Array.from(
    new Set(
      uris
        .map((uri) => normalizeStickerTempUri(uri))
        .filter((uri): uri is string => Boolean(uri))
    )
  );
}

export async function cleanupStickerTempUri(uri: string | null | undefined) {
  const normalizedUri = normalizeStickerTempUri(uri);
  if (!normalizedUri) {
    return;
  }

  await FileSystem.deleteAsync(normalizedUri, { idempotent: true }).catch(() => undefined);
}

export async function cleanupStickerTempUris(
  uris: readonly (string | null | undefined)[]
) {
  const normalizedUris = getUniqueStickerTempUris(uris);
  await Promise.all(normalizedUris.map((uri) => cleanupStickerTempUri(uri)));
}

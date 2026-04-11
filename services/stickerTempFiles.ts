import * as FileSystem from '../utils/fileSystem';
import { getUniqueNormalizedStrings, normalizeOptionalString } from './normalizedStrings';

export function normalizeStickerTempUri(uri: string | null | undefined) {
  const normalizedUri = normalizeOptionalString(uri);
  return normalizedUri || null;
}

export function getUniqueStickerTempUris(
  uris: readonly (string | null | undefined)[]
) {
  return getUniqueNormalizedStrings(uris);
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

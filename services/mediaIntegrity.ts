import * as FileSystem from '../utils/fileSystem';
import { getDB } from './database';
import { cleanupUnusedSharedStickerCacheFiles, STICKER_DIRECTORY } from './noteStickers';
import { PHOTO_DIRECTORY, resolveStoredPhotoUri } from './photoStorage';

interface PhotoReferenceRow {
  content: string;
  photo_local_uri: string | null;
}

interface StickerReferenceRow {
  local_uri: string;
}

async function getReferencedPhotoPaths() {
  const database = await getDB();
  const rows = await database.getAllAsync<PhotoReferenceRow>(
    `SELECT content, photo_local_uri
     FROM notes
     WHERE type = 'photo'`
  );

  return new Set(
    rows
      .map((row) => resolveStoredPhotoUri(row.photo_local_uri ?? row.content))
      .filter(Boolean)
  );
}

async function getReferencedStickerPaths() {
  const database = await getDB();
  const rows = await database.getAllAsync<StickerReferenceRow>(
    `SELECT local_uri
     FROM sticker_assets`
  );

  return new Set(rows.map((row) => row.local_uri).filter(Boolean));
}

export async function cleanupOrphanPhotoFiles(): Promise<number> {
  if (!PHOTO_DIRECTORY) {
    return 0;
  }

  const directoryInfo = await FileSystem.getInfoAsync(PHOTO_DIRECTORY);
  if (!directoryInfo.exists || !directoryInfo.isDirectory) {
    return 0;
  }

  const referencedPhotoPaths = await getReferencedPhotoPaths();

  const filenames = await FileSystem.readDirectoryAsync(PHOTO_DIRECTORY);
  let deletedCount = 0;

  for (const filename of filenames) {
    const absolutePath = `${PHOTO_DIRECTORY}${filename}`;
    if (referencedPhotoPaths.has(absolutePath)) {
      continue;
    }

    try {
      await FileSystem.deleteAsync(absolutePath, { idempotent: true });
      deletedCount += 1;
    } catch (error) {
      console.warn('Failed deleting orphan photo:', absolutePath, error);
    }
  }

  return deletedCount;
}

export async function cleanupOrphanStickerFiles(): Promise<number> {
  if (!STICKER_DIRECTORY) {
    return 0;
  }

  const directoryInfo = await FileSystem.getInfoAsync(STICKER_DIRECTORY);
  if (!directoryInfo.exists || !directoryInfo.isDirectory) {
    return 0;
  }

  const referencedStickerPaths = await getReferencedStickerPaths();
  const filenames = await FileSystem.readDirectoryAsync(STICKER_DIRECTORY);
  let deletedCount = 0;

  for (const filename of filenames) {
    const absolutePath = `${STICKER_DIRECTORY}${filename}`;
    if (referencedStickerPaths.has(absolutePath)) {
      continue;
    }

    try {
      await FileSystem.deleteAsync(absolutePath, { idempotent: true });
      deletedCount += 1;
    } catch (error) {
      console.warn('Failed deleting orphan sticker:', absolutePath, error);
    }
  }

  return deletedCount;
}

export async function cleanupOrphanMediaFiles(): Promise<void> {
  await Promise.allSettled([
    cleanupOrphanPhotoFiles(),
    cleanupOrphanStickerFiles(),
    cleanupUnusedSharedStickerCacheFiles(),
  ]);
}

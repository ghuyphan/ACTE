import * as FileSystem from 'expo-file-system/legacy';
import { getAllNotes } from './database';
import { getStickerAssets, cleanupUnusedSharedStickerCacheFiles, STICKER_DIRECTORY } from './noteStickers';
import { PHOTO_DIRECTORY, getNotePhotoUri } from './photoStorage';

export async function cleanupOrphanPhotoFiles(): Promise<number> {
  if (!PHOTO_DIRECTORY) {
    return 0;
  }

  const directoryInfo = await FileSystem.getInfoAsync(PHOTO_DIRECTORY);
  if (!directoryInfo.exists || !directoryInfo.isDirectory) {
    return 0;
  }

  const notes = await getAllNotes();
  const referencedPhotoPaths = new Set(
    notes
      .filter((note) => note.type === 'photo')
      .map((note) => getNotePhotoUri(note))
      .filter(Boolean)
  );

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

  const assets = await getStickerAssets();
  const referencedStickerPaths = new Set(assets.map((asset) => asset.localUri).filter(Boolean));
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

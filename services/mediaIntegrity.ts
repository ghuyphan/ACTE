import * as FileSystem from '../utils/fileSystem';
import { getDB } from './database';
import {
  LIVE_PHOTO_VIDEO_DIRECTORY,
  resolveStoredPairedVideoUri,
} from './livePhotoStorage';
import { cleanupUnusedSharedStickerCacheFiles, STICKER_DIRECTORY } from './noteStickers';
import { PHOTO_DIRECTORY, resolveStoredPhotoUri } from './photoStorage';

interface PhotoReferenceRow {
  content: string;
  photo_local_uri: string | null;
  paired_video_local_uri: string | null;
}

interface StickerReferenceRow {
  local_uri: string;
}

async function getReferencedPhotoPaths() {
  const database = await getDB();
  const rows = await database.getAllAsync<PhotoReferenceRow>(
    `SELECT content, photo_local_uri
     , paired_video_local_uri
     FROM notes
     WHERE type = 'photo'`
  );

  return new Set(
    rows
      .flatMap((row) => [
        resolveStoredPhotoUri(row.photo_local_uri ?? row.content),
        resolveStoredPairedVideoUri(row.paired_video_local_uri),
      ])
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
  if (!PHOTO_DIRECTORY && !LIVE_PHOTO_VIDEO_DIRECTORY) {
    return 0;
  }

  const referencedPhotoPaths = await getReferencedPhotoPaths();
  let deletedCount = 0;

  for (const directory of [PHOTO_DIRECTORY, LIVE_PHOTO_VIDEO_DIRECTORY].filter(
    (value): value is string => Boolean(value)
  )) {
    const directoryInfo = await FileSystem.getInfoAsync(directory);
    if (!directoryInfo.exists || !directoryInfo.isDirectory) {
      continue;
    }

    const filenames = await FileSystem.readDirectoryAsync(directory);
    for (const filename of filenames) {
      const absolutePath = `${directory}${filename}`;
      if (referencedPhotoPaths.has(absolutePath)) {
        continue;
      }

      try {
        await FileSystem.deleteAsync(absolutePath, { idempotent: true });
        deletedCount += 1;
      } catch (error) {
        console.warn('Failed deleting orphan note media:', absolutePath, error);
      }
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
  // Avoid concurrent SQLite readers on Android startup while Expo SQLite is unstable.
  await cleanupOrphanPhotoFiles().catch(() => undefined);
  await cleanupOrphanStickerFiles().catch(() => undefined);
  await cleanupUnusedSharedStickerCacheFiles().catch(() => undefined);
}

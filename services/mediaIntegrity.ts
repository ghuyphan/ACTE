import * as FileSystem from 'expo-file-system/legacy';
import { getAllNotes } from './database';
import { PHOTO_DIRECTORY } from './photoStorage';

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
      .map((note) => note.content)
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

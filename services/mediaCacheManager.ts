import * as FileSystem from 'expo-file-system/legacy';
import { SHARED_PHOTO_CACHE_DIRECTORY } from './photoStorage';

const MAX_CACHE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export async function runMediaCacheEviction() {
  if (!SHARED_PHOTO_CACHE_DIRECTORY) {
    return;
  }

  const dirInfo = await FileSystem.getInfoAsync(SHARED_PHOTO_CACHE_DIRECTORY);
  if (!dirInfo.exists || !dirInfo.isDirectory) {
    return;
  }

  const filenames = await FileSystem.readDirectoryAsync(SHARED_PHOTO_CACHE_DIRECTORY);
  
  const files: { path: string; size: number; modificationTime: number }[] = [];
  let totalSizeBytes = 0;

  for (const filename of filenames) {
    const absolutePath = `${SHARED_PHOTO_CACHE_DIRECTORY}${filename}`;
    const info = await FileSystem.getInfoAsync(absolutePath);
    if (info.exists && !info.isDirectory && typeof info.size === 'number' && typeof info.modificationTime === 'number') {
      files.push({
        path: absolutePath,
        size: info.size,
        modificationTime: info.modificationTime,
      });
      totalSizeBytes += info.size;
    }
  }

  if (totalSizeBytes <= MAX_CACHE_SIZE_BYTES) {
    return;
  }

  // Sort oldest first
  files.sort((a, b) => a.modificationTime - b.modificationTime);

  // Evict until we are at 70% of the max capacity (e.g. 35MB)
  const targetSizeBytes = MAX_CACHE_SIZE_BYTES * 0.7;
  let idx = 0;
  
  while (totalSizeBytes > targetSizeBytes && idx < files.length) {
    const file = files[idx];
    if (!file) break;
    try {
      await FileSystem.deleteAsync(file.path, { idempotent: true });
      totalSizeBytes -= file.size;
    } catch (e) {
      console.warn('Failed to evict cached file', file.path, e);
    }
    idx += 1;
  }
}

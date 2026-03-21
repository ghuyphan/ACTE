import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { ensurePhotoDirectory, readPhotoAsBase64 } from './photoStorage';
import { requireSupabase } from '../utils/supabase';

export const NOTE_MEDIA_BUCKET = 'note-media';
export const SHARED_POST_MEDIA_BUCKET = 'shared-post-media';
export const ROOM_POST_MEDIA_BUCKET = 'room-post-media';

export async function uploadPhotoToStorage(
  bucket: string,
  path: string,
  photoUri: string | null | undefined
) {
  if (!photoUri?.trim()) {
    return null;
  }

  const base64 = await readPhotoAsBase64(photoUri);
  if (!base64) {
    return null;
  }

  const { error } = await requireSupabase().storage.from(bucket).upload(path, decode(base64), {
    contentType: 'image/jpeg',
    upsert: true,
  });

  if (error) {
    throw error;
  }

  return path;
}

export async function downloadPhotoFromStorage(
  bucket: string,
  path: string | null | undefined,
  localId: string
) {
  if (!path?.trim()) {
    return null;
  }

  const directory = await ensurePhotoDirectory();
  if (!directory) {
    return null;
  }

  const { data, error } = await requireSupabase().storage.from(bucket).createSignedUrl(path, 60 * 5);
  if (error) {
    throw error;
  }

  const destinationPath = `${directory}${localId}.jpg`;
  await FileSystem.deleteAsync(destinationPath, { idempotent: true });

  const result = await FileSystem.downloadAsync(data.signedUrl, destinationPath);
  return result.uri ?? destinationPath;
}

export async function deletePhotoFromStorage(bucket: string, path: string | null | undefined) {
  if (!path?.trim()) {
    return;
  }

  const { error } = await requireSupabase().storage.from(bucket).remove([path]);
  if (error) {
    throw error;
  }
}

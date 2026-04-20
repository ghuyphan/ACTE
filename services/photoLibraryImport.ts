import * as ImagePicker from 'expo-image-picker';

export type PhotoLibraryImportIntent = 'editable-photo' | 'live-photo';

export const PHOTO_NOTE_IMPORT_ASPECT_RATIO: [number, number] = [1, 1];

export function getPhotoLibraryImportPickerOptions(
  intent: PhotoLibraryImportIntent,
  platformOS: string
): ImagePicker.ImagePickerOptions {
  if (intent === 'live-photo' && platformOS === 'ios') {
    return {
      mediaTypes: ['livePhotos'],
      allowsEditing: false,
      quality: 0.35,
      selectionLimit: 1,
    };
  }

  return {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: PHOTO_NOTE_IMPORT_ASPECT_RATIO,
    quality: 0.35,
    selectionLimit: 1,
  };
}

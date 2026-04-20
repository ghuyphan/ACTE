import { getPhotoLibraryImportPickerOptions } from '../services/photoLibraryImport';

describe('photoLibraryImport', () => {
  it('uses an editable square crop flow for standard photo-note imports', () => {
    expect(getPhotoLibraryImportPickerOptions('editable-photo', 'ios')).toEqual({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.35,
      selectionLimit: 1,
    });
  });

  it('keeps a dedicated live photo import flow on iOS', () => {
    expect(getPhotoLibraryImportPickerOptions('live-photo', 'ios')).toEqual({
      mediaTypes: ['livePhotos'],
      allowsEditing: false,
      quality: 0.35,
      selectionLimit: 1,
    });
  });

  it('falls back to the editable photo flow for non-iOS platforms', () => {
    expect(getPhotoLibraryImportPickerOptions('live-photo', 'android')).toEqual({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.35,
      selectionLimit: 1,
    });
  });
});

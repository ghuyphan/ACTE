jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///current-container/Documents/',
}));

import { extractPhotoFilename, resolveStoredPhotoUri } from '../services/photoStorage';

describe('photoStorage', () => {
  it('extracts a filename from a file uri', () => {
    expect(
      extractPhotoFilename('file:///old-container/Documents/photos/note-123.jpg')
    ).toBe('note-123.jpg');
  });

  it('resolves stale app-container photo uris into the current document directory', () => {
    expect(
      resolveStoredPhotoUri('file:///old-container/Documents/photos/note-123.jpg')
    ).toBe('file:///current-container/Documents/photos/note-123.jpg');
  });

  it('resolves relative photo references into the current document directory', () => {
    expect(resolveStoredPhotoUri('photos/note-123.jpg')).toBe(
      'file:///current-container/Documents/photos/note-123.jpg'
    );
  });
});

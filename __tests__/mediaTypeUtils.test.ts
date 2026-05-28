import {
  getFileExtension,
  inferImageMimeTypeFromName,
  normalizeImageMimeType,
} from '../services/mediaTypeUtils';
import { extractStoredFilename, resolveStoredMediaUri } from '../services/storedMediaFiles';

describe('mediaTypeUtils', () => {
  it('normalizes image mime types used by imported sticker/photo assets', () => {
    expect(normalizeImageMimeType(' IMAGE/JPG ')).toBe('image/jpeg');
    expect(normalizeImageMimeType('image/png')).toBe('image/png');
    expect(normalizeImageMimeType(null)).toBe('');
  });

  it('infers supported image mime types from file names', () => {
    expect(inferImageMimeTypeFromName('memory.PNG')).toBe('image/png');
    expect(inferImageMimeTypeFromName('stamp.webp')).toBe('image/webp');
    expect(inferImageMimeTypeFromName('photo.jpeg')).toBe('image/jpeg');
    expect(inferImageMimeTypeFromName('live.heic')).toBe('image/heic');
    expect(inferImageMimeTypeFromName('scan.heif')).toBe('image/heif');
    expect(inferImageMimeTypeFromName('clip.mov')).toBe('');
  });

  it('extracts file extensions from stored paths with query strings and encoded names', () => {
    expect(getFileExtension('file:///tmp/My%20Photo.JPEG?token=abc#preview', '.jpg')).toBe('.jpeg');
    expect(getFileExtension('photos/note-1.PNG', '.jpg')).toBe('.png');
    expect(getFileExtension('file:///tmp/no-extension', '.jpg')).toBe('.jpg');
    expect(getFileExtension(null, '.jpg')).toBe('.jpg');
  });
});

describe('storedMediaFiles', () => {
  it('keeps filename extraction resilient to malformed percent encoding', () => {
    expect(extractStoredFilename('file:///tmp/bad%asset.jpg')).toBe('bad%asset.jpg');
    expect(getFileExtension('file:///tmp/bad%asset.JPG', '.jpg')).toBe('.jpg');
  });

  it('resolves legacy stored media paths into the current media directory', () => {
    expect(
      resolveStoredMediaUri('photos/memory%201.jpg?cache=1', {
        directory: 'file:///documents/photos/',
        legacyDirectoryName: 'photos',
      })
    ).toBe('file:///documents/photos/memory 1.jpg');

    expect(
      resolveStoredMediaUri('file:///other/location/memory.jpg', {
        directory: 'file:///documents/photos/',
        legacyDirectoryName: 'photos',
      })
    ).toBe('file:///other/location/memory.jpg');
  });
});

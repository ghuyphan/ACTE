const mockCopyAsync = jest.fn(async (_options?: unknown) => undefined);
const mockDeleteAsync = jest.fn(async (_uri?: unknown, _options?: unknown) => undefined);
const mockGetInfoAsync = jest.fn(async (_uri?: unknown) => ({
  exists: true,
  isDirectory: false,
  size: 5 * 1024 * 1024,
}));

jest.mock('../utils/fileSystem', () => ({
  documentDirectory: 'file:///current-container/Documents/',
  makeDirectoryAsync: jest.fn(async () => undefined),
  copyAsync: (options: { from: string; to: string }) => mockCopyAsync(options),
  deleteAsync: (uri: string, options?: { idempotent?: boolean }) => mockDeleteAsync(uri, options),
  getInfoAsync: (uri: string) => mockGetInfoAsync(uri),
}));

import { persistLivePhotoVideo } from '../services/livePhotoProcessing';

describe('livePhotoProcessing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists larger live-photo motion clips locally instead of blocking note save', async () => {
    const savedUri = await persistLivePhotoVideo(
      'file:///tmp/captured-live-photo.mp4',
      'note-123-motion'
    );

    expect(savedUri).toBe(
      'file:///current-container/Documents/live-photo-videos/note-123-motion.mp4'
    );
    expect(mockCopyAsync).toHaveBeenCalledWith({
      from: 'file:///tmp/captured-live-photo.mp4',
      to: 'file:///current-container/Documents/live-photo-videos/note-123-motion.mp4',
    });
    expect(mockDeleteAsync).not.toHaveBeenCalled();
  });
});

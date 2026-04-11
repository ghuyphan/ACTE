const mockCopyAsync = jest.fn(async (_options?: unknown) => undefined);
const mockDeleteAsync = jest.fn(async (_uri?: unknown, _options?: unknown) => undefined);
const mockGetInfoAsync = jest.fn(async (_uri?: unknown) => ({
  exists: true,
  isDirectory: false,
  size: 5 * 1024 * 1024,
}));
const mockNormalizeLivePhotoMotionVideo = jest.fn();

jest.mock('../utils/fileSystem', () => ({
  documentDirectory: 'file:///current-container/Documents/',
  makeDirectoryAsync: jest.fn(async () => undefined),
  copyAsync: (options: { from: string; to: string }) => mockCopyAsync(options),
  deleteAsync: (uri: string, options?: { idempotent?: boolean }) => mockDeleteAsync(uri, options),
  getInfoAsync: (uri: string) => mockGetInfoAsync(uri),
}));

jest.mock('../services/livePhotoMotionTranscoder', () => ({
  normalizeLivePhotoMotionVideo: (...args: unknown[]) => mockNormalizeLivePhotoMotionVideo(...args),
}));

import {
  LIVE_PHOTO_FREE_TARGET_BITRATE,
  LIVE_PHOTO_PLUS_TARGET_BITRATE,
  persistLivePhotoVideo,
} from '../services/livePhotoProcessing';

describe('livePhotoProcessing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNormalizeLivePhotoMotionVideo.mockResolvedValue(null);
  });

  it('falls back to copying the original motion clip when native normalization is unavailable', async () => {
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

  it('returns the normalized iOS motion clip directly when native export succeeds', async () => {
    mockNormalizeLivePhotoMotionVideo.mockResolvedValue({
      uri: 'file:///current-container/Documents/live-photo-videos/note-123-motion.mp4',
    });

    const savedUri = await persistLivePhotoVideo(
      'file:///tmp/captured-live-photo.mov',
      'note-123-motion'
    );

    expect(savedUri).toBe(
      'file:///current-container/Documents/live-photo-videos/note-123-motion.mp4'
    );
    expect(mockNormalizeLivePhotoMotionVideo).toHaveBeenCalledWith(
      'file:///tmp/captured-live-photo.mov',
      'file:///current-container/Documents/live-photo-videos/note-123-motion',
      {
        targetBitrate: LIVE_PHOTO_FREE_TARGET_BITRATE,
      }
    );
    expect(mockCopyAsync).not.toHaveBeenCalled();
  });

  it('uses the higher Plus bitrate profile for live photo motion clips', async () => {
    mockNormalizeLivePhotoMotionVideo.mockResolvedValue({
      uri: 'file:///current-container/Documents/live-photo-videos/note-123-motion.mp4',
    });

    await persistLivePhotoVideo(
      'file:///tmp/captured-live-photo.mov',
      'note-123-motion',
      'plus'
    );

    expect(mockNormalizeLivePhotoMotionVideo).toHaveBeenCalledWith(
      'file:///tmp/captured-live-photo.mov',
      'file:///current-container/Documents/live-photo-videos/note-123-motion',
      {
        targetBitrate: LIVE_PHOTO_PLUS_TARGET_BITRATE,
      }
    );
  });
});

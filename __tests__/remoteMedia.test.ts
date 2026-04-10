const mockUpload = jest.fn(
  async (_path: string, _payload: ArrayBuffer, _options: unknown) => ({ error: null })
);
const mockDownloadAsync = jest.fn();
const mockCreateSignedUrl = jest.fn(async () => ({
  data: { signedUrl: 'https://signed.example/mock' },
  error: null,
}));
const mockEnsurePhotoDirectory = jest.fn();
const mockEnsureSharedPhotoCacheDirectory = jest.fn();
const mockEnsureLivePhotoVideoDirectory = jest.fn();
const mockEnsureSharedLivePhotoVideoCacheDirectory = jest.fn();
const mockGetInfoAsync = jest.fn(async (_uri: string) => ({
  exists: true,
  isDirectory: false,
  size: 128 * 1024,
  uri: _uri,
}));
const mockDeleteAsync = jest.fn(async (_uri: string, _options?: unknown) => undefined);
const mockReadPhotoAsArrayBuffer = jest.fn(async (_uri: string) => Uint8Array.from([1, 2, 3]).buffer);
const mockReadPairedVideoAsArrayBuffer = jest.fn(
  async (_uri: string) => Uint8Array.from([4, 5, 6]).buffer
);

jest.mock('../utils/fileSystem', () => ({
  getInfoAsync: (uri: string) => mockGetInfoAsync(uri),
  deleteAsync: (uri: string, options?: unknown) => mockDeleteAsync(uri, options),
  downloadAsync: (...args: unknown[]) => mockDownloadAsync(...args),
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: {
    JPEG: 'jpeg',
  },
}));

jest.mock('../services/photoStorage', () => ({
  ensurePhotoDirectory: (...args: unknown[]) => mockEnsurePhotoDirectory(...args),
  ensureSharedPhotoCacheDirectory: (...args: unknown[]) =>
    mockEnsureSharedPhotoCacheDirectory(...args),
  MAX_SYNCABLE_PHOTO_FILE_SIZE_BYTES: 700 * 1024,
  readPhotoAsArrayBuffer: (uri: string) => mockReadPhotoAsArrayBuffer(uri),
  resolveStoredPhotoUri: (uri: string) => uri,
}));

jest.mock('../services/livePhotoStorage', () => ({
  ensureLivePhotoVideoDirectory: (...args: unknown[]) => mockEnsureLivePhotoVideoDirectory(...args),
  ensureSharedLivePhotoVideoCacheDirectory: (...args: unknown[]) =>
    mockEnsureSharedLivePhotoVideoCacheDirectory(...args),
  MAX_SYNCABLE_LIVE_PHOTO_VIDEO_FILE_SIZE_BYTES: 2.5 * 1024 * 1024,
  readPairedVideoAsArrayBuffer: (uri: string) => mockReadPairedVideoAsArrayBuffer(uri),
  resolveStoredPairedVideoUri: (uri: string) => uri,
}));

jest.mock('../utils/supabase', () => ({
  getSupabaseErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : 'unknown error',
  isSupabaseNetworkError: () => false,
  isSupabaseStorageObjectMissingError: () => false,
  requireSupabase: () => ({
    storage: {
      from: () => ({
        upload: (path: string, payload: ArrayBuffer, options: unknown) =>
          mockUpload(path, payload, options),
        createSignedUrl: mockCreateSignedUrl,
        remove: jest.fn(),
      }),
    },
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  downloadPhotoFromStorage,
  downloadPairedVideoFromStorage,
  uploadPairedVideoToStorage,
  uploadPhotoToStorage,
} = require('../services/remoteMedia') as typeof import('../services/remoteMedia');

describe('remoteMedia uploads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureSharedPhotoCacheDirectory.mockResolvedValue('/cache/shared-photos/');
    mockEnsurePhotoDirectory.mockResolvedValue('/cache/photos/');
    mockEnsureLivePhotoVideoDirectory.mockResolvedValue('/cache/live-videos/');
    mockEnsureSharedLivePhotoVideoCacheDirectory.mockResolvedValue('/cache/shared-live-videos/');
    mockGetInfoAsync.mockResolvedValue({
      exists: true,
      isDirectory: false,
      size: 128 * 1024,
      uri: 'file:///media/mock.jpg',
    });
    mockReadPhotoAsArrayBuffer.mockResolvedValue(Uint8Array.from([1, 2, 3]).buffer);
    mockReadPairedVideoAsArrayBuffer.mockResolvedValue(Uint8Array.from([4, 5, 6]).buffer);
  });

  it('dedupes concurrent shared photo downloads for the same cache key', async () => {
    mockGetInfoAsync.mockResolvedValue({
      exists: false,
      isDirectory: false,
      size: 0,
      uri: 'file:///cache/shared-photo.jpg',
    });
    mockDownloadAsync.mockResolvedValue({
      uri: 'file:///cache/shared-photo.jpg',
    });

    const firstDownload = downloadPhotoFromStorage(
      'shared-post-media',
      'friends/shared-photo.jpg',
      'shared-photo-1'
    );
    const secondDownload = downloadPhotoFromStorage(
      'shared-post-media',
      'friends/shared-photo.jpg',
      'shared-photo-1'
    );

    await expect(firstDownload).resolves.toBe('file:///cache/shared-photo.jpg');
    await expect(secondDownload).resolves.toBe('file:///cache/shared-photo.jpg');
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1);
    expect(mockDownloadAsync).toHaveBeenCalledTimes(1);
  });

  it('re-downloads when the remote photo path changes for the same local id', async () => {
    mockGetInfoAsync
      .mockResolvedValueOnce({
        exists: false,
        isDirectory: false,
        size: 0,
        uri: 'file:///cache/shared-photo-old.jpg',
      })
      .mockResolvedValueOnce({
        exists: false,
        isDirectory: false,
        size: 0,
        uri: 'file:///cache/shared-photo-new.jpg',
      });
    mockDownloadAsync
      .mockResolvedValueOnce({
        uri: 'file:///cache/shared-photo-old.jpg',
      })
      .mockResolvedValueOnce({
        uri: 'file:///cache/shared-photo-new.jpg',
      });

    await expect(
      downloadPhotoFromStorage('shared-post-media', 'friends/shared-photo-v1.jpg', 'shared-photo-1')
    ).resolves.toBe('file:///cache/shared-photo-old.jpg');
    await expect(
      downloadPhotoFromStorage('shared-post-media', 'friends/shared-photo-v2.jpg', 'shared-photo-1')
    ).resolves.toBe('file:///cache/shared-photo-new.jpg');

    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(2);
    expect(mockDownloadAsync).toHaveBeenCalledTimes(2);
    expect(mockDownloadAsync.mock.calls[0]?.[1]).not.toBe(mockDownloadAsync.mock.calls[1]?.[1]);
  });

  it('re-downloads when the remote video path changes for the same local id', async () => {
    mockGetInfoAsync
      .mockResolvedValueOnce({
        exists: false,
        isDirectory: false,
        size: 0,
        uri: 'file:///cache/shared-video-old.mov',
      })
      .mockResolvedValueOnce({
        exists: false,
        isDirectory: false,
        size: 0,
        uri: 'file:///cache/shared-video-new.mov',
      });
    mockDownloadAsync
      .mockResolvedValueOnce({
        uri: 'file:///cache/shared-video-old.mov',
      })
      .mockResolvedValueOnce({
        uri: 'file:///cache/shared-video-new.mov',
      });

    await expect(
      downloadPairedVideoFromStorage(
        'shared-post-media',
        'friends/shared-photo-v1.motion.mov',
        'shared-photo-1-motion'
      )
    ).resolves.toBe('file:///cache/shared-video-old.mov');
    await expect(
      downloadPairedVideoFromStorage(
        'shared-post-media',
        'friends/shared-photo-v2.motion.mov',
        'shared-photo-1-motion'
      )
    ).resolves.toBe('file:///cache/shared-video-new.mov');

    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(2);
    expect(mockDownloadAsync).toHaveBeenCalledTimes(2);
    expect(mockDownloadAsync.mock.calls[0]?.[1]).not.toBe(mockDownloadAsync.mock.calls[1]?.[1]);
  });

  it('uploads photos using raw array buffers instead of base64 payloads', async () => {
    const result = await uploadPhotoToStorage(
      'note-media',
      'user-1/note-1',
      'file:///media/mock.jpg'
    );

    expect(result).toBe('user-1/note-1');
    expect(mockReadPhotoAsArrayBuffer).toHaveBeenCalledWith('file:///media/mock.jpg');
    expect(mockUpload).toHaveBeenCalledWith(
      'user-1/note-1',
      expect.any(ArrayBuffer),
      expect.objectContaining({
        contentType: 'image/jpeg',
        upsert: false,
      })
    );
  });

  it('uploads live photo motion clips as raw bytes with the correct content type', async () => {
    mockGetInfoAsync.mockResolvedValue({
      exists: true,
      isDirectory: false,
      size: 256 * 1024,
      uri: 'file:///media/mock.mov',
    });

    const result = await uploadPairedVideoToStorage(
      'note-media',
      'user-1/note-1.motion.mov',
      'file:///media/mock.mov',
      { allowOverwrite: true }
    );

    expect(result).toBe('user-1/note-1.motion.mov');
    expect(mockReadPairedVideoAsArrayBuffer).toHaveBeenCalledWith('file:///media/mock.mov');
    expect(mockUpload).toHaveBeenCalledWith(
      'user-1/note-1.motion.mov',
      expect.any(ArrayBuffer),
      expect.objectContaining({
        contentType: 'video/quicktime',
        upsert: true,
      })
    );
  });
});

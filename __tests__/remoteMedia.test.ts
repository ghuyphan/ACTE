const mockUpload = jest.fn(async () => ({ error: null }));
const mockGetInfoAsync = jest.fn();
const mockDeleteAsync = jest.fn(async () => undefined);
const mockReadPhotoAsArrayBuffer = jest.fn();
const mockReadPairedVideoAsArrayBuffer = jest.fn();

jest.mock('../utils/fileSystem', () => ({
  getInfoAsync: (uri: string) => mockGetInfoAsync(uri),
  deleteAsync: (uri: string, options?: unknown) => mockDeleteAsync(uri, options),
  downloadAsync: jest.fn(),
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: {
    JPEG: 'jpeg',
  },
}));

jest.mock('../services/photoStorage', () => ({
  ensurePhotoDirectory: jest.fn(),
  ensureSharedPhotoCacheDirectory: jest.fn(),
  MAX_SYNCABLE_PHOTO_FILE_SIZE_BYTES: 700 * 1024,
  readPhotoAsArrayBuffer: (uri: string) => mockReadPhotoAsArrayBuffer(uri),
  resolveStoredPhotoUri: (uri: string) => uri,
}));

jest.mock('../services/livePhotoStorage', () => ({
  ensureLivePhotoVideoDirectory: jest.fn(),
  ensureSharedLivePhotoVideoCacheDirectory: jest.fn(),
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
        upload: (...args: unknown[]) => mockUpload(...args),
        createSignedUrl: jest.fn(),
        remove: jest.fn(),
      }),
    },
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { uploadPairedVideoToStorage, uploadPhotoToStorage } = require('../services/remoteMedia') as typeof import('../services/remoteMedia');

describe('remoteMedia uploads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInfoAsync.mockResolvedValue({
      exists: true,
      isDirectory: false,
      size: 128 * 1024,
      uri: 'file:///media/mock.jpg',
    });
    mockReadPhotoAsArrayBuffer.mockResolvedValue(Uint8Array.from([1, 2, 3]).buffer);
    mockReadPairedVideoAsArrayBuffer.mockResolvedValue(Uint8Array.from([4, 5, 6]).buffer);
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

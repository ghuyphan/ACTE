const mockCutOutAsync = jest.fn();
const mockPrepareAsync = jest.fn();
const mockManipulateAsync = jest.fn();
const mockMakeDirectoryAsync = jest.fn();
const mockDeleteAsync = jest.fn();
const mockImageGetSize = jest.fn();

jest.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: () => ({
    cutOutAsync: (...args: unknown[]) => mockCutOutAsync(...args),
    prepareAsync: (...args: unknown[]) => mockPrepareAsync(...args),
  }),
}));

jest.mock('expo-image-manipulator', () => ({
  __esModule: true,
  manipulateAsync: (...args: unknown[]) => mockManipulateAsync(...args),
  SaveFormat: {
    JPEG: 'jpeg',
  },
}));

jest.mock('../utils/fileSystem', () => ({
  cacheDirectory: 'file:///cache/',
  makeDirectoryAsync: (...args: unknown[]) => mockMakeDirectoryAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
}));

jest.mock('react-native', () => ({
  Image: {
    getSize: (...args: unknown[]) => mockImageGetSize(...args),
  },
}));

describe('stickerSubjectCutout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockMakeDirectoryAsync.mockResolvedValue(undefined);
    mockDeleteAsync.mockResolvedValue(undefined);
    mockPrepareAsync.mockResolvedValue({ available: true, ready: true });
    mockCutOutAsync.mockResolvedValue({
      uri: 'file:///cache/result.png',
      mimeType: 'image/png',
      width: 800,
      height: 600,
    });
  });

  function loadModule() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../services/stickerSubjectCutout');
  }

  it('downscales oversized images before native cutout and cleans up the temp file', async () => {
    mockImageGetSize.mockImplementation(
      (
        _uri: string,
        onSuccess: (width: number, height: number) => void
      ) => onSuccess(4032, 3024)
    );
    mockManipulateAsync.mockResolvedValue({
      uri: 'file:///cache/subject-cutout-source.jpg',
      width: 2048,
      height: 1536,
    });

    const { createStickerImportSourceFromSubjectCutout } = loadModule();

    const result = await createStickerImportSourceFromSubjectCutout({
      uri: 'file:///photo.heic',
      mimeType: 'image/heic',
      name: 'photo.heic',
    });

    expect(mockManipulateAsync).toHaveBeenCalledWith(
      'file:///photo.heic',
      [{ resize: { width: 2048 } }],
      expect.objectContaining({
        compress: 0.92,
        format: 'jpeg',
      })
    );
    expect(mockCutOutAsync).toHaveBeenCalledWith(
      'file:///cache/subject-cutout-source.jpg',
      expect.stringContaining('file:///cache/sticker-cutouts/subject-cutout-')
    );
    expect(mockDeleteAsync).toHaveBeenCalledWith('file:///cache/subject-cutout-source.jpg', {
      idempotent: true,
    });
    expect(result).toEqual({
      source: {
        uri: 'file:///cache/result.png',
        mimeType: 'image/png',
        name: 'photo.heic',
      },
      cleanupUri: 'file:///cache/result.png',
    });
  });

  it('uses the original source when the image is already within bounds', async () => {
    mockImageGetSize.mockImplementation(
      (
        _uri: string,
        onSuccess: (width: number, height: number) => void
      ) => onSuccess(1200, 900)
    );

    const { createStickerImportSourceFromSubjectCutout } = loadModule();

    await createStickerImportSourceFromSubjectCutout({
      uri: 'file:///photo.jpg',
      mimeType: 'image/jpeg',
      name: 'photo.jpg',
    });

    expect(mockManipulateAsync).not.toHaveBeenCalled();
    expect(mockCutOutAsync).toHaveBeenCalledWith(
      'file:///photo.jpg',
      expect.stringContaining('file:///cache/sticker-cutouts/subject-cutout-')
    );
    expect(mockDeleteAsync).not.toHaveBeenCalled();
  });

  it('cleans up the normalized temp file when native cutout fails', async () => {
    mockImageGetSize.mockImplementation(
      (
        _uri: string,
        onSuccess: (width: number, height: number) => void
      ) => onSuccess(3024, 4032)
    );
    mockManipulateAsync.mockResolvedValue({
      uri: 'file:///cache/subject-cutout-source.jpg',
      width: 1536,
      height: 2048,
    });
    mockCutOutAsync.mockRejectedValue(new Error('native failure'));

    const { SubjectCutoutError, createStickerImportSourceFromSubjectCutout } = loadModule();

    await expect(
      createStickerImportSourceFromSubjectCutout({
        uri: 'file:///photo.jpg',
        name: 'photo.jpg',
      })
    ).rejects.toBeInstanceOf(SubjectCutoutError);

    expect(mockDeleteAsync).toHaveBeenCalledWith('file:///cache/subject-cutout-source.jpg', {
      idempotent: true,
    });
  });
});

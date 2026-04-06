const mockDeleteAsync = jest.fn();

jest.mock('../utils/fileSystem', () => ({
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
}));

describe('stickerTempFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteAsync.mockResolvedValue(undefined);
  });

  function loadModule() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../services/stickerTempFiles');
  }

  it('normalizes, dedupes, and cleans up temp uris in one batch', async () => {
    const { cleanupStickerTempUris } = loadModule();

    await cleanupStickerTempUris([
      null,
      undefined,
      '',
      '   ',
      ' file:///cache/a.jpg ',
      'file:///cache/a.jpg',
      'file:///cache/b.jpg',
    ]);

    expect(mockDeleteAsync).toHaveBeenCalledTimes(2);
    expect(mockDeleteAsync).toHaveBeenNthCalledWith(1, 'file:///cache/a.jpg', {
      idempotent: true,
    });
    expect(mockDeleteAsync).toHaveBeenNthCalledWith(2, 'file:///cache/b.jpg', {
      idempotent: true,
    });
  });

  it('skips cleanup when the uri is blank', async () => {
    const { cleanupStickerTempUri } = loadModule();

    await cleanupStickerTempUri('   ');

    expect(mockDeleteAsync).not.toHaveBeenCalled();
  });
});

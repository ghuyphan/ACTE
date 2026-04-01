const mockGetInfoAsync = jest.fn();
const mockReadDirectoryAsync = jest.fn();
const mockDeleteAsync = jest.fn();
const mockGetAllAsync = jest.fn();
const mockCleanupUnusedSharedStickerCacheFiles = jest.fn();

jest.mock('../utils/fileSystem', () => ({
  documentDirectory: 'file:///documents/',
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  readDirectoryAsync: (...args: unknown[]) => mockReadDirectoryAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
}));

jest.mock('../services/database', () => ({
  getDB: async () => ({
    getAllAsync: (...args: unknown[]) => mockGetAllAsync(...args),
  }),
}));

jest.mock('../services/noteStickers', () => ({
  STICKER_DIRECTORY: 'file:///documents/stickers/',
  cleanupUnusedSharedStickerCacheFiles: (...args: unknown[]) =>
    mockCleanupUnusedSharedStickerCacheFiles(...args),
}));

import {
  cleanupOrphanMediaFiles,
  cleanupOrphanPhotoFiles,
  cleanupOrphanStickerFiles,
} from '../services/mediaIntegrity';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetInfoAsync.mockResolvedValue({ exists: true, isDirectory: true });
  mockDeleteAsync.mockResolvedValue(undefined);
  mockCleanupUnusedSharedStickerCacheFiles.mockResolvedValue(undefined);
});

describe('mediaIntegrity', () => {
  it('keeps photo files referenced by any persisted scope', async () => {
    mockGetAllAsync.mockResolvedValueOnce([
      { content: 'photos/local-note.jpg', photo_local_uri: null },
      { content: 'file:///documents/photos/account-note.jpg', photo_local_uri: null },
    ]);
    mockReadDirectoryAsync.mockResolvedValueOnce([
      'local-note.jpg',
      'account-note.jpg',
      'orphan.jpg',
    ]);

    const deletedCount = await cleanupOrphanPhotoFiles();

    expect(deletedCount).toBe(1);
    expect(mockDeleteAsync).toHaveBeenCalledWith('file:///documents/photos/orphan.jpg', {
      idempotent: true,
    });
  });

  it('keeps sticker files referenced by any persisted scope', async () => {
    mockGetAllAsync.mockResolvedValueOnce([
      { local_uri: 'file:///documents/stickers/local.webp' },
      { local_uri: 'file:///documents/stickers/account.webp' },
    ]);
    mockReadDirectoryAsync.mockResolvedValueOnce([
      'local.webp',
      'account.webp',
      'orphan.webp',
    ]);

    const deletedCount = await cleanupOrphanStickerFiles();

    expect(deletedCount).toBe(1);
    expect(mockDeleteAsync).toHaveBeenCalledWith('file:///documents/stickers/orphan.webp', {
      idempotent: true,
    });
  });

  it('runs all orphan cleanup tasks together', async () => {
    mockGetAllAsync
      .mockResolvedValueOnce([{ content: 'photos/live.jpg', photo_local_uri: null }])
      .mockResolvedValueOnce([{ local_uri: 'file:///documents/stickers/live.webp' }]);
    mockReadDirectoryAsync
      .mockResolvedValueOnce(['live.jpg'])
      .mockResolvedValueOnce(['live.webp']);

    await cleanupOrphanMediaFiles();

    expect(mockCleanupUnusedSharedStickerCacheFiles).toHaveBeenCalledTimes(1);
  });
});

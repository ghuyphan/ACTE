const mockDb = {
  runAsync: jest.fn(async () => undefined),
  getAllAsync: jest.fn(async () => []),
  getFirstAsync: jest.fn(async () => null),
};

const mockGetInfoAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockCopyAsync = jest.fn(async () => undefined);
const mockDeleteAsync = jest.fn(async () => undefined);
const mockMakeDirectoryAsync = jest.fn(async () => undefined);
const mockManipulateAsync = jest.fn();
const mockStorageUpload = jest.fn(async () => ({ error: null }));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-1234'),
}));

jest.mock('../utils/fileSystem', () => ({
  __esModule: true,
  documentDirectory: 'file:///documents/',
  cacheDirectory: 'file:///cache/',
  EncodingType: {
    Base64: 'base64',
  },
  getInfoAsync: mockGetInfoAsync,
  readAsStringAsync: mockReadAsStringAsync,
  copyAsync: mockCopyAsync,
  deleteAsync: mockDeleteAsync,
  makeDirectoryAsync: mockMakeDirectoryAsync,
}));

jest.mock('expo-image-manipulator', () => ({
  __esModule: true,
  manipulateAsync: mockManipulateAsync,
  SaveFormat: {
    WEBP: 'webp',
  },
}));

jest.mock('../services/database', () => ({
  getActiveNotesScope: jest.fn(() => '__local__'),
  getDB: jest.fn(async () => mockDb),
  withDatabaseTransaction: jest.fn(),
}));

jest.mock('../utils/supabase', () => ({
  getSupabaseErrorMessage: jest.fn((error: Error) => error.message),
  isSupabaseNetworkError: jest.fn(() => false),
  requireSupabase: jest.fn(() => ({
    storage: {
      from: jest.fn(() => ({
        upload: mockStorageUpload,
        createSignedUrl: jest.fn(async () => ({ data: { signedUrl: 'https://example.com/file' }, error: null })),
      })),
    },
  })),
}));

import { Image } from 'react-native';

const transparentPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFAAH/e+m+7wAAAABJRU5ErkJggg==';

function loadImportStickerAsset() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const module = require('../services/noteStickers');
  return module.importStickerAsset;
}

function loadNoteStickersModule() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../services/noteStickers');
}

describe('importStickerAsset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    jest.spyOn(Image, 'getSize').mockImplementation(
      (
        uri: string,
        success: (width: number, height: number) => void,
        _failure?: (error: Error) => void
      ) => {
        if (uri.includes('optimized')) {
          success(768, 512);
          return;
        }

        if (uri.endsWith('.webp')) {
          success(768, 512);
          return;
        }

        success(320, 240);
      }
    );

    mockReadAsStringAsync.mockResolvedValue(transparentPngBase64);
    mockMakeDirectoryAsync.mockResolvedValue(undefined);
    mockCopyAsync.mockResolvedValue(undefined);
    mockDeleteAsync.mockResolvedValue(undefined);
    mockManipulateAsync.mockResolvedValue({
      uri: 'file:///cache/optimized-sticker.webp',
    });
    mockStorageUpload.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps small stickers in their original format', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1762479839534);
    const importStickerAsset = loadImportStickerAsset();

    mockGetInfoAsync.mockImplementation(async (uri: string) => {
      if (uri === 'file:///imports/small-sticker.png') {
        return { exists: true, isDirectory: false, size: 80 * 1024 };
      }

      return { exists: true, isDirectory: false, size: 80 * 1024 };
    });

    const asset = await importStickerAsset({
      uri: 'file:///imports/small-sticker.png',
      mimeType: 'image/png',
      name: 'small-sticker.png',
    });

    expect(mockManipulateAsync).not.toHaveBeenCalled();
    expect(mockCopyAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'file:///imports/small-sticker.png',
        to: 'file:///documents/stickers/sticker-1762479839534-test-uui.png',
      })
    );
    expect(asset.mimeType).toBe('image/png');
    expect(asset.localUri.endsWith('.png')).toBe(true);
    expect(asset.suggestedRenderMode).toBe('default');
  });

  it('optimizes oversized stickers into webp before saving', async () => {
    const importStickerAsset = loadImportStickerAsset();

    mockGetInfoAsync.mockImplementation(async (uri: string) => {
      if (uri === 'file:///imports/large-sticker.png') {
        return { exists: true, isDirectory: false, size: 900 * 1024 };
      }

      if (uri === 'file:///cache/optimized-sticker.webp') {
        return { exists: true, isDirectory: false, size: 180 * 1024 };
      }

      return { exists: true, isDirectory: false, size: 180 * 1024 };
    });

    jest.spyOn(Date, 'now').mockReturnValue(1762479839534);
    jest.spyOn(Image, 'getSize').mockImplementation(
      (
        uri: string,
        success: (width: number, height: number) => void,
        _failure?: (error: Error) => void
      ) => {
        if (uri === 'file:///imports/large-sticker.png') {
          success(2048, 1536);
          return;
        }

        success(768, 512);
      }
    );

    const asset = await importStickerAsset({
      uri: 'file:///imports/large-sticker.png',
      mimeType: 'image/png',
      name: 'large-sticker.png',
    });

    expect(mockManipulateAsync).toHaveBeenCalledWith(
      'file:///imports/large-sticker.png',
      [{ resize: { width: 1024 } }],
      expect.objectContaining({
        compress: 0.9,
        format: 'webp',
      })
    );
    expect(mockCopyAsync).toHaveBeenCalledWith({
      from: 'file:///cache/optimized-sticker.webp',
      to: 'file:///documents/stickers/sticker-1762479839534-test-uui.webp',
    });
    expect(mockDeleteAsync).toHaveBeenCalledWith('file:///cache/optimized-sticker.webp', {
      idempotent: true,
    });
    expect(asset.mimeType).toBe('image/webp');
    expect(asset.localUri.endsWith('.webp')).toBe(true);
  });

  it('imports regular photos and suggests stamp mode', async () => {
    const importStickerAsset = loadImportStickerAsset();

    mockGetInfoAsync.mockResolvedValue({ exists: true, isDirectory: false, size: 80 * 1024 });

    const asset = await importStickerAsset({
      uri: 'file:///imports/not-a-sticker.jpg',
      mimeType: 'image/jpeg',
      name: 'not-a-sticker.jpg',
    });

    expect(asset.mimeType).toBe('image/jpeg');
    expect(asset.localUri.endsWith('.jpg')).toBe(true);
    expect(asset.suggestedRenderMode).toBe('stamp');
  });

  it('reuses an existing remote sticker path when serializing shared placements', async () => {
    const { serializeStickerPlacementsForStorage } = loadNoteStickersModule();

    const placements = [
      {
        id: 'placement-1',
        assetId: 'asset-1',
        x: 0.5,
        y: 0.5,
        scale: 1,
        rotation: 0,
        zIndex: 1,
        opacity: 1,
        asset: {
          id: 'asset-1',
          ownerUid: '__local__',
          localUri: 'file:///documents/stickers/asset-1.png',
          remotePath: null,
          uploadFingerprint: null,
          mimeType: 'image/png',
          width: 320,
          height: 240,
          createdAt: '2026-03-10T00:00:00.000Z',
          updatedAt: null,
          source: 'import',
        },
      },
    ];

    const serialized = await serializeStickerPlacementsForStorage(
      placements,
      'shared-post-media',
      'owner-1/shared-post-1',
      {
        persistAssets: false,
        existingRemoteAssetPathsById: {
          'asset-1': 'owner-1/shared-post-1/stickers/asset-1.png',
        },
      }
    );

    expect(mockReadAsStringAsync).not.toHaveBeenCalledWith(
      'file:///documents/stickers/asset-1.png',
      expect.anything()
    );
    expect(mockStorageUpload).not.toHaveBeenCalled();
    expect(JSON.parse(serialized)[0]?.asset?.remotePath).toBe(
      'owner-1/shared-post-1/stickers/asset-1.png'
    );
  });
});

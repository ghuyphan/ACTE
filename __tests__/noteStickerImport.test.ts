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
        upload: jest.fn(async () => ({ error: null })),
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
});

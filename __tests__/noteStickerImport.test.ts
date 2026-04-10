import { Image } from 'react-native';

const mockDb = {
  runAsync: jest.fn(async () => undefined),
  getAllAsync: jest.fn(async () => []),
  getFirstAsync: jest.fn(async () => null),
};

const mockGetInfoAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockReadAsBytesAsync = jest.fn();
const mockCopyAsync = jest.fn(async () => undefined);
const mockDeleteAsync = jest.fn(async () => undefined);
const mockMakeDirectoryAsync = jest.fn(async () => undefined);
const mockManipulateAsync = jest.fn();
const mockStorageUpload = jest.fn(async () => ({ error: null }));
const mockRemoteStickerAssets = new Map<string, any>();
const mockIsSupabaseNetworkError = jest.fn((_: unknown) => false);
const mockIsSupabasePolicyError = jest.fn((_: unknown) => false);
const mockIsSupabaseSchemaMismatchError = jest.fn((_: unknown) => false);
let mockRemoteStickerAssetInsertError: unknown = null;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-1234'),
  digest: jest.fn(async (_algorithm: string, data: BufferSource) => {
    if (ArrayBuffer.isView(data)) {
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }

    return data;
  }),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
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
  readAsBytesAsync: mockReadAsBytesAsync,
  copyAsync: mockCopyAsync,
  deleteAsync: mockDeleteAsync,
  makeDirectoryAsync: mockMakeDirectoryAsync,
}));

jest.mock('expo-image-manipulator', () => ({
  __esModule: true,
  manipulateAsync: mockManipulateAsync,
  SaveFormat: {
    WEBP: 'webp',
    JPEG: 'jpeg',
  },
}));

jest.mock('../services/database', () => ({
  getActiveNotesScope: jest.fn(() => '__local__'),
  getDB: jest.fn(async () => mockDb),
  withDatabaseTransaction: jest.fn(),
}));

jest.mock('../utils/supabase', () => ({
  getSupabaseErrorMessage: jest.fn((error: Error) => error.message),
  isSupabaseNetworkError: (error: unknown) => mockIsSupabaseNetworkError(error),
  isSupabasePolicyError: (error: unknown) => mockIsSupabasePolicyError(error),
  isSupabaseSchemaMismatchError: (error: unknown) => mockIsSupabaseSchemaMismatchError(error),
  requireSupabase: jest.fn(() => ({
    from: (table: string) => {
      if (table !== 'sticker_assets') {
        throw new Error(`Unexpected table: ${table}`);
      }

      const state = {
        filters: [] as { field: string; value: unknown }[],
        updateValues: null as Record<string, unknown> | null,
      };
      const builder: any = {
        select: () => builder,
        eq: (field: string, value: unknown) => {
          state.filters.push({ field, value });
          return builder;
        },
        maybeSingle: async () => {
          const row =
            Array.from(mockRemoteStickerAssets.values()).find((item) =>
              state.filters.every((filter) => item?.[filter.field] === filter.value)
            ) ?? null;
          return { data: row, error: null };
        },
        insert: async (value: Record<string, unknown>) => {
          if (mockRemoteStickerAssetInsertError) {
            return { error: mockRemoteStickerAssetInsertError };
          }

          const nextId = `remote-sticker-${mockRemoteStickerAssets.size + 1}`;
          mockRemoteStickerAssets.set(nextId, {
            id: nextId,
            created_at: '2026-03-10T00:00:00.000Z',
            ...value,
          });
          return { error: null };
        },
        update: (value: Record<string, unknown>) => {
          state.updateValues = value;
          return builder;
        },
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
          try {
            if (state.updateValues) {
              for (const [assetId, item] of mockRemoteStickerAssets.entries()) {
                if (state.filters.every((filter) => item?.[filter.field] === filter.value)) {
                  mockRemoteStickerAssets.set(assetId, {
                    ...item,
                    ...state.updateValues,
                  });
                }
              }

              return Promise.resolve(resolve({ data: null, error: null }));
            }

            return Promise.resolve(resolve({ data: null, error: null }));
          } catch (error) {
            if (reject) {
              return Promise.resolve(reject(error));
            }

            return Promise.reject(error);
          }
        },
      };

      return builder;
    },
    storage: {
      from: jest.fn(() => ({
        upload: mockStorageUpload,
        createSignedUrl: jest.fn(async () => ({ data: { signedUrl: 'https://example.com/file' }, error: null })),
      })),
    },
  })),
}));

const transparentPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFAAH/e+m+7wAAAABJRU5ErkJggg==';
const transparentPngBytes = Uint8Array.from(Buffer.from(transparentPngBase64, 'base64'));
const transparentPngHash = bytesToHex(transparentPngBytes);

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
    mockReadAsBytesAsync.mockResolvedValue(transparentPngBytes);
    mockMakeDirectoryAsync.mockResolvedValue(undefined);
    mockCopyAsync.mockResolvedValue(undefined);
    mockDeleteAsync.mockResolvedValue(undefined);
    mockManipulateAsync.mockResolvedValue({
      uri: 'file:///cache/optimized-sticker.webp',
    });
    mockStorageUpload.mockResolvedValue({ error: null });
    mockIsSupabaseNetworkError.mockReturnValue(false);
    mockIsSupabasePolicyError.mockReturnValue(false);
    mockIsSupabaseSchemaMismatchError.mockReturnValue(false);
    mockRemoteStickerAssetInsertError = null;
    mockRemoteStickerAssets.clear();
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
    const insertCall = mockDb.runAsync.mock.calls.at(0);
    expect(insertCall).toBeTruthy();
    const insertSql = insertCall?.at(0);
    expect(insertSql).toContain('INSERT INTO sticker_assets');
    expect(insertCall).toHaveLength(13);
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

  it('detects when a source can be imported directly as a floating sticker', async () => {
    const { shouldImportSourceDirectlyAsSticker } = loadNoteStickersModule();

    mockGetInfoAsync.mockResolvedValue({ exists: true, isDirectory: false, size: 80 * 1024 });

    await expect(
      shouldImportSourceDirectlyAsSticker({
        uri: 'file:///imports/transparent-sticker.png',
        mimeType: 'image/png',
        name: 'transparent-sticker.png',
      })
    ).resolves.toBe(true);
  });

  it('does not bypass subject cutout for opaque png sources', async () => {
    const { shouldImportSourceDirectlyAsSticker } = loadNoteStickersModule();
    const opaquePngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

    mockGetInfoAsync.mockResolvedValue({ exists: true, isDirectory: false, size: 80 * 1024 });
    mockReadAsBytesAsync.mockResolvedValue(Uint8Array.from(Buffer.from(opaquePngBase64, 'base64')));

    await expect(
      shouldImportSourceDirectlyAsSticker({
        uri: 'file:///imports/opaque-sticker.png',
        mimeType: 'image/png',
        name: 'opaque-sticker.png',
      })
    ).resolves.toBe(false);
  });

  it('normalizes heic photo stamps into jpeg before saving', async () => {
    const importStickerAsset = loadImportStickerAsset();

    mockGetInfoAsync.mockImplementation(async (uri: string) => {
      if (uri === 'file:///imports/photo.heic') {
        return { exists: true, isDirectory: false, size: 80 * 1024 };
      }

      if (uri === 'file:///cache/normalized-stamp.jpg') {
        return { exists: true, isDirectory: false, size: 70 * 1024 };
      }

      return { exists: true, isDirectory: false, size: 80 * 1024 };
    });
    mockManipulateAsync.mockResolvedValueOnce({
      uri: 'file:///cache/normalized-stamp.jpg',
    });

    const asset = await importStickerAsset({
      uri: 'file:///imports/photo.heic',
      mimeType: 'image/heic',
      name: 'photo.heic',
    });

    expect(mockManipulateAsync).toHaveBeenCalledWith(
      'file:///imports/photo.heic',
      [],
      expect.objectContaining({
        compress: 0.94,
        format: 'jpeg',
      })
    );
    expect(mockCopyAsync).toHaveBeenCalledWith({
      from: 'file:///cache/normalized-stamp.jpg',
      to: expect.stringMatching(/^file:\/\/\/documents\/stickers\/.+\.jpg$/),
    });
    expect(mockDeleteAsync).toHaveBeenCalledWith('file:///cache/normalized-stamp.jpg', {
      idempotent: true,
    });
    expect(asset.mimeType).toBe('image/jpeg');
    expect(asset.localUri.endsWith('.jpg')).toBe(true);
    expect(asset.suggestedRenderMode).toBe('stamp');
  });

  it('reuses an existing imported asset when the optimized sticker bytes match', async () => {
    const importStickerAsset = loadImportStickerAsset();

    mockGetInfoAsync.mockImplementation(async (uri: string) => {
      if (uri === 'file:///imports/same-sticker.png') {
        return { exists: true, isDirectory: false, size: 80 * 1024 };
      }

      if (uri === 'file:///documents/stickers/existing.webp') {
        return { exists: true, isDirectory: false, size: 80 * 1024 };
      }

      return { exists: true, isDirectory: false, size: 80 * 1024 };
    });

    mockDb.getFirstAsync.mockImplementationOnce(
      async () =>
        ({
          id: 'asset-existing',
          owner_uid: '__local__',
          local_uri: 'file:///documents/stickers/existing.webp',
          remote_path: 'owner-1/stickers/asset-existing.webp',
          upload_fingerprint: 'fingerprint-existing',
          content_hash: transparentPngHash,
          mime_type: 'image/webp',
          width: 320,
          height: 240,
          created_at: '2026-03-10T00:00:00.000Z',
          updated_at: null,
          source: 'import',
        }) as never
    );

    const asset = await importStickerAsset({
      uri: 'file:///imports/same-sticker.png',
      mimeType: 'image/png',
      name: 'same-sticker.png',
    });

    expect(mockCopyAsync).not.toHaveBeenCalled();
    expect(mockDb.runAsync).not.toHaveBeenCalled();
    expect(asset.id).toBe('asset-existing');
    expect(asset.localUri).toBe('file:///documents/stickers/existing.webp');
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

    expect(mockReadAsBytesAsync).not.toHaveBeenCalledWith('file:///documents/stickers/asset-1.png');
    expect(mockStorageUpload).not.toHaveBeenCalled();
    expect(JSON.parse(serialized)[0]?.asset?.remotePath).toBe(
      'owner-1/shared-post-1/stickers/asset-1.png'
    );
  });

  it('uses the remote sticker registry when serializing shared placements', async () => {
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
        serverOwnerUid: 'owner-1',
      }
    );

    expect(mockStorageUpload).toHaveBeenCalledWith(
      `owner-1/stickers/${transparentPngHash}.png`,
      expect.any(ArrayBuffer),
      expect.objectContaining({
        contentType: 'image/png',
        upsert: true,
      })
    );
    expect(JSON.parse(serialized)[0]?.asset).toEqual(
      expect.objectContaining({
        remoteAssetId: 'remote-sticker-1',
        remotePath: `owner-1/stickers/${transparentPngHash}.png`,
        storageBucket: 'note-media',
      })
    );
  });

  it('refreshes last seen when the remote sticker registry reuses an existing asset', async () => {
    const { serializeStickerPlacementsForStorage } = loadNoteStickersModule();

    mockRemoteStickerAssets.set('remote-sticker-1', {
      id: 'remote-sticker-1',
      owner_user_id: 'owner-1',
      content_hash: transparentPngHash,
      mime_type: 'image/png',
      width: 320,
      height: 240,
      byte_size: 512,
      storage_bucket: 'note-media',
      storage_path: `owner-1/stickers/${transparentPngHash}.png`,
      created_at: '2026-03-10T00:00:00.000Z',
      last_seen_at: '2026-03-11T00:00:00.000Z',
    });

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

    const beforeLastSeenAt = mockRemoteStickerAssets.get('remote-sticker-1')?.last_seen_at;
    await serializeStickerPlacementsForStorage(placements, 'shared-post-media', 'owner-1/shared-post-1', {
      persistAssets: false,
      serverOwnerUid: 'owner-1',
    });

    const reusedRow = mockRemoteStickerAssets.get('remote-sticker-1');
    expect(mockStorageUpload).not.toHaveBeenCalled();
    expect(reusedRow?.last_seen_at).toBeTruthy();
    expect(reusedRow?.last_seen_at).not.toBe(beforeLastSeenAt);
  });

  it('logs the remote sticker registry policy failure once per cooldown window and falls back', async () => {
    const { serializeStickerPlacementsForStorage } = loadNoteStickersModule();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    mockRemoteStickerAssetInsertError = {
      code: '42501',
      message: 'new row violates row-level security policy for table "sticker_assets"',
    };
    mockIsSupabasePolicyError.mockImplementation(
      (error: unknown) =>
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        String((error as { code?: unknown }).code) === '42501'
    );

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

    const firstSerialized = await serializeStickerPlacementsForStorage(
      placements,
      'shared-post-media',
      'owner-1/shared-post-1',
      {
        persistAssets: false,
        serverOwnerUid: 'owner-1',
      }
    );
    const firstUploadCount = mockStorageUpload.mock.calls.length;

    const secondSerialized = await serializeStickerPlacementsForStorage(
      placements,
      'shared-post-media',
      'owner-1/shared-post-1',
      {
        persistAssets: false,
        serverOwnerUid: 'owner-1',
      }
    );

    expect(JSON.parse(firstSerialized)[0]?.asset?.remotePath).toBe(
      'owner-1/shared-post-1/stickers/asset-1.png'
    );
    expect(JSON.parse(secondSerialized)[0]?.asset?.remotePath).toBe(
      'owner-1/shared-post-1/stickers/asset-1.png'
    );
    expect(firstUploadCount).toBe(2);
    expect(mockStorageUpload.mock.calls).toHaveLength(3);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('skips re-uploading when the sticker bytes are unchanged but file metadata changed', async () => {
    const { uploadStickerAssetToStorage } = loadNoteStickersModule();

    mockGetInfoAsync.mockImplementation(async (uri: string) => {
      if (uri === 'file:///documents/stickers/asset-1.png') {
        return {
          exists: true,
          isDirectory: false,
          size: 80 * 1024,
          modificationTime: 200,
        };
      }

      return {
        exists: true,
        isDirectory: false,
        size: 80 * 1024,
        modificationTime: 200,
      };
    });

    mockReadAsBytesAsync.mockResolvedValue(transparentPngBytes);

    const asset = await uploadStickerAssetToStorage('note-media', 'owner-1', {
      id: 'asset-1',
      ownerUid: '__local__',
      localUri: 'file:///documents/stickers/asset-1.png',
      remotePath: 'owner-1/stickers/asset-1.png',
      uploadFingerprint: 'file:///documents/stickers/asset-1.png:81920:100',
      contentHash: transparentPngHash,
      mimeType: 'image/png',
      width: 320,
      height: 240,
      createdAt: '2026-03-10T00:00:00.000Z',
      updatedAt: null,
      source: 'import',
    });

    expect(mockStorageUpload).not.toHaveBeenCalled();
    expect(mockDb.runAsync).toHaveBeenCalled();
    expect(asset.uploadFingerprint).toBe(transparentPngHash);
    expect(asset.contentHash).toBe(transparentPngHash);
  });
});

import * as Crypto from 'expo-crypto';
import * as FileSystem from '../utils/fileSystem';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'react-native';
import {
  getActiveNotesScope,
  getDB,
  type SQLiteTransactionExecutor,
  withDatabaseTransaction,
} from './database';
import {
  getSupabaseErrorMessage,
  isSupabaseNetworkError,
  isSupabasePolicyError,
  isSupabaseSchemaMismatchError,
  isSupabaseStorageObjectMissingError,
  requireSupabase,
} from '../utils/supabase';
import { NOTE_MEDIA_BUCKET } from './remoteMedia';

export type StickerSource = 'import';
export type StickerRenderMode = 'default' | 'stamp';
export type StickerImportErrorCode =
  | 'unsupported-format'
  | 'file-unavailable'
  | 'missing-transparency';

export interface StickerAsset {
  id: string;
  ownerUid: string;
  localUri: string;
  remotePath: string | null;
  uploadFingerprint?: string | null;
  contentHash?: string | null;
  remoteAssetId?: string | null;
  storageBucket?: string | null;
  mimeType: string;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string | null;
  source: StickerSource;
  suggestedRenderMode?: StickerRenderMode;
}

export interface StickerPlacement {
  id: string;
  assetId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex: number;
  opacity: number;
  outlineEnabled?: boolean;
  motionLocked?: boolean;
  renderMode?: StickerRenderMode;
}

export interface NoteStickerPlacement extends StickerPlacement {
  asset: StickerAsset;
}

export interface StickerImportSource {
  uri: string;
  mimeType?: string | null;
  name?: string | null;
}

export interface StickerImportOptions {
  requiresTransparency?: boolean;
}

export interface CreateStickerPlacementOptions {
  renderMode?: StickerRenderMode;
}

export class StickerImportError extends Error {
  code: StickerImportErrorCode;

  constructor(code: StickerImportErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'StickerImportError';
    this.code = code;
  }
}

interface StickerAssetRow {
  id: string;
  owner_uid: string;
  local_uri: string;
  remote_path: string | null;
  upload_fingerprint: string | null;
  content_hash: string | null;
  mime_type: string;
  width: number;
  height: number;
  created_at: string;
  updated_at: string | null;
  source: StickerSource;
}

interface NoteStickerRow {
  note_id: string;
  placements_json: string;
  updated_at: string;
}

type RemoteStickerContainerType = 'note' | 'shared_post';

interface RemoteStickerAssetRow {
  id: string;
  owner_user_id: string;
  content_hash: string;
  mime_type: string;
  width: number;
  height: number;
  byte_size: number | null;
  storage_bucket: string;
  storage_path: string;
  created_at: string;
  last_seen_at: string;
}

interface RemoteStickerAssetRefRow {
  asset_id: string;
}

export const STICKER_DIRECTORY = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}stickers/`
  : null;
export const SHARED_STICKER_CACHE_DIRECTORY = FileSystem.cacheDirectory
  ? `${FileSystem.cacheDirectory}shared-stickers/`
  : null;
const NOTE_STICKER_MEDIA_PREFIX = 'stickers';
const STICKER_UPLOAD_RETRY_DELAYS_MS = [250];
const SUPPORTED_STICKER_MIME_TYPES = new Set([
  'image/png',
  'image/webp',
  'image/jpeg',
  'image/heic',
  'image/heif',
]);
const MAX_STICKER_FILE_SIZE_BYTES = 450 * 1024;
const MAX_STICKER_DIMENSION_PX = 1024;
const STICKER_IMPORT_OPTIMIZATION_PRESETS = [
  { maxDimension: 1024, compress: 0.9 },
  { maxDimension: 768, compress: 0.82 },
  { maxDimension: 512, compress: 0.72 },
];

function normalizeMimeType(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'image/jpg') {
    return 'image/jpeg';
  }

  return normalized;
}

function getMimeTypeFromName(name: string | null | undefined) {
  const normalizedName = typeof name === 'string' ? name.trim().toLowerCase() : '';
  if (normalizedName.endsWith('.png')) {
    return 'image/png';
  }

  if (normalizedName.endsWith('.webp')) {
    return 'image/webp';
  }

  if (normalizedName.endsWith('.jpg') || normalizedName.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  if (normalizedName.endsWith('.heic')) {
    return 'image/heic';
  }

  if (normalizedName.endsWith('.heif')) {
    return 'image/heif';
  }

  return '';
}

function getStickerFileExtension(mimeType: string) {
  if (mimeType === 'image/webp') {
    return 'webp';
  }

  if (mimeType === 'image/jpeg') {
    return 'jpg';
  }

  if (mimeType === 'image/heic') {
    return 'heic';
  }

  if (mimeType === 'image/heif') {
    return 'heif';
  }

  return 'png';
}

function parsePngHasTransparency(bytes: Uint8Array) {
  if (bytes.length < 33) {
    return false;
  }

  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!pngSignature.every((value, index) => bytes[index] === value)) {
    return false;
  }

  const colorType = bytes[25] ?? 0;
  if (colorType === 4 || colorType === 6) {
    return true;
  }

  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length =
      ((bytes[offset] ?? 0) << 24) |
      ((bytes[offset + 1] ?? 0) << 16) |
      ((bytes[offset + 2] ?? 0) << 8) |
      (bytes[offset + 3] ?? 0);
    const type = String.fromCharCode(
      bytes[offset + 4] ?? 0,
      bytes[offset + 5] ?? 0,
      bytes[offset + 6] ?? 0,
      bytes[offset + 7] ?? 0
    );

    if (type === 'tRNS') {
      return true;
    }

    offset += 12 + length;
    if (type === 'IEND') {
      break;
    }
  }

  return false;
}

function parseWebpHasTransparency(bytes: Uint8Array) {
  if (bytes.length < 16) {
    return false;
  }

  const riff = String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0, bytes[3] ?? 0);
  const webp = String.fromCharCode(bytes[8] ?? 0, bytes[9] ?? 0, bytes[10] ?? 0, bytes[11] ?? 0);
  if (riff !== 'RIFF' || webp !== 'WEBP') {
    return false;
  }

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkType = String.fromCharCode(
      bytes[offset] ?? 0,
      bytes[offset + 1] ?? 0,
      bytes[offset + 2] ?? 0,
      bytes[offset + 3] ?? 0
    );
    const chunkSize =
      (bytes[offset + 4] ?? 0) |
      ((bytes[offset + 5] ?? 0) << 8) |
      ((bytes[offset + 6] ?? 0) << 16) |
      ((bytes[offset + 7] ?? 0) << 24);

    if (chunkType === 'ALPH') {
      return true;
    }

    if (chunkType === 'VP8X' && offset + 9 < bytes.length) {
      const featureFlags = bytes[offset + 8] ?? 0;
      return (featureFlags & 0b00010000) !== 0;
    }

    offset += 8 + chunkSize + (chunkSize % 2);
  }

  return false;
}

function hasTransparency(bytes: Uint8Array, mimeType: string) {
  if (mimeType === 'image/png') {
    return parsePngHasTransparency(bytes);
  }

  if (mimeType === 'image/webp') {
    return parseWebpHasTransparency(bytes);
  }

  return false;
}

function mimeTypeSupportsTransparencyDetection(mimeType: string) {
  return mimeType === 'image/png' || mimeType === 'image/webp';
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

async function readStickerBytes(uri: string) {
  const bytes = await FileSystem.readAsBytesAsync(uri);
  if (!bytes || bytes.length === 0) {
    return null;
  }

  return bytes;
}

function bufferToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function hashStickerBytes(bytes: Uint8Array) {
  if (bytes.length === 0) {
    return null;
  }

  const digestSource = Uint8Array.from(bytes);
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, digestSource.buffer);
  return bufferToHex(digest);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateStickerAssetId() {
  return `sticker-${Date.now()}-${Crypto.randomUUID().slice(0, 8)}`;
}

function generateStickerPlacementId() {
  return `placement-${Date.now()}-${Crypto.randomUUID().slice(0, 8)}`;
}

const NEW_STICKER_PLACEMENT_OFFSETS = [
  { x: 0, y: 0 },
  { x: 0.05, y: 0.03 },
  { x: -0.05, y: 0.03 },
  { x: 0.04, y: -0.045 },
  { x: -0.04, y: -0.045 },
  { x: 0.075, y: 0 },
  { x: -0.075, y: 0 },
  { x: 0, y: 0.075 },
  { x: 0, y: -0.075 },
] as const;

function getNextStickerPlacementCoordinates(existingPlacements: NoteStickerPlacement[]) {
  const offset = NEW_STICKER_PLACEMENT_OFFSETS[
    Math.min(existingPlacements.length, NEW_STICKER_PLACEMENT_OFFSETS.length - 1)
  ];

  return {
    x: clamp01(0.5 + offset.x),
    y: clamp01(0.5 + offset.y),
  };
}

function mapStickerAsset(row: StickerAssetRow): StickerAsset {
  return {
    id: row.id,
    ownerUid: row.owner_uid,
    localUri: row.local_uri,
    remotePath: row.remote_path ?? null,
    uploadFingerprint: row.upload_fingerprint ?? null,
    contentHash: row.content_hash ?? null,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
    source: row.source,
    suggestedRenderMode: undefined,
  };
}

function isRemoteStickerRegistryUnavailableError(error: unknown) {
  return isSupabaseSchemaMismatchError(error) || isSupabasePolicyError(error);
}

function getRemoteStickerAssetId(asset: StickerAsset) {
  const remoteAssetId = typeof asset.remoteAssetId === 'string' ? asset.remoteAssetId.trim() : '';
  return remoteAssetId || null;
}

function getStickerAssetStorageBucket(asset: StickerAsset, fallbackBucket: string) {
  const storageBucket = typeof asset.storageBucket === 'string' ? asset.storageBucket.trim() : '';
  return storageBucket || fallbackBucket;
}

function mapRemoteStickerAsset(asset: StickerAsset, row: RemoteStickerAssetRow): StickerAsset {
  return {
    ...asset,
    remotePath: row.storage_path,
    remoteAssetId: row.id,
    storageBucket: row.storage_bucket,
    contentHash: row.content_hash,
  };
}

async function getRemoteStickerAssetRowByContentHash(
  ownerUserId: string,
  contentHash: string
): Promise<RemoteStickerAssetRow | null> {
  const { data, error } = await requireSupabase()
    .from('sticker_assets')
    .select(
      'id, owner_user_id, content_hash, mime_type, width, height, byte_size, storage_bucket, storage_path, created_at, last_seen_at'
    )
    .eq('owner_user_id', ownerUserId)
    .eq('content_hash', contentHash)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as RemoteStickerAssetRow | null) ?? null;
}

async function touchRemoteStickerAssetLastSeen(assetId: string) {
  const normalizedAssetId = typeof assetId === 'string' ? assetId.trim() : '';
  if (!normalizedAssetId) {
    return;
  }

  const { error } = await requireSupabase()
    .from('sticker_assets')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', normalizedAssetId);

  if (error) {
    throw error;
  }
}

async function registerRemoteStickerAsset(
  ownerUserId: string,
  asset: StickerAsset
): Promise<StickerAsset | null> {
  const localUri = typeof asset.localUri === 'string' ? asset.localUri.trim() : '';
  if (!localUri) {
    return null;
  }

  try {
    const uploadFingerprint = asset.uploadFingerprint ?? (await getStickerUploadFingerprint(localUri));
    const bytes = await readStickerBytes(localUri);
    if (!bytes) {
      return null;
    }

    const contentHash = asset.contentHash ?? (await hashStickerBytes(bytes));
    if (!contentHash) {
      return null;
    }

    const existingRow = await getRemoteStickerAssetRowByContentHash(ownerUserId, contentHash);
    if (existingRow) {
      await touchRemoteStickerAssetLastSeen(existingRow.id);
      return {
        ...mapRemoteStickerAsset(asset, existingRow),
        uploadFingerprint,
      };
    }

    const storagePath = `${ownerUserId}/${NOTE_STICKER_MEDIA_PREFIX}/${contentHash}.${getStickerFileExtension(asset.mimeType)}`;
    await uploadStickerBytesWithRetry(
      NOTE_MEDIA_BUCKET,
      storagePath,
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      asset.mimeType,
      true
    );

    const byteSize = bytes.byteLength;
    const now = new Date().toISOString();
    const { error: insertError } = await requireSupabase().from('sticker_assets').insert({
      owner_user_id: ownerUserId,
      content_hash: contentHash,
      mime_type: asset.mimeType,
      width: Math.round(asset.width),
      height: Math.round(asset.height),
      byte_size: byteSize,
      storage_bucket: NOTE_MEDIA_BUCKET,
      storage_path: storagePath,
      last_seen_at: now,
    });

    if (insertError && !isRemoteStickerRegistryUnavailableError(insertError)) {
      const concurrentRow = await getRemoteStickerAssetRowByContentHash(ownerUserId, contentHash);
      if (!concurrentRow) {
        throw insertError;
      }

      await touchRemoteStickerAssetLastSeen(concurrentRow.id);
      return {
        ...mapRemoteStickerAsset(asset, concurrentRow),
        uploadFingerprint,
      };
    }

    if (insertError) {
      throw insertError;
    }

    const insertedRow = await getRemoteStickerAssetRowByContentHash(ownerUserId, contentHash);
    if (!insertedRow) {
      throw new Error('Sticker asset registration finished without returning a server asset row.');
    }

    return {
      ...mapRemoteStickerAsset(asset, insertedRow),
      uploadFingerprint,
    };
  } catch (error) {
    if (isRemoteStickerRegistryUnavailableError(error)) {
      console.warn('[stickers] Remote sticker registry unavailable, falling back to legacy uploads:', error);
      return null;
    }

    throw error;
  }
}

function getRemoteStickerAssetIdsFromPlacementsJson(
  placementsJson: string | null | undefined
) {
  return Array.from(
    new Set(
      parseNoteStickerPlacements(placementsJson)
        .map((placement) => getRemoteStickerAssetId(placement.asset))
        .filter((value): value is string => Boolean(value))
    )
  );
}

function getImageSize(uri: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error)
    );
  });
}

async function getStickerFileInfo(uri: string) {
  const fileInfo = await FileSystem.getInfoAsync(uri);
  if (!fileInfo.exists || fileInfo.isDirectory) {
    return null;
  }

  const { width, height } = await getImageSize(uri);
  return {
    uri,
    size: typeof fileInfo.size === 'number' ? fileInfo.size : null,
    width,
    height,
  };
}

async function getStickerUploadFingerprint(uri: string) {
  const info = await FileSystem.getInfoAsync(uri, { md5: true });
  if (!info.exists || info.isDirectory) {
    return null;
  }

  if (typeof info.md5 === 'string' && info.md5.trim()) {
    return `md5:${info.md5.trim()}`;
  }

  const bytes = await readStickerBytes(uri);
  return bytes ? hashStickerBytes(bytes) : null;
}

async function getStickerContentHash(uri: string) {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.isDirectory) {
    return null;
  }

  const bytes = await readStickerBytes(uri);
  return bytes ? hashStickerBytes(bytes) : null;
}

async function getStickerAssetByContentHash(
  ownerUid: string,
  contentHash: string
): Promise<StickerAsset | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<StickerAssetRow>(
    `SELECT id, owner_uid, local_uri, remote_path, upload_fingerprint, content_hash, mime_type, width, height, created_at, updated_at, source
     FROM sticker_assets
     WHERE owner_uid = ? AND content_hash = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    ownerUid,
    contentHash
  );

  return row ? mapStickerAsset(row) : null;
}

function needsStickerOptimization(
  info: Awaited<ReturnType<typeof getStickerFileInfo>>
): info is NonNullable<Awaited<ReturnType<typeof getStickerFileInfo>>> {
  if (!info) {
    return false;
  }

  return (
    (typeof info.size === 'number' && info.size > MAX_STICKER_FILE_SIZE_BYTES) ||
    info.width > MAX_STICKER_DIMENSION_PX ||
    info.height > MAX_STICKER_DIMENSION_PX
  );
}

function isStickerWithinLimits(info: NonNullable<Awaited<ReturnType<typeof getStickerFileInfo>>>) {
  return (
    (typeof info.size !== 'number' || info.size <= MAX_STICKER_FILE_SIZE_BYTES) &&
    info.width <= MAX_STICKER_DIMENSION_PX &&
    info.height <= MAX_STICKER_DIMENSION_PX
  );
}

function buildStickerResizeActions(
  info: NonNullable<Awaited<ReturnType<typeof getStickerFileInfo>>>,
  maxDimension: number
) {
  if (info.width <= maxDimension && info.height <= maxDimension) {
    return [];
  }

  return info.width >= info.height
    ? [{ resize: { width: maxDimension } }]
    : [{ resize: { height: maxDimension } }];
}

async function optimizeStickerForImport(uri: string, mimeType: string) {
  const originalInfo = await getStickerFileInfo(uri);
  if (!needsStickerOptimization(originalInfo)) {
    return {
      uri,
      mimeType,
      cleanupUris: [] as string[],
    };
  }

  let currentInfo = originalInfo;
  let bestUri: string | null = null;
  let bestSize: number | null = null;
  const cleanupUris: string[] = [];

  for (const preset of STICKER_IMPORT_OPTIMIZATION_PRESETS) {
    const result = await manipulateAsync(
      currentInfo.uri,
      buildStickerResizeActions(currentInfo, preset.maxDimension),
      {
        compress: preset.compress,
        format: SaveFormat.WEBP,
      }
    );

    if (result.uri !== uri) {
      cleanupUris.push(result.uri);
    }

    const optimizedInfo = await getStickerFileInfo(result.uri);
    if (!optimizedInfo) {
      continue;
    }

    currentInfo = optimizedInfo;

    if (
      typeof optimizedInfo.size === 'number' &&
      (bestSize === null || optimizedInfo.size < bestSize)
    ) {
      bestUri = result.uri;
      bestSize = optimizedInfo.size;
    }

    if (isStickerWithinLimits(optimizedInfo)) {
      return {
        uri: result.uri,
        mimeType: 'image/webp',
        cleanupUris,
      };
    }
  }

  if (
    bestUri &&
    (typeof originalInfo.size !== 'number' ||
      bestSize === null ||
      bestSize < originalInfo.size ||
      originalInfo.width > MAX_STICKER_DIMENSION_PX ||
      originalInfo.height > MAX_STICKER_DIMENSION_PX)
  ) {
    return {
      uri: bestUri,
      mimeType: 'image/webp',
      cleanupUris,
    };
  }

  return {
    uri,
    mimeType,
    cleanupUris,
  };
}

async function ensureStickerDirectory() {
  if (!STICKER_DIRECTORY) {
    return null;
  }

  await FileSystem.makeDirectoryAsync(STICKER_DIRECTORY, { intermediates: true });
  return STICKER_DIRECTORY;
}

async function ensureSharedStickerCacheDirectory() {
  if (!SHARED_STICKER_CACHE_DIRECTORY) {
    return null;
  }

  await FileSystem.makeDirectoryAsync(SHARED_STICKER_CACHE_DIRECTORY, { intermediates: true });
  return SHARED_STICKER_CACHE_DIRECTORY;
}

async function validateStickerFile(
  uri: string,
  mimeType: string,
  options: StickerImportOptions = {}
): Promise<{ suggestedRenderMode: StickerRenderMode }> {
  if (!SUPPORTED_STICKER_MIME_TYPES.has(mimeType)) {
    throw new StickerImportError('unsupported-format');
  }

  const fileInfo = await FileSystem.getInfoAsync(uri);
  if (!fileInfo.exists || fileInfo.isDirectory) {
    throw new StickerImportError('file-unavailable');
  }

  if (!mimeTypeSupportsTransparencyDetection(mimeType)) {
    if (options.requiresTransparency) {
      throw new StickerImportError('missing-transparency');
    }

    return {
      suggestedRenderMode: 'stamp',
    };
  }

  const bytes = await readStickerBytes(uri);

  if (!bytes) {
    throw new StickerImportError('file-unavailable');
  }

  const suggestedRenderMode = hasTransparency(bytes, mimeType) ? 'default' : 'stamp';

  if (options.requiresTransparency && suggestedRenderMode !== 'default') {
    throw new StickerImportError('missing-transparency');
  }

  return {
    suggestedRenderMode,
  };
}

async function uploadStickerBytesWithRetry(
  bucket: string,
  path: string,
  payload: ArrayBuffer,
  mimeType: string,
  allowOverwrite = true
) {
  for (let attempt = 0; attempt <= STICKER_UPLOAD_RETRY_DELAYS_MS.length; attempt += 1) {
    const { error } = await requireSupabase().storage.from(bucket).upload(path, payload, {
      contentType: mimeType,
      upsert: allowOverwrite,
    });

    if (!error) {
      return;
    }

    if (!isSupabaseNetworkError(error) || attempt === STICKER_UPLOAD_RETRY_DELAYS_MS.length) {
      throw new Error(getSupabaseErrorMessage(error));
    }

    await sleep(STICKER_UPLOAD_RETRY_DELAYS_MS[attempt] ?? 250);
  }
}

export function parseNoteStickerPlacements(
  placementsJson: string | null | undefined
): NoteStickerPlacement[] {
  if (!placementsJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(placementsJson);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((placement): placement is NoteStickerPlacement => {
      if (!placement || typeof placement !== 'object') {
        return false;
      }

      const maybePlacement = placement as Partial<NoteStickerPlacement>;
      return (
        typeof maybePlacement.id === 'string' &&
        typeof maybePlacement.assetId === 'string' &&
        typeof maybePlacement.x === 'number' &&
        typeof maybePlacement.y === 'number' &&
        typeof maybePlacement.scale === 'number' &&
        typeof maybePlacement.rotation === 'number' &&
        typeof maybePlacement.zIndex === 'number' &&
        typeof maybePlacement.opacity === 'number' &&
        (typeof maybePlacement.outlineEnabled === 'undefined' ||
          typeof maybePlacement.outlineEnabled === 'boolean') &&
        (typeof maybePlacement.motionLocked === 'undefined' ||
          typeof maybePlacement.motionLocked === 'boolean') &&
        (typeof maybePlacement.renderMode === 'undefined' ||
          maybePlacement.renderMode === 'default' ||
          maybePlacement.renderMode === 'stamp') &&
        Boolean(
          maybePlacement.asset &&
            typeof maybePlacement.asset === 'object' &&
            typeof maybePlacement.asset.id === 'string' &&
            typeof maybePlacement.asset.localUri === 'string' &&
            typeof maybePlacement.asset.mimeType === 'string'
        )
      );
    });
  } catch {
    return [];
  }
}

export function createStickerPlacement(
  asset: StickerAsset,
  existingPlacements: NoteStickerPlacement[] = [],
  options: CreateStickerPlacementOptions = {}
): NoteStickerPlacement {
  const nextZIndex = existingPlacements.reduce((maxValue, placement) => Math.max(maxValue, placement.zIndex), 0) + 1;
  const coordinates = getNextStickerPlacementCoordinates(existingPlacements);
  const {
    suggestedRenderMode,
    ...placementAsset
  } = asset;
  const renderMode = options.renderMode ?? (suggestedRenderMode === 'stamp' ? 'stamp' : 'default');

  return {
    id: generateStickerPlacementId(),
    assetId: placementAsset.id,
    x: coordinates.x,
    y: coordinates.y,
    scale: 1,
    rotation: 0,
    zIndex: nextZIndex,
    opacity: 1,
    outlineEnabled: true,
    motionLocked: false,
    renderMode,
    asset: placementAsset,
  };
}

export function normalizeStickerPlacements(
  placements: NoteStickerPlacement[]
): NoteStickerPlacement[] {
  return placements
    .slice()
    .sort((left, right) => left.zIndex - right.zIndex)
    .map((placement, index) => ({
      ...placement,
      zIndex: index + 1,
      x: clamp01(placement.x),
      y: clamp01(placement.y),
      scale: Math.max(0.2, Math.min(placement.scale, 3)),
      opacity: clamp01(placement.opacity),
      outlineEnabled: placement.outlineEnabled !== false,
      motionLocked: placement.motionLocked === true,
      renderMode: placement.renderMode === 'stamp' ? 'stamp' : 'default',
    }));
}

export function updateStickerPlacementTransform(
  placements: NoteStickerPlacement[],
  placementId: string,
  updates: Partial<Pick<NoteStickerPlacement, 'scale' | 'rotation' | 'opacity'>>
) {
  return normalizeStickerPlacements(
    placements.map((placement) =>
      placement.id === placementId
        ? {
            ...placement,
            ...updates,
          }
        : placement
    )
  );
}

export function setStickerPlacementOutlineEnabled(
  placements: NoteStickerPlacement[],
  placementId: string,
  outlineEnabled: boolean
) {
  return normalizeStickerPlacements(
    placements.map((placement) =>
      placement.id === placementId
        ? {
            ...placement,
            outlineEnabled,
          }
        : placement
    )
  );
}

export function setStickerPlacementsMotionLocked(
  placements: NoteStickerPlacement[],
  motionLocked: boolean
) {
  return normalizeStickerPlacements(
    placements.map((placement) => ({
      ...placement,
      motionLocked,
    }))
  );
}

export function setStickerPlacementMotionLocked(
  placements: NoteStickerPlacement[],
  placementId: string,
  motionLocked: boolean
) {
  return normalizeStickerPlacements(
    placements.map((placement) =>
      placement.id === placementId
        ? {
            ...placement,
            motionLocked,
          }
        : placement
    )
  );
}

export function setStickerPlacementRenderMode(
  placements: NoteStickerPlacement[],
  placementId: string,
  renderMode: StickerRenderMode
) {
  return normalizeStickerPlacements(
    placements.map((placement) =>
      placement.id === placementId
        ? {
            ...placement,
            renderMode,
          }
        : placement
    )
  );
}

export function bringStickerPlacementToFront(
  placements: NoteStickerPlacement[],
  placementId: string
) {
  const nextZIndex = placements.reduce((maxValue, placement) => Math.max(maxValue, placement.zIndex), 0) + 1;
  return normalizeStickerPlacements(
    placements.map((placement) =>
      placement.id === placementId
        ? {
            ...placement,
            zIndex: nextZIndex,
          }
        : placement
    )
  );
}

export function duplicateStickerPlacement(
  placements: NoteStickerPlacement[],
  placementId: string
) {
  const sourcePlacement = placements.find((placement) => placement.id === placementId);
  if (!sourcePlacement) {
    return normalizeStickerPlacements(placements);
  }

  return normalizeStickerPlacements([
    ...placements,
    {
      ...sourcePlacement,
      id: generateStickerPlacementId(),
      x: clamp01(sourcePlacement.x + 0.06),
      y: clamp01(sourcePlacement.y + 0.06),
      zIndex: placements.length + 1,
    },
  ]);
}

export async function getStickerAssets(): Promise<StickerAsset[]> {
  const database = await getDB();
  const ownerUid = getActiveNotesScope();
  const rows = await database.getAllAsync<StickerAssetRow>(
    `SELECT id, owner_uid, local_uri, remote_path, upload_fingerprint, content_hash, mime_type, width, height, created_at, updated_at, source
     FROM sticker_assets
     WHERE owner_uid = ?
     ORDER BY created_at DESC`,
    ownerUid
  );

  return rows.map(mapStickerAsset);
}

export async function getStickerAssetById(assetId: string): Promise<StickerAsset | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<StickerAssetRow>(
    `SELECT id, owner_uid, local_uri, remote_path, upload_fingerprint, content_hash, mime_type, width, height, created_at, updated_at, source
     FROM sticker_assets
     WHERE id = ?`,
    assetId
  );

  return row ? mapStickerAsset(row) : null;
}

export async function upsertStickerAsset(asset: StickerAsset, txn?: SQLiteTransactionExecutor) {
  const executor = txn ?? (await getDB());
  await executor.runAsync(
    `INSERT INTO sticker_assets (
      id,
      owner_uid,
      local_uri,
      remote_path,
      upload_fingerprint,
      content_hash,
      mime_type,
      width,
      height,
      created_at,
      updated_at,
      source
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      owner_uid = excluded.owner_uid,
      local_uri = excluded.local_uri,
      remote_path = excluded.remote_path,
      upload_fingerprint = excluded.upload_fingerprint,
      content_hash = excluded.content_hash,
      mime_type = excluded.mime_type,
      width = excluded.width,
      height = excluded.height,
      updated_at = excluded.updated_at,
      source = excluded.source`,
    asset.id,
    asset.ownerUid,
    asset.localUri,
    asset.remotePath ?? null,
    asset.uploadFingerprint ?? null,
    asset.contentHash ?? null,
    asset.mimeType,
    asset.width,
    asset.height,
    asset.createdAt,
    asset.updatedAt ?? null,
    asset.source
  );
}

export async function importStickerAsset(
  source: StickerImportSource,
  options: StickerImportOptions = {}
): Promise<StickerAsset> {
  const sourceUri = typeof source.uri === 'string' ? source.uri.trim() : '';
  if (!sourceUri) {
    throw new Error('Pick a sticker file to continue.');
  }

  const mimeType = normalizeMimeType(source.mimeType) || getMimeTypeFromName(source.name);
  const validation = await validateStickerFile(sourceUri, mimeType, options);
  const preparedSticker = await optimizeStickerForImport(sourceUri, mimeType);
  const ownerUid = getActiveNotesScope();

  try {
    const directory = await ensureStickerDirectory();
    if (!directory) {
      throw new Error('Sticker storage is unavailable on this device.');
    }

    const contentHash = await getStickerContentHash(preparedSticker.uri);
    if (contentHash) {
      const existingAsset = await getStickerAssetByContentHash(ownerUid, contentHash);
      if (existingAsset) {
        const existingInfo = await FileSystem.getInfoAsync(existingAsset.localUri).catch(() => null);
        if (existingInfo?.exists && !existingInfo.isDirectory) {
          return {
            ...existingAsset,
            suggestedRenderMode: validation.suggestedRenderMode,
          };
        }

        await FileSystem.copyAsync({ from: preparedSticker.uri, to: existingAsset.localUri });
        const nextAsset = {
          ...existingAsset,
          uploadFingerprint: await getStickerUploadFingerprint(existingAsset.localUri),
          contentHash,
          updatedAt: new Date().toISOString(),
        };

        await upsertStickerAsset(nextAsset);
        return {
          ...nextAsset,
          suggestedRenderMode: validation.suggestedRenderMode,
        };
      }
    }

    const assetId = generateStickerAssetId();
    const extension = getStickerFileExtension(preparedSticker.mimeType);
    const destinationPath = `${directory}${assetId}.${extension}`;

    await FileSystem.copyAsync({ from: preparedSticker.uri, to: destinationPath });

    const { width, height } = await getImageSize(destinationPath);
    const now = new Date().toISOString();
    const asset: StickerAsset = {
      id: assetId,
      ownerUid,
      localUri: destinationPath,
      remotePath: null,
      uploadFingerprint: await getStickerUploadFingerprint(destinationPath),
      contentHash,
      mimeType: preparedSticker.mimeType,
      width,
      height,
      createdAt: now,
      updatedAt: null,
      source: 'import',
      suggestedRenderMode: validation.suggestedRenderMode,
    };

    await upsertStickerAsset(asset);
    return asset;
  } finally {
    for (const cleanupUri of new Set(preparedSticker.cleanupUris)) {
      await FileSystem.deleteAsync(cleanupUri, { idempotent: true }).catch(() => undefined);
    }
  }
}

export async function getNoteStickers(noteId: string): Promise<NoteStickerRow | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<NoteStickerRow>(
    'SELECT note_id, placements_json, updated_at FROM note_stickers WHERE note_id = ?',
    noteId
  );

  return row ?? null;
}

export async function saveNoteStickers(noteId: string, placementsJson: string): Promise<void> {
  const database = await getDB();
  const updatedAt = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO note_stickers (note_id, placements_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(note_id) DO UPDATE SET
       placements_json = excluded.placements_json,
       updated_at = excluded.updated_at`,
    noteId,
    placementsJson,
    updatedAt
  );
}

export async function clearNoteStickers(noteId: string): Promise<void> {
  const database = await getDB();
  await database.runAsync('DELETE FROM note_stickers WHERE note_id = ?', noteId);
}

export async function uploadStickerAssetToStorage(
  bucket: string,
  ownerUid: string,
  asset: StickerAsset
): Promise<StickerAsset> {
  const localUri = typeof asset.localUri === 'string' ? asset.localUri.trim() : '';
  if (!localUri) {
    return asset;
  }

  const remotePath =
    asset.remotePath?.trim() || `${ownerUid}/${NOTE_STICKER_MEDIA_PREFIX}/${asset.id}.${getStickerFileExtension(asset.mimeType)}`;
  const uploadFingerprint = await getStickerUploadFingerprint(localUri);

  if (
    asset.remotePath === remotePath &&
    asset.contentHash &&
    asset.uploadFingerprint &&
    asset.uploadFingerprint === uploadFingerprint
  ) {
    return asset;
  }

  const bytes = await readStickerBytes(localUri);
  const contentHash = asset.contentHash ?? (bytes ? await hashStickerBytes(bytes) : null);

  if (asset.remotePath === remotePath && asset.contentHash && asset.contentHash === contentHash) {
    const nextAsset = {
      ...asset,
      uploadFingerprint,
      updatedAt: new Date().toISOString(),
    };

    await upsertStickerAsset(nextAsset);
    return nextAsset;
  }

  if (!bytes || !contentHash) {
    return asset;
  }

  await uploadStickerBytesWithRetry(
    bucket,
    remotePath,
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    asset.mimeType,
    true
  );
  const nextAsset = {
    ...asset,
    remotePath,
    uploadFingerprint,
    contentHash,
    updatedAt: new Date().toISOString(),
  };

  await upsertStickerAsset(nextAsset);
  return nextAsset;
}

export async function downloadStickerAssetFromStorage(
  bucket: string,
  path: string | null | undefined,
  assetId: string,
  mimeType: string,
  options: {
    preferCached?: boolean;
    sharedCache?: boolean;
  } = {}
) {
  const normalizedPath = typeof path === 'string' ? path.trim() : '';
  if (!normalizedPath) {
    return null;
  }

  const directory = options.sharedCache ? await ensureSharedStickerCacheDirectory() : await ensureStickerDirectory();
  if (!directory) {
    return null;
  }

  const extension = getStickerFileExtension(mimeType);
  const destinationPath = `${directory}${assetId}.${extension}`;
  if (options.preferCached !== false) {
    const cachedInfo = await FileSystem.getInfoAsync(destinationPath).catch(() => null);
    if (cachedInfo?.exists && !cachedInfo.isDirectory) {
      return destinationPath;
    }
  }

  const { data, error } = await requireSupabase().storage.from(bucket).createSignedUrl(normalizedPath, 60 * 5);
  if (error) {
    if (isSupabaseStorageObjectMissingError(error)) {
      return null;
    }
    throw error;
  }

  const result = await FileSystem.downloadAsync(data.signedUrl, destinationPath);
  return result.uri ?? destinationPath;
}

export async function hydrateStickerPlacements(
  placements: NoteStickerPlacement[],
  bucket: string,
  options: {
    sharedCache?: boolean;
  } = {}
) {
  return Promise.all(
    placements.map(async (placement) => {
      const localInfo = placement.asset.localUri
        ? await FileSystem.getInfoAsync(placement.asset.localUri).catch(() => null)
        : null;

      if (localInfo?.exists && !localInfo.isDirectory) {
        return placement;
      }

      if (!placement.asset.remotePath) {
        return placement;
      }

      try {
        const localUri = await downloadStickerAssetFromStorage(
          getStickerAssetStorageBucket(placement.asset, bucket),
          placement.asset.remotePath,
          placement.asset.id,
          placement.asset.mimeType,
          { sharedCache: options.sharedCache }
        );

        if (!localUri) {
          return placement;
        }

        return {
          ...placement,
          asset: {
            ...placement.asset,
            localUri,
          },
        };
      } catch {
        return placement;
      }
    })
  );
}

export async function serializeStickerPlacementsForStorage(
  placements: NoteStickerPlacement[],
  bucket: string,
  ownerUid: string,
  options: {
    persistAssets?: boolean;
    existingRemoteAssetPathsById?: Readonly<Record<string, string>>;
    serverOwnerUid?: string;
  } = {}
) {
  const assetsById = new Map<string, StickerAsset>();
  const existingRemoteAssetPathsById = options.existingRemoteAssetPathsById ?? {};
  const serverOwnerUid = typeof options.serverOwnerUid === 'string' ? options.serverOwnerUid.trim() : '';

  for (const placement of placements) {
    if (assetsById.has(placement.asset.id)) {
      continue;
    }

    const remoteServerAsset =
      serverOwnerUid || options.persistAssets !== false
        ? await registerRemoteStickerAsset(serverOwnerUid || ownerUid, placement.asset)
        : null;

    if (remoteServerAsset) {
      if (options.persistAssets !== false) {
        await upsertStickerAsset(remoteServerAsset);
      }
      assetsById.set(placement.asset.id, remoteServerAsset);
      continue;
    }

    if (options.persistAssets === false) {
      const remotePath =
        existingRemoteAssetPathsById[placement.asset.id] ??
        `${ownerUid}/${NOTE_STICKER_MEDIA_PREFIX}/${placement.asset.id}.${getStickerFileExtension(placement.asset.mimeType)}`;
      if (!existingRemoteAssetPathsById[placement.asset.id]) {
        const bytes = await readStickerBytes(placement.asset.localUri);
        if (!bytes) {
          continue;
        }
        await uploadStickerBytesWithRetry(
          bucket,
          remotePath,
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
          placement.asset.mimeType,
          true
        );
      }
      assetsById.set(placement.asset.id, {
        ...placement.asset,
        remotePath,
        storageBucket: bucket,
      });
      continue;
    }

    const uploadedAsset = await uploadStickerAssetToStorage(bucket, ownerUid, placement.asset);
    assetsById.set(placement.asset.id, {
      ...uploadedAsset,
      storageBucket: bucket,
    });
  }

  const serializedPlacements = placements
    .slice()
    .sort((left, right) => left.zIndex - right.zIndex)
    .map((placement, index) => {
      const asset = assetsById.get(placement.asset.id) ?? placement.asset;
      return {
        ...placement,
        x: clamp01(placement.x),
        y: clamp01(placement.y),
        scale: Math.max(0.2, Math.min(placement.scale, 3)),
        rotation: Number.isFinite(placement.rotation) ? placement.rotation : 0,
        zIndex: index + 1,
        opacity: clamp01(placement.opacity),
        asset,
      };
    });

  return JSON.stringify(serializedPlacements);
}

export async function reconcileRemoteStickerAssetRefs(
  ownerUserId: string,
  containerType: RemoteStickerContainerType,
  containerId: string,
  placementsJson: string | null | undefined
) {
  const normalizedOwnerUserId = typeof ownerUserId === 'string' ? ownerUserId.trim() : '';
  const normalizedContainerId = typeof containerId === 'string' ? containerId.trim() : '';
  if (!normalizedOwnerUserId || !normalizedContainerId) {
    return;
  }

  try {
    const nextAssetIds = getRemoteStickerAssetIdsFromPlacementsJson(placementsJson);
    const { data, error } = await requireSupabase()
      .from('sticker_asset_refs')
      .select('asset_id')
      .eq('owner_user_id', normalizedOwnerUserId)
      .eq('container_type', containerType)
      .eq('container_id', normalizedContainerId);

    if (error) {
      throw error;
    }

    const existingAssetIds = new Set(
      ((data ?? []) as RemoteStickerAssetRefRow[])
        .map((row) => (typeof row.asset_id === 'string' ? row.asset_id.trim() : ''))
        .filter(Boolean)
    );
    const nextAssetIdSet = new Set(nextAssetIds);
    const assetIdsToDelete = Array.from(existingAssetIds).filter((assetId) => !nextAssetIdSet.has(assetId));
    const assetIdsToInsert = nextAssetIds.filter((assetId) => !existingAssetIds.has(assetId));

    if (assetIdsToDelete.length > 0) {
      const { error: deleteError } = await requireSupabase()
        .from('sticker_asset_refs')
        .delete()
        .eq('owner_user_id', normalizedOwnerUserId)
        .eq('container_type', containerType)
        .eq('container_id', normalizedContainerId)
        .in('asset_id', assetIdsToDelete);

      if (deleteError) {
        throw deleteError;
      }
    }

    if (assetIdsToInsert.length > 0) {
      const { error: upsertError } = await requireSupabase().from('sticker_asset_refs').upsert(
        assetIdsToInsert.map((assetId) => ({
          asset_id: assetId,
          owner_user_id: normalizedOwnerUserId,
          container_type: containerType,
          container_id: normalizedContainerId,
        })),
        {
          onConflict: 'container_type,container_id,asset_id',
        }
      );

      if (upsertError) {
        throw upsertError;
      }
    }
  } catch (error) {
    if (isRemoteStickerRegistryUnavailableError(error)) {
      console.warn('[stickers] Remote sticker refs unavailable, skipping ref reconciliation:', error);
      return;
    }

    throw error;
  }
}

export async function clearRemoteStickerAssetRefs(
  ownerUserId: string,
  containerType: RemoteStickerContainerType,
  containerId: string
) {
  const normalizedOwnerUserId = typeof ownerUserId === 'string' ? ownerUserId.trim() : '';
  const normalizedContainerId = typeof containerId === 'string' ? containerId.trim() : '';
  if (!normalizedOwnerUserId || !normalizedContainerId) {
    return;
  }

  try {
    const { error } = await requireSupabase()
      .from('sticker_asset_refs')
      .delete()
      .eq('owner_user_id', normalizedOwnerUserId)
      .eq('container_type', containerType)
      .eq('container_id', normalizedContainerId);

    if (error) {
      throw error;
    }
  } catch (error) {
    if (isRemoteStickerRegistryUnavailableError(error)) {
      console.warn('[stickers] Remote sticker refs unavailable, skipping ref cleanup:', error);
      return;
    }

    throw error;
  }
}

export async function syncStickerAssetsFromPlacements(
  placements: NoteStickerPlacement[],
  txn?: SQLiteTransactionExecutor
) {
  const executor = txn ?? null;
  for (const placement of placements) {
    const now = new Date().toISOString();
    const asset: StickerAsset = {
      ...placement.asset,
      ownerUid: placement.asset.ownerUid || getActiveNotesScope(),
      updatedAt: placement.asset.updatedAt ?? now,
    };

    if (executor) {
      await upsertStickerAsset(asset, executor);
      continue;
    }

    await upsertStickerAsset(asset);
  }
}

export async function saveNoteStickerPlacementsWithAssets(
  noteId: string,
  placements: NoteStickerPlacement[]
) {
  if (placements.length === 0) {
    await clearNoteStickers(noteId);
    return;
  }

  await withDatabaseTransaction(async (txn) => {
    await syncStickerAssetsFromPlacements(placements, txn);
    await txn.runAsync(
      `INSERT INTO note_stickers (note_id, placements_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(note_id) DO UPDATE SET
         placements_json = excluded.placements_json,
         updated_at = excluded.updated_at`,
      noteId,
      JSON.stringify(placements),
      new Date().toISOString()
    );
  });
}

export async function cleanupUnusedSharedStickerCacheFiles(): Promise<number> {
  if (!SHARED_STICKER_CACHE_DIRECTORY) {
    return 0;
  }

  const directoryInfo = await FileSystem.getInfoAsync(SHARED_STICKER_CACHE_DIRECTORY);
  if (!directoryInfo.exists || !directoryInfo.isDirectory) {
    return 0;
  }

  const filenames = await FileSystem.readDirectoryAsync(SHARED_STICKER_CACHE_DIRECTORY);
  let deletedCount = 0;

  for (const filename of filenames) {
    const absolutePath = `${SHARED_STICKER_CACHE_DIRECTORY}${filename}`;
    try {
      await FileSystem.deleteAsync(absolutePath, { idempotent: true });
      deletedCount += 1;
    } catch (error) {
      console.warn('Failed deleting cached shared sticker:', absolutePath, error);
    }
  }

  return deletedCount;
}

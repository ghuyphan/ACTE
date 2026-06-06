import * as FileSystem from '../utils/fileSystem';
import { getActiveNotesScope, getDB, withDatabaseTransaction } from './database';
import {
  getStickerFileExtension,
  type StickerAsset,
} from './noteStickers';
import {
  getSupabaseErrorMessage,
  requireSupabase,
} from '../utils/supabase';

export const STICKER_PACK_MIN_ITEMS = 3;
export const STICKER_PACK_MAX_ITEMS = 30;
export const STICKER_PACK_NAME_MAX_LENGTH = 50;
export const STICKER_PACK_DESCRIPTION_MAX_LENGTH = 200;

export type StickerPackRevisionStatus = 'draft' | 'pending' | 'approved' | 'rejected';
export type StickerPackCatalogSort = 'newest' | 'downloads' | 'likes';

export interface StickerPackItem {
  asset: StickerAsset;
  position: number;
}

export interface StickerPackSummary {
  id: string;
  creatorUserId: string;
  creatorName: string;
  revisionId: string;
  name: string;
  description: string | null;
  status: StickerPackRevisionStatus;
  thumbnailAssetId: string;
  thumbnail: StickerAsset;
  stickerCount: number;
  revisionNumber: number;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  moderatorFeedback: string | null;
  installed: boolean;
  downloadCount: number;
  likeCount: number;
  liked: boolean;
}

export interface StickerPackDetail extends StickerPackSummary {
  items: StickerPackItem[];
}

export interface StickerPackDraftInput {
  packId?: string | null;
  revisionId?: string | null;
  name: string;
  description?: string | null;
  thumbnailAssetId: string;
  assetIds: string[];
}

export interface StickerPackValidationResult {
  valid: boolean;
  errors: string[];
}

interface RemoteStickerAssetRow {
  id: string;
  owner_user_id: string;
  mime_type: string;
  width: number;
  height: number;
  storage_bucket: string;
  storage_path: string;
  content_hash: string | null;
  created_at: string;
  last_seen_at: string | null;
}

interface RemotePackRow {
  id: string;
  creator_user_id: string;
  created_at: string;
  updated_at: string;
  current_approved_revision_id: string | null;
  unpublished_at: string | null;
  download_count: number;
  like_count: number;
}

interface RemoteRevisionRow {
  id: string;
  pack_id: string;
  revision_number: number;
  status: StickerPackRevisionStatus;
  name: string;
  description: string | null;
  thumbnail_asset_id: string;
  moderator_feedback: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  sticker_packs?: RemotePackRow | RemotePackRow[] | null;
}

interface RemoteItemRow {
  revision_id: string;
  asset_id: string;
  position: number;
  sticker_assets?: RemoteStickerAssetRow | RemoteStickerAssetRow[] | null;
}

interface LocalPackRow {
  pack_id: string;
  revision_id: string;
  creator_user_id: string;
  creator_name: string;
  name: string;
  description: string | null;
  thumbnail_asset_id: string;
  revision_number: number;
  installed_at: string;
  updated_at: string;
}

interface LocalPackItemRow {
  pack_id: string;
  revision_id: string;
  asset_id: string;
  position: number;
  owner_user_id: string;
  local_uri: string;
  remote_path: string;
  storage_bucket: string;
  mime_type: string;
  width: number;
  height: number;
  content_hash: string | null;
  created_at: string;
  updated_at: string | null;
}

const PACK_CACHE_DIRECTORY = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}sticker-packs/`
  : null;

let localSchemaReady = false;

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function normalizeText(value: string | null | undefined) {
  const normalized = value?.trim() ?? '';
  return normalized || null;
}

export function validateStickerPackDraft(
  input: Pick<StickerPackDraftInput, 'name' | 'description' | 'thumbnailAssetId' | 'assetIds'>
): StickerPackValidationResult {
  const errors: string[] = [];
  const name = input.name.trim();
  const description = input.description?.trim() ?? '';
  const assetIds = input.assetIds.map((id) => id.trim()).filter(Boolean);
  const uniqueIds = new Set(assetIds);

  if (!name) {
    errors.push('name-required');
  } else if (name.length > STICKER_PACK_NAME_MAX_LENGTH) {
    errors.push('name-too-long');
  }
  if (description.length > STICKER_PACK_DESCRIPTION_MAX_LENGTH) {
    errors.push('description-too-long');
  }
  if (assetIds.length < STICKER_PACK_MIN_ITEMS) {
    errors.push('too-few-items');
  }
  if (assetIds.length > STICKER_PACK_MAX_ITEMS) {
    errors.push('too-many-items');
  }
  if (uniqueIds.size !== assetIds.length) {
    errors.push('duplicate-items');
  }
  if (!input.thumbnailAssetId || !uniqueIds.has(input.thumbnailAssetId)) {
    errors.push('thumbnail-not-in-pack');
  }

  return { valid: errors.length === 0, errors };
}

export function orderStickerPackItems<T extends { position: number }>(items: readonly T[]) {
  return [...items].sort((left, right) => left.position - right.position);
}

async function ensureLocalSchema() {
  if (localSchemaReady) {
    return;
  }

  const database = await getDB();
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS sticker_pack_installs_cache (
      owner_uid TEXT NOT NULL,
      pack_id TEXT NOT NULL,
      revision_id TEXT NOT NULL,
      creator_user_id TEXT NOT NULL,
      creator_name TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      thumbnail_asset_id TEXT NOT NULL,
      revision_number INTEGER NOT NULL,
      installed_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(owner_uid, pack_id)
    );
    CREATE TABLE IF NOT EXISTS sticker_pack_items_cache (
      owner_uid TEXT NOT NULL,
      pack_id TEXT NOT NULL,
      revision_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      owner_user_id TEXT NOT NULL,
      local_uri TEXT NOT NULL,
      remote_path TEXT NOT NULL,
      storage_bucket TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      width REAL NOT NULL,
      height REAL NOT NULL,
      content_hash TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      PRIMARY KEY(owner_uid, pack_id, asset_id)
    );
    CREATE INDEX IF NOT EXISTS idx_sticker_pack_items_cache_pack
      ON sticker_pack_items_cache(owner_uid, pack_id, position);
  `);
  localSchemaReady = true;
}

function mapRemoteAsset(row: RemoteStickerAssetRow, localUri = ''): StickerAsset {
  return {
    id: row.id,
    ownerUid: row.owner_user_id,
    localUri,
    remotePath: row.storage_path,
    contentHash: row.content_hash,
    remoteAssetId: row.id,
    storageBucket: row.storage_bucket,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
    updatedAt: row.last_seen_at,
    source: 'import',
    suggestedRenderMode: 'default',
  };
}

function mapLocalAsset(row: LocalPackItemRow): StickerAsset {
  return {
    id: row.asset_id,
    ownerUid: row.owner_user_id,
    localUri: row.local_uri,
    remotePath: row.remote_path,
    contentHash: row.content_hash,
    remoteAssetId: row.asset_id,
    storageBucket: row.storage_bucket,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    source: 'import',
    suggestedRenderMode: 'default',
  };
}

async function getCreatorNames(userIds: readonly string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await requireSupabase()
    .from('user_profiles')
    .select('id, display_name, username')
    .in('id', uniqueIds);
  if (error) {
    throw error;
  }

  return new Map(
    (data ?? []).map((row) => [
      row.id,
      normalizeText(row.display_name) ?? normalizeText(row.username) ?? 'Noto creator',
    ])
  );
}

async function getInstalledPackIds() {
  const { data, error } = await requireSupabase()
    .from('sticker_pack_installs')
    .select('pack_id');
  if (error) {
    throw error;
  }
  return new Set((data ?? []).map((row) => row.pack_id));
}

async function getLikedPackIds() {
  const { data, error } = await requireSupabase()
    .from('sticker_pack_likes')
    .select('pack_id');
  if (error) {
    throw error;
  }
  return new Set((data ?? []).map((row) => row.pack_id));
}

async function fetchRevisionItems(revisionIds: readonly string[]) {
  if (revisionIds.length === 0) {
    return new Map<string, RemoteItemRow[]>();
  }
  const { data, error } = await requireSupabase()
    .from('sticker_pack_items')
    .select(
      'revision_id, asset_id, position, sticker_assets(id, owner_user_id, mime_type, width, height, storage_bucket, storage_path, content_hash, created_at, last_seen_at)'
    )
    .in('revision_id', revisionIds)
    .order('position', { ascending: true });
  if (error) {
    throw error;
  }

  const grouped = new Map<string, RemoteItemRow[]>();
  for (const row of (data ?? []) as RemoteItemRow[]) {
    const items = grouped.get(row.revision_id) ?? [];
    items.push(row);
    grouped.set(row.revision_id, items);
  }
  return grouped;
}

async function mapRevisionRows(
  rows: RemoteRevisionRow[],
  installedIds = new Set<string>(),
  likedIds = new Set<string>(),
  hydrateAllPreviews = true
): Promise<StickerPackDetail[]> {
  const itemsByRevision = await fetchRevisionItems(rows.map((row) => row.id));
  const packs = rows
    .map((row) => ({ row, pack: firstRelation(row.sticker_packs) }))
    .filter((entry): entry is { row: RemoteRevisionRow; pack: RemotePackRow } => Boolean(entry.pack));
  const creatorNames = await getCreatorNames(packs.map(({ pack }) => pack.creator_user_id));

  const details = packs.flatMap(({ row, pack }) => {
    const remoteItems = orderStickerPackItems(itemsByRevision.get(row.id) ?? []);
    const items = remoteItems.flatMap((item) => {
      const asset = firstRelation(item.sticker_assets);
      return asset ? [{ position: item.position, asset: mapRemoteAsset(asset) }] : [];
    });
    const thumbnail = items.find((item) => item.asset.id === row.thumbnail_asset_id)?.asset;
    if (!thumbnail) {
      return [];
    }

    return [{
      id: pack.id,
      creatorUserId: pack.creator_user_id,
      creatorName: creatorNames.get(pack.creator_user_id) ?? 'Noto creator',
      revisionId: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      thumbnailAssetId: row.thumbnail_asset_id,
      thumbnail,
      stickerCount: items.length,
      revisionNumber: row.revision_number,
      submittedAt: row.submitted_at,
      createdAt: pack.created_at,
      updatedAt: row.updated_at,
      moderatorFeedback: row.moderator_feedback,
      installed: installedIds.has(pack.id),
      downloadCount: pack.download_count ?? 0,
      likeCount: pack.like_count ?? 0,
      liked: likedIds.has(pack.id),
      items,
    }];
  });

  await Promise.all(
    details.flatMap((detail) =>
      detail.items
        .filter((item) => hydrateAllPreviews || item.asset.id === detail.thumbnailAssetId)
        .map(async (item) => {
          if (!item.asset.storageBucket || !item.asset.remotePath) {
            return;
          }
          const { data, error } = await requireSupabase()
            .storage
            .from(item.asset.storageBucket)
            .createSignedUrl(item.asset.remotePath, 60 * 60);
          if (!error) {
            item.asset.localUri = data.signedUrl;
          }
        })
    )
  );

  return details;
}

const REVISION_SELECT =
  'id, pack_id, revision_number, status, name, description, thumbnail_asset_id, moderator_feedback, submitted_at, created_at, updated_at, sticker_packs:sticker_packs!sticker_pack_revisions_pack_id_fkey!inner(id, creator_user_id, created_at, updated_at, current_approved_revision_id, unpublished_at, download_count, like_count)';

export async function listStickerPackCatalog(
  sort: StickerPackCatalogSort = 'newest'
): Promise<StickerPackSummary[]> {
  const [installedIds, likedIds] = await Promise.all([
    getInstalledPackIds(),
    getLikedPackIds(),
  ]);
  let query = requireSupabase()
    .from('sticker_pack_revisions')
    .select(REVISION_SELECT)
    .eq('status', 'approved')
    .is('sticker_packs.unpublished_at', null);
  query =
    sort === 'downloads'
      ? query.order('download_count', {
          ascending: false,
          referencedTable: 'sticker_packs',
        })
      : sort === 'likes'
        ? query.order('like_count', {
            ascending: false,
            referencedTable: 'sticker_packs',
          })
        : query.order('updated_at', { ascending: false });
  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const details = await mapRevisionRows(
    (data ?? []) as unknown as RemoteRevisionRow[],
    installedIds,
    likedIds,
    false
  );
  return details.filter((detail) => {
    const pack = firstRelation(
      ((data ?? []) as unknown as RemoteRevisionRow[]).find((row) => row.id === detail.revisionId)
        ?.sticker_packs
    );
    return pack?.current_approved_revision_id === detail.revisionId;
  });
}

export async function getStickerPackDetail(packId: string): Promise<StickerPackDetail | null> {
  const [installedIds, likedIds] = await Promise.all([
    getInstalledPackIds(),
    getLikedPackIds(),
  ]);
  const { data: pack, error: packError } = await requireSupabase()
    .from('sticker_packs')
    .select('current_approved_revision_id')
    .eq('id', packId)
    .is('unpublished_at', null)
    .maybeSingle();
  if (packError) {
    throw packError;
  }
  if (!pack?.current_approved_revision_id) {
    return null;
  }

  const { data, error } = await requireSupabase()
    .from('sticker_pack_revisions')
    .select(REVISION_SELECT)
    .eq('id', pack.current_approved_revision_id)
    .maybeSingle();
  if (error) {
    throw error;
  }
  const details = data
    ? await mapRevisionRows([data as unknown as RemoteRevisionRow], installedIds, likedIds)
    : [];
  return details[0] ?? null;
}

export async function listMyStickerPacks(): Promise<StickerPackDetail[]> {
  const { data, error } = await requireSupabase()
    .from('sticker_pack_revisions')
    .select(REVISION_SELECT)
    .order('updated_at', { ascending: false });
  if (error) {
    throw error;
  }
  return mapRevisionRows((data ?? []) as unknown as RemoteRevisionRow[]);
}

export async function listModerationQueue(): Promise<StickerPackDetail[]> {
  const { data, error } = await requireSupabase()
    .from('sticker_pack_revisions')
    .select(REVISION_SELECT)
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true });
  if (error) {
    throw error;
  }
  return mapRevisionRows((data ?? []) as unknown as RemoteRevisionRow[]);
}

export async function isStickerPackModerator() {
  const { data, error } = await requireSupabase().rpc('is_sticker_pack_moderator');
  if (error) {
    throw error;
  }
  return data === true;
}

export async function saveStickerPackDraft(input: StickerPackDraftInput) {
  const validation = validateStickerPackDraft(input);
  if (!validation.valid) {
    throw new Error(`Invalid sticker pack: ${validation.errors.join(', ')}`);
  }
  const { data, error } = await requireSupabase().rpc('save_sticker_pack_draft', {
    target_pack_id: input.packId ?? null,
    target_revision_id: input.revisionId ?? null,
    pack_name: input.name.trim(),
    pack_description: normalizeText(input.description),
    thumbnail_asset_id_input: input.thumbnailAssetId,
    ordered_asset_ids: input.assetIds,
  });
  if (error) {
    throw error;
  }
  return data as { pack_id: string; revision_id: string };
}

export async function submitStickerPackRevision(revisionId: string) {
  const { error } = await requireSupabase().rpc('submit_sticker_pack_revision', {
    target_revision_id: revisionId,
  });
  if (error) {
    throw error;
  }
}

export async function approveStickerPackRevision(revisionId: string) {
  const { error } = await requireSupabase().rpc('approve_sticker_pack_revision', {
    target_revision_id: revisionId,
  });
  if (error) {
    throw error;
  }
}

export async function rejectStickerPackRevision(revisionId: string, feedback: string) {
  const { error } = await requireSupabase().rpc('reject_sticker_pack_revision', {
    target_revision_id: revisionId,
    feedback_input: feedback.trim(),
  });
  if (error) {
    throw error;
  }
}

export async function unpublishStickerPack(packId: string) {
  const { error } = await requireSupabase().rpc('unpublish_sticker_pack', {
    target_pack_id: packId,
  });
  if (error) {
    throw error;
  }
}

export async function setStickerPackLiked(packId: string, liked: boolean) {
  const { data, error } = await requireSupabase().rpc('set_sticker_pack_liked', {
    target_pack_id: packId,
    liked_input: liked,
  });
  if (error) {
    throw error;
  }
  return data as { liked: boolean; like_count: number };
}

async function ensurePackCacheDirectory(packId: string, revisionId: string) {
  if (!PACK_CACHE_DIRECTORY) {
    throw new Error('Sticker pack downloads are unavailable on this platform.');
  }
  const directory = `${PACK_CACHE_DIRECTORY}${packId}/${revisionId}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  return directory;
}

async function downloadPackItem(packId: string, revisionId: string, item: StickerPackItem) {
  const directory = await ensurePackCacheDirectory(packId, revisionId);
  const destination = `${directory}${item.asset.id}.${getStickerFileExtension(item.asset.mimeType)}`;
  const existing = await FileSystem.getInfoAsync(destination).catch(() => null);
  if (existing?.exists && !existing.isDirectory) {
    return destination;
  }

  const bucket = item.asset.storageBucket;
  const path = item.asset.remotePath;
  if (!bucket || !path) {
    throw new Error('This sticker asset is missing its download location.');
  }
  const { data, error } = await requireSupabase().storage.from(bucket).createSignedUrl(path, 300);
  if (error) {
    throw error;
  }
  const result = await FileSystem.downloadAsync(data.signedUrl, destination);
  return result.uri;
}

async function cacheInstalledPack(detail: StickerPackDetail) {
  const ownerUid = getActiveNotesScope();
  const downloaded = await Promise.all(
    detail.items.map(async (item) => ({
      ...item,
      localUri: await downloadPackItem(detail.id, detail.revisionId, item),
    }))
  );
  const now = new Date().toISOString();

  await withDatabaseTransaction(async (transaction) => {
    await transaction.runAsync(
      'DELETE FROM sticker_pack_items_cache WHERE owner_uid = ? AND pack_id = ?',
      ownerUid,
      detail.id
    );
    await transaction.runAsync(
      `INSERT INTO sticker_pack_installs_cache (
        owner_uid, pack_id, revision_id, creator_user_id, creator_name, name, description,
        thumbnail_asset_id, revision_number, installed_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner_uid, pack_id) DO UPDATE SET
        revision_id = excluded.revision_id,
        creator_user_id = excluded.creator_user_id,
        creator_name = excluded.creator_name,
        name = excluded.name,
        description = excluded.description,
        thumbnail_asset_id = excluded.thumbnail_asset_id,
        revision_number = excluded.revision_number,
        updated_at = excluded.updated_at`,
      ownerUid,
      detail.id,
      detail.revisionId,
      detail.creatorUserId,
      detail.creatorName,
      detail.name,
      detail.description,
      detail.thumbnailAssetId,
      detail.revisionNumber,
      now,
      now
    );

    for (const item of downloaded) {
      await transaction.runAsync(
        `INSERT INTO sticker_pack_items_cache (
          owner_uid, pack_id, revision_id, asset_id, position, owner_user_id, local_uri,
          remote_path, storage_bucket, mime_type, width, height, content_hash, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ownerUid,
        detail.id,
        detail.revisionId,
        item.asset.id,
        item.position,
        item.asset.ownerUid,
        item.localUri,
        item.asset.remotePath ?? '',
        item.asset.storageBucket ?? '',
        item.asset.mimeType,
        item.asset.width,
        item.asset.height,
        item.asset.contentHash ?? null,
        item.asset.createdAt,
        item.asset.updatedAt
      );
    }
  });
}

async function isLocalUriReferencedByNote(localUri: string) {
  const database = await getDB();
  const row = await database.getFirstAsync<{ referenced: number }>(
    `SELECT EXISTS(
      SELECT 1
      FROM note_stickers
      WHERE instr(placements_json, ?) > 0
    ) AS referenced`,
    localUri
  );
  return row?.referenced === 1;
}

export function findUnreferencedStickerPackUris(
  localUris: readonly string[],
  placementPayloads: readonly string[]
) {
  return localUris.filter(
    (localUri) => !placementPayloads.some((payload) => payload.includes(localUri))
  );
}

async function deleteUnreferencedFiles(rows: readonly LocalPackItemRow[]) {
  for (const row of rows) {
    if (!(await isLocalUriReferencedByNote(row.local_uri))) {
      await FileSystem.deleteAsync(row.local_uri, { idempotent: true }).catch(() => undefined);
    }
  }
}

export async function installStickerPack(packId: string) {
  await ensureLocalSchema();
  const { error } = await requireSupabase().rpc('install_sticker_pack', {
    target_pack_id: packId,
  });
  if (error) {
    throw error;
  }

  try {
    const detail = await getStickerPackDetail(packId);
    if (!detail) {
      throw new Error('This sticker pack is no longer available.');
    }
    await cacheInstalledPack({ ...detail, installed: true });
  } catch (error) {
    try {
      await requireSupabase().rpc('remove_sticker_pack', { target_pack_id: packId });
    } catch {
      // The server install is best-effort rolled back after a failed local cache write.
    }
    throw error;
  }
}

export async function removeStickerPack(packId: string) {
  await ensureLocalSchema();
  const ownerUid = getActiveNotesScope();
  const database = await getDB();
  const rows = await database.getAllAsync<LocalPackItemRow>(
    'SELECT * FROM sticker_pack_items_cache WHERE owner_uid = ? AND pack_id = ?',
    ownerUid,
    packId
  );
  const { error } = await requireSupabase().rpc('remove_sticker_pack', {
    target_pack_id: packId,
  });
  if (error) {
    throw error;
  }

  await withDatabaseTransaction(async (transaction) => {
    await transaction.runAsync(
      'DELETE FROM sticker_pack_items_cache WHERE owner_uid = ? AND pack_id = ?',
      ownerUid,
      packId
    );
    await transaction.runAsync(
      'DELETE FROM sticker_pack_installs_cache WHERE owner_uid = ? AND pack_id = ?',
      ownerUid,
      packId
    );
  });
  await deleteUnreferencedFiles(rows);
}

export async function getInstalledStickerPacks(): Promise<StickerPackDetail[]> {
  await ensureLocalSchema();
  const ownerUid = getActiveNotesScope();
  const database = await getDB();
  const packs = await database.getAllAsync<LocalPackRow>(
    `SELECT pack_id, revision_id, creator_user_id, creator_name, name, description,
            thumbnail_asset_id, revision_number, installed_at, updated_at
       FROM sticker_pack_installs_cache
      WHERE owner_uid = ?
      ORDER BY installed_at DESC`,
    ownerUid
  );
  const items = await database.getAllAsync<LocalPackItemRow>(
    `SELECT pack_id, revision_id, asset_id, position, owner_user_id, local_uri, remote_path,
            storage_bucket, mime_type, width, height, content_hash, created_at, updated_at
       FROM sticker_pack_items_cache
      WHERE owner_uid = ?
      ORDER BY pack_id, position`,
    ownerUid
  );
  const byPack = new Map<string, LocalPackItemRow[]>();
  for (const item of items) {
    const packItems = byPack.get(item.pack_id) ?? [];
    packItems.push(item);
    byPack.set(item.pack_id, packItems);
  }

  return packs.flatMap((pack) => {
    const packItems = orderStickerPackItems(byPack.get(pack.pack_id) ?? []).map((row) => ({
      position: row.position,
      asset: mapLocalAsset(row),
    }));
    const thumbnail = packItems.find((item) => item.asset.id === pack.thumbnail_asset_id)?.asset;
    if (!thumbnail) {
      return [];
    }
    return [{
      id: pack.pack_id,
      creatorUserId: pack.creator_user_id,
      creatorName: pack.creator_name,
      revisionId: pack.revision_id,
      name: pack.name,
      description: pack.description,
      status: 'approved' as const,
      thumbnailAssetId: pack.thumbnail_asset_id,
      thumbnail,
      stickerCount: packItems.length,
      revisionNumber: pack.revision_number,
      submittedAt: null,
      createdAt: pack.installed_at,
      updatedAt: pack.updated_at,
      moderatorFeedback: null,
      installed: true,
      downloadCount: 0,
      likeCount: 0,
      liked: false,
      items: packItems,
    }];
  });
}

export async function refreshInstalledStickerPacks() {
  await ensureLocalSchema();
  const localPacks = await getInstalledStickerPacks();
  const { data, error } = await requireSupabase()
    .from('sticker_pack_installs')
    .select('pack_id');
  if (error) {
    throw error;
  }
  const remoteIds = new Set((data ?? []).map((row) => row.pack_id));
  const localIds = new Set(localPacks.map((pack) => pack.id));

  for (const localPack of localPacks) {
    if (!remoteIds.has(localPack.id)) {
      const ownerUid = getActiveNotesScope();
      const database = await getDB();
      const rows = await database.getAllAsync<LocalPackItemRow>(
        'SELECT * FROM sticker_pack_items_cache WHERE owner_uid = ? AND pack_id = ?',
        ownerUid,
        localPack.id
      );
      await withDatabaseTransaction(async (transaction) => {
        await transaction.runAsync(
          'DELETE FROM sticker_pack_items_cache WHERE owner_uid = ? AND pack_id = ?',
          ownerUid,
          localPack.id
        );
        await transaction.runAsync(
          'DELETE FROM sticker_pack_installs_cache WHERE owner_uid = ? AND pack_id = ?',
          ownerUid,
          localPack.id
        );
      });
      await deleteUnreferencedFiles(rows);
      continue;
    }

    const detail = await getStickerPackDetail(localPack.id);
    if (!detail) {
      continue;
    }
    if (detail.revisionId !== localPack.revisionId) {
      const oldRows = localPack.items.map((item) => ({
        pack_id: localPack.id,
        revision_id: localPack.revisionId,
        asset_id: item.asset.id,
        position: item.position,
        owner_user_id: item.asset.ownerUid,
        local_uri: item.asset.localUri,
        remote_path: item.asset.remotePath ?? '',
        storage_bucket: item.asset.storageBucket ?? '',
        mime_type: item.asset.mimeType,
        width: item.asset.width,
        height: item.asset.height,
        content_hash: item.asset.contentHash ?? null,
        created_at: item.asset.createdAt,
        updated_at: item.asset.updatedAt,
      }));
      await cacheInstalledPack({ ...detail, installed: true });
      await deleteUnreferencedFiles(oldRows);
    }
  }

  for (const remotePackId of remoteIds) {
    if (localIds.has(remotePackId)) {
      continue;
    }
    const detail = await getStickerPackDetail(remotePackId);
    if (detail) {
      await cacheInstalledPack({ ...detail, installed: true });
    }
  }
}

export function getStickerPackErrorMessage(error: unknown) {
  return getSupabaseErrorMessage(error) || 'Sticker packs are unavailable right now.';
}

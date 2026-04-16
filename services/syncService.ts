import {
  countPhotoNotes,
  countPhotoNotesCreatedToday,
  getLocalPhotoUsageDateKey,
} from '../constants/subscription';
import i18n from '../constants/i18n';
import { getPersistentItem, setPersistentItem } from '../utils/appStorage';
import { AppUser } from '../utils/appUser';
import {
  getCurrentSupabaseSession,
  getSupabase,
  getSupabaseErrorMessage,
  isSupabaseNetworkError,
  isSupabasePolicyError,
  isSupabaseSchemaMismatchError,
  isSupabaseStorageObjectMissingError,
} from '../utils/supabase';
import {
  deleteNoteForScope,
  getActiveNotesScope,
  Note,
  getAllNotesForScope,
  getDB,
  getNoteByIdForScope,
  upsertNoteForScope,
} from './database';
import {
  clearRemoteStickerAssetRefs,
  hydrateStickerPlacements,
  parseNoteStickerPlacements,
  reconcileRemoteStickerAssetRefs,
  serializeStickerPlacementsForStorage,
  syncStickerAssetsFromPlacements,
} from './noteStickers';
import {
  deletePairedVideoFromStorage,
  deletePhotoFromStorage,
  downloadPhotoFromStorage,
  downloadPairedVideoFromStorage,
  NOTE_MEDIA_BUCKET,
  SHARED_POST_MEDIA_BUCKET,
  uploadPhotoToStorage,
  uploadPairedVideoToStorage,
} from './remoteMedia';
import { upsertPublicUserProfile } from './publicProfileService';
import {
  buildNewRemoteArtifacts,
  buildRemovedRemoteArtifacts,
  getRemotePairedVideoPath,
  getRemoteStickerAssetPaths,
  normalizeRemoteArtifactPath,
  normalizeRemoteEntityIds,
} from './remoteArtifactUtils';

export type SyncChangeType = 'create' | 'update' | 'delete' | 'deleteAll';
export type SyncQueueStatus = 'pending' | 'processing' | 'failed';
export type SyncMode = 'incremental' | 'full';

export interface SyncChange {
  type: SyncChangeType;
  entity: 'note';
  entityId?: string;
  payload?: unknown;
  timestamp: string;
  ownerScope?: string;
}

export interface SyncQueueItem {
  id: number;
  entity: 'note';
  entityId: string | null;
  operation: SyncChangeType;
  payload: string | null;
  status: SyncQueueStatus;
  attempts: number;
  lastError: string | null;
  nextRetryAt: string | null;
  terminal: boolean;
  blockedReason: string | null;
  createdAt: string;
}

export interface SyncRepository {
  enqueue: (change: SyncChange) => Promise<void>;
  listPending: (limit?: number) => Promise<SyncQueueItem[]>;
  listRecent: (limit?: number) => Promise<SyncQueueItem[]>;
  peekStats: () => Promise<{
    pendingCount: number;
    failedCount: number;
    blockedCount: number;
  }>;
  getStats: () => Promise<{
    pendingCount: number;
    failedCount: number;
    blockedCount: number;
  }>;
  recoverProcessing: () => Promise<void>;
  recoverBlockedSessionErrors: () => Promise<number>;
  markProcessing: (id: number, leaseToken: string) => Promise<boolean>;
  hasLease: (id: number, leaseToken: string) => Promise<boolean>;
  markFailed: (
    id: number,
    leaseToken: string,
    details?:
      | string
      | {
          error?: string;
          nextRetryAt?: string | null;
          terminal?: boolean;
          blockedReason?: string | null;
        }
  ) => Promise<void>;
  markDone: (id: number, leaseToken: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

function normalizeMediaUri(value: string | null | undefined) {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  return normalizedValue || null;
}

export interface SyncService {
  isAvailable: boolean;
  recordChange: (change: SyncChange) => Promise<void>;
}

export interface SyncUser extends Pick<AppUser, 'uid' | 'displayName' | 'username' | 'email' | 'photoURL'> {
  id?: string;
}

export interface SyncResult {
  status: 'success' | 'unavailable' | 'error';
  message?: string;
  syncedCount?: number;
  uploadedCount?: number;
  importedCount?: number;
  failedCount?: number;
  bootstrapCompleted?: boolean;
}

export interface SyncOptions {
  mode?: SyncMode;
}

interface NoteRow {
  id: string;
  user_id: string;
  type: Note['type'];
  content: string;
  photo_path: string | null;
  is_live_photo: boolean;
  paired_video_path: string | null;
  has_doodle: boolean;
  doodle_strokes_json: string | null;
  has_stickers: boolean;
  sticker_placements_json: string | null;
  location_name: string | null;
  prompt_id: string | null;
  prompt_text_snapshot: string | null;
  prompt_answer: string | null;
  mood_emoji: string | null;
  note_color: string | null;
  latitude: number;
  longitude: number;
  radius: number;
  is_favorite: boolean;
  created_at: string;
  updated_at: string | null;
  synced_at: string;
}

interface NoteTombstoneRow {
  note_id: string;
  user_id: string;
  deleted_at: string;
}

interface QueueFlushFailure {
  itemId: number;
  error: string;
  blockedReason: string | null;
  terminal: boolean;
}

interface FlushQueueResult {
  processedCount: number;
  failedCount: number;
  lastError: string | null;
  lastBlockedReason: string | null;
  hadLocalWrites: boolean;
}

interface RemoteNoteCursor {
  syncedAt: string;
  id: string;
}

interface RemoteTombstoneCursor {
  deletedAt: string;
  noteId: string;
}

interface RemoteSyncCursor {
  notes: RemoteNoteCursor | null;
  tombstones: RemoteTombstoneCursor | null;
}

interface RemoteMergeResult {
  importedCount: number;
  noteCursor: RemoteNoteCursor | null;
  cursorBlocked: boolean;
  scanCompleted: boolean;
  remoteNoteIds: Set<string>;
  remoteNoteSyncMarks: Map<string, string>;
}

interface RemoteTombstoneMergeResult {
  deletedCount: number;
  tombstoneCursor: RemoteTombstoneCursor | null;
}

interface QueueRow {
  id: number;
  owner_uid?: string;
  entity: 'note';
  entity_id: string | null;
  coalesce_key?: string | null;
  operation: SyncChangeType;
  payload: string | null;
  status: SyncQueueStatus;
  attempts: number;
  last_error: string | null;
  next_retry_at: string | null;
  terminal: number;
  blocked_reason: string | null;
  lease_token?: string | null;
  created_at: string;
}

interface SyncStateRow {
  owner_uid: string;
  user_uid: string | null;
  initial_sync_status: string;
  last_note_cursor_json: string | null;
  last_tombstone_cursor_json: string | null;
  last_sync_started_at: string | null;
  last_sync_finished_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  updated_at: string;
}

interface RemoteArtifactSnapshot {
  photoPath?: string | null;
  pairedVideoPath?: string | null;
  stickerPlacementsJson?: string | null;
}

const MAX_SYNC_ATTEMPTS = 5;
const REMOTE_SYNC_PAGE_SIZE = 200;
const REMOTE_ARTIFACT_FETCH_BATCH_SIZE = 200;
const FULL_SNAPSHOT_UPLOAD_CONCURRENCY = 3;
const QUEUE_FLUSH_BATCH_SIZE = 5000;
const RETRY_DELAYS_MS = [
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
];
const REMOTE_SYNC_CURSOR_KEY_PREFIX = 'sync.lastRemoteCursor.';
const REMOTE_SYNCED_NOTE_IDS_KEY_PREFIX = 'sync.syncedNoteIds.';
const INITIAL_SYNC_PENDING_KEY_PREFIX = 'settings.initialSyncPending.';
const EXPIRED_SESSION_SYNC_ERROR = 'Server session unavailable. Sign in again to resume sync.';
const MISMATCHED_SESSION_SYNC_ERROR =
  'Signed-in session does not match this account. Sign out and sign in again.';
type InFlightSyncRun = {
  promise: Promise<SyncResult>;
  requestedMode: SyncMode;
  currentMode: SyncMode;
  queuedMode: SyncMode | null;
};

const syncRunsInFlight = new Map<string, InFlightSyncRun>();

function rowToQueueItem(row: QueueRow): SyncQueueItem {
  return {
    id: row.id,
    entity: row.entity,
    entityId: row.entity_id,
    operation: row.operation,
    payload: row.payload,
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error,
    nextRetryAt: row.next_retry_at,
    terminal: row.terminal === 1,
    blockedReason: row.blocked_reason,
    createdAt: row.created_at,
  };
}

async function readQueueStats(scope: string) {
  const db = await getDB();
  const row = await db.getFirstAsync<{
    pending_count: number | null;
    failed_count: number | null;
    blocked_count: number | null;
  }>(
    `SELECT
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
       SUM(CASE WHEN status = 'failed' AND terminal = 0 THEN 1 ELSE 0 END) AS failed_count,
       SUM(CASE WHEN terminal = 1 THEN 1 ELSE 0 END) AS blocked_count
     FROM sync_queue
     WHERE owner_uid = ?`,
    scope
  );

  return {
    pendingCount: row?.pending_count ?? 0,
    failedCount: row?.failed_count ?? 0,
    blockedCount: row?.blocked_count ?? 0,
  };
}

function getSyncTimestamp(note: Pick<Note, 'createdAt' | 'updatedAt'> | NoteRow) {
  return new Date(('updatedAt' in note ? note.updatedAt : note.updated_at) ?? ('createdAt' in note ? note.createdAt : note.created_at)).getTime();
}

function getErrorMessage(error: unknown) {
  return getSupabaseErrorMessage(error);
}

function isSessionSyncError(error: unknown) {
  const message = getErrorMessage(error);
  return message === EXPIRED_SESSION_SYNC_ERROR || message === MISMATCHED_SESSION_SYNC_ERROR;
}

function isRecoverableSessionSyncErrorMessage(message: string | null | undefined) {
  const normalizedMessage = message?.trim() ?? '';
  return (
    normalizedMessage === EXPIRED_SESSION_SYNC_ERROR ||
    normalizedMessage === MISMATCHED_SESSION_SYNC_ERROR
  );
}

function isTerminalSyncError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('too large to sync safely') ||
    isSessionSyncError(error) ||
    isSupabasePolicyError(error) ||
    isSupabaseSchemaMismatchError(error)
  );
}

function getBlockedSyncReason(error: unknown) {
  if (isSessionSyncError(error)) {
    return i18n.t(
      'settings.syncSessionExpiredMsg',
      'Your sign-in session expired. Sign out and sign back in to resume sync.'
    );
  }

  if (isSupabasePolicyError(error)) {
    return i18n.t(
      'settings.syncPolicyDeniedMsg',
      'The server denied access to sync your notes. Sign in again and try once more.'
    );
  }

  if (isSupabaseSchemaMismatchError(error)) {
    return i18n.t(
      'settings.syncSchemaOutdatedMsg',
      'Cloud sync needs the latest server migrations. Apply the latest Supabase migrations, then try again.'
    );
  }

  if (getErrorMessage(error).toLowerCase().includes('too large to sync safely')) {
    return i18n.t(
      'settings.syncPhotoTooLargeMsg',
      'A photo is too large to sync safely. Retake it with a lower resolution, then try again.'
    );
  }

  return null;
}

function getSyncFailureMessage(error: unknown) {
  if (isSessionSyncError(error)) {
    return i18n.t(
      'settings.syncSessionExpiredMsg',
      'Your sign-in session expired. Sign out and sign back in to resume sync.'
    );
  }

  if (isSupabasePolicyError(error)) {
    return i18n.t(
      'settings.syncPolicyDeniedMsg',
      'The server denied access to sync your notes. Sign in again and try once more.'
    );
  }

  if (isSupabaseSchemaMismatchError(error)) {
    return i18n.t(
      'settings.syncSchemaOutdatedMsg',
      'Cloud sync needs the latest server migrations. Apply the latest Supabase migrations, then try again.'
    );
  }

  if (isSupabaseNetworkError(error)) {
    return i18n.t(
      'settings.syncNetworkMsg',
      'Unable to reach the server right now. Check your connection and try again.'
    );
  }

  return i18n.t(
    'settings.syncFailedMsg',
    'Unable to sync with the server right now. Please try again later.'
  );
}

function shouldLogSyncWarning(error: unknown) {
  return (
    !isSessionSyncError(error) &&
    !isSupabasePolicyError(error) &&
    !isSupabaseSchemaMismatchError(error) &&
    !isSupabaseNetworkError(error)
  );
}

function getRetryDelayMs(attemptCount: number) {
  const index = Math.max(0, Math.min(RETRY_DELAYS_MS.length - 1, attemptCount - 1));
  return RETRY_DELAYS_MS[index] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!;
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
) {
  if (items.length === 0) {
    return;
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;

        if (currentIndex >= items.length) {
          return;
        }

        await worker(items[currentIndex]!, currentIndex);
      }
    })
  );
}

async function cleanupRemoteArtifacts(
  bucket: string,
  artifacts: {
    photoPath?: string | null;
    pairedVideoPath?: string | null;
    stickerPaths?: string[];
  },
  options: { strict?: boolean } = {}
) {
  const removals: Promise<unknown>[] = [];

  const photoPath = normalizeRemoteArtifactPath(artifacts.photoPath);
  if (photoPath) {
    removals.push(deletePhotoFromStorage(bucket, photoPath));
  }

  const pairedVideoPath = normalizeRemoteArtifactPath(artifacts.pairedVideoPath);
  if (pairedVideoPath) {
    removals.push(deletePairedVideoFromStorage(bucket, pairedVideoPath));
  }

  for (const stickerPath of artifacts.stickerPaths ?? []) {
    removals.push(deletePhotoFromStorage(bucket, stickerPath));
  }

  if (removals.length === 0) {
    return;
  }

  if (!options.strict) {
    await Promise.allSettled(removals);
    return;
  }

  const results = await Promise.allSettled(removals);
  const firstFailure = results.find(
    (result): result is PromiseRejectedResult =>
      result.status === 'rejected' && !isSupabaseStorageObjectMissingError(result.reason)
  );
  if (firstFailure) {
    throw firstFailure.reason;
  }
}

function getReusableNoteMediaCleanupArtifacts(artifacts: {
  photoPath?: string | null;
  pairedVideoPath?: string | null;
  stickerPaths?: string[];
}) {
  return {
    photoPath: artifacts.photoPath ?? null,
    pairedVideoPath: artifacts.pairedVideoPath ?? null,
    stickerPaths: artifacts.stickerPaths ?? [],
  };
}

function collectDeletedIds<Row extends Record<string, unknown>>(
  rows: Row[] | null | undefined,
  idField: keyof Row
) {
  return normalizeRemoteEntityIds(
    (rows ?? []).map((row) => {
      const value = row?.[idField];
      return typeof value === 'string' ? value : null;
    })
  );
}

type MissingDeleteVerifier = (missingIds: string[]) => Promise<string[]>;

async function assertExpectedDeleteIds(
  entityLabel: string,
  expectedIds: string[],
  deletedIds: string[],
  verifyMissingIds?: MissingDeleteVerifier
) {
  if (expectedIds.length === 0) {
    return;
  }

  const deletedSet = new Set(deletedIds);
  let missingIds = expectedIds.filter((id) => !deletedSet.has(id));
  if (missingIds.length > 0 && verifyMissingIds) {
    const stillExistingIds = normalizeRemoteEntityIds(await verifyMissingIds(missingIds));
    if (stillExistingIds.length === 0) {
      return;
    }

    const stillExistingSet = new Set(stillExistingIds);
    missingIds = missingIds.filter((id) => stillExistingSet.has(id));
  }

  if (missingIds.length > 0) {
    throw new Error(
      `Remote ${entityLabel} delete did not remove expected rows: ${missingIds.join(', ')}`
    );
  }
}

function buildRemoteNoteCursor(row: Pick<NoteRow, 'id' | 'synced_at'>): RemoteNoteCursor | null {
  const syncedAt = typeof row.synced_at === 'string' ? row.synced_at.trim() : '';
  const id = typeof row.id === 'string' ? row.id.trim() : '';

  if (!syncedAt || !id) {
    return null;
  }

  return {
    syncedAt,
    id,
  };
}

function buildRemoteTombstoneCursor(
  row: Pick<NoteTombstoneRow, 'deleted_at' | 'note_id'>
): RemoteTombstoneCursor | null {
  const deletedAt = typeof row.deleted_at === 'string' ? row.deleted_at.trim() : '';
  const noteId = typeof row.note_id === 'string' ? row.note_id.trim() : '';

  if (!deletedAt || !noteId) {
    return null;
  }

  return {
    deletedAt,
    noteId,
  };
}

function normalizeRemoteNoteCursor(value: unknown): RemoteNoteCursor | null {
  if (typeof value !== 'object' || !value) {
    return null;
  }

  const syncedAt = typeof (value as { syncedAt?: unknown }).syncedAt === 'string'
    ? (value as { syncedAt: string }).syncedAt.trim()
    : '';
  const id = typeof (value as { id?: unknown }).id === 'string'
    ? (value as { id: string }).id.trim()
    : '';

  if (!syncedAt) {
    return null;
  }

  return {
    syncedAt,
    id,
  };
}

function normalizeRemoteTombstoneCursor(value: unknown): RemoteTombstoneCursor | null {
  if (typeof value !== 'object' || !value) {
    return null;
  }

  const deletedAt = typeof (value as { deletedAt?: unknown }).deletedAt === 'string'
    ? (value as { deletedAt: string }).deletedAt.trim()
    : '';
  const noteId = typeof (value as { noteId?: unknown }).noteId === 'string'
    ? (value as { noteId: string }).noteId.trim()
    : '';

  if (!deletedAt) {
    return null;
  }

  return {
    deletedAt,
    noteId,
  };
}

function parseStoredRemoteSyncCursor(rawValue: string | null): RemoteSyncCursor | null {
  const normalizedValue = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!normalizedValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(normalizedValue) as {
      notes?: unknown;
      tombstones?: unknown;
    };

    return {
      notes: normalizeRemoteNoteCursor(parsed?.notes),
      tombstones: normalizeRemoteTombstoneCursor(parsed?.tombstones),
    };
  } catch {
    return {
      notes: {
        syncedAt: normalizedValue,
        id: '',
      },
      tombstones: {
        deletedAt: normalizedValue,
        noteId: '',
      },
    };
  }
}

function buildKeysetFilter(
  primaryField: string,
  secondaryField: string,
  primaryValue: string,
  secondaryValue: string
) {
  if (!secondaryValue) {
    return null;
  }

  return `${primaryField}.gt.${primaryValue},and(${primaryField}.eq.${primaryValue},${secondaryField}.gt.${secondaryValue})`;
}

function logDeferredArtifactCleanupFailure(context: string, error: unknown) {
  console.warn(`[syncService] Deferred remote artifact cleanup failed for ${context}:`, error);
}

async function cleanupRemoteArtifactsBestEffort(
  context: string,
  bucket: string,
  artifacts: {
    photoPath?: string | null;
    pairedVideoPath?: string | null;
    stickerPaths?: string[];
  }
) {
  await cleanupRemoteArtifacts(bucket, artifacts).catch((error) => {
    logDeferredArtifactCleanupFailure(context, error);
  });
}

async function upsertRemoteNoteTombstones(
  userId: string,
  noteIds: Iterable<string>,
  deletedAt: string
) {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Cloud sync is unavailable in this build.');
  }

  const rows = Array.from(
    new Set(
      Array.from(noteIds)
        .map((noteId) => (typeof noteId === 'string' ? noteId.trim() : ''))
        .filter(Boolean)
    )
  ).map((noteId) => ({
    note_id: noteId,
    user_id: userId,
    deleted_at: deletedAt,
  }));

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase.from('note_tombstones').upsert(rows, {
    onConflict: 'note_id',
  });
  if (error) {
    if (isSupabaseSchemaMismatchError(error) || isSupabasePolicyError(error)) {
      console.warn('[syncService] Skipping note tombstone write:', error);
      return;
    }

    throw error;
  }
}

async function deleteRemoteNoteTombstone(userId: string, noteId: string) {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Cloud sync is unavailable in this build.');
  }

  const { error } = await supabase
    .from('note_tombstones')
    .delete()
    .eq('note_id', noteId)
    .eq('user_id', userId);
  if (error) {
    if (isSupabaseSchemaMismatchError(error) || isSupabasePolicyError(error)) {
      console.warn('[syncService] Skipping note tombstone cleanup:', error);
      return;
    }

    throw error;
  }
}

async function upsertRemoteSharedPostTombstones(
  userId: string,
  postIds: Iterable<string>,
  deletedAt: string
) {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Cloud sync is unavailable in this build.');
  }

  const rows = Array.from(
    new Set(
      Array.from(postIds)
        .map((postId) => (typeof postId === 'string' ? postId.trim() : ''))
        .filter(Boolean)
    )
  ).map((postId) => ({
    post_id: postId,
    author_user_id: userId,
    deleted_at: deletedAt,
  }));

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase.from('shared_post_tombstones').upsert(rows, {
    onConflict: 'post_id',
  });
  if (error) {
    if (isSupabaseSchemaMismatchError(error) || isSupabasePolicyError(error)) {
      console.warn('[syncService] Skipping shared post tombstone write:', error);
      return;
    }

    throw error;
  }
}

function getRetryMetadata(item: SyncQueueItem, error: unknown) {
  const nextAttemptCount = item.attempts + 1;
  const terminal = isTerminalSyncError(error) || nextAttemptCount >= MAX_SYNC_ATTEMPTS;
  const message = getErrorMessage(error);

  if (terminal) {
    return {
      error: message,
      nextRetryAt: null,
      terminal: true,
      blockedReason:
        getBlockedSyncReason(error) ??
        i18n.t(
          'settings.syncBlockedRetryMsg',
          'This note could not be synced after multiple attempts. Edit it and try again.'
        ),
    };
  }

  return {
    error: message,
    nextRetryAt: new Date(Date.now() + getRetryDelayMs(nextAttemptCount)).toISOString(),
    terminal: false,
    blockedReason: null,
  };
}

function getRemoteSyncCursorKey(userUid: string) {
  return `${REMOTE_SYNC_CURSOR_KEY_PREFIX}${userUid}`;
}

function getInitialSyncPendingKey(userUid: string) {
  return `${INITIAL_SYNC_PENDING_KEY_PREFIX}${userUid}`;
}

function safeParseJson(value: string | null | undefined) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function getSyncStateRow(ownerScope: string): Promise<SyncStateRow | null> {
  try {
    const db = await getDB();
    const row = await db.getFirstAsync<SyncStateRow>(
      `SELECT
         owner_uid,
         user_uid,
         initial_sync_status,
         last_note_cursor_json,
         last_tombstone_cursor_json,
         last_sync_started_at,
         last_sync_finished_at,
         last_sync_status,
         last_sync_error,
         updated_at
       FROM sync_state
       WHERE owner_uid = ?`,
      ownerScope
    );

    if (!row || typeof row.owner_uid !== 'string') {
      return null;
    }

    return row;
  } catch {
    return null;
  }
}

async function upsertSyncState(
  ownerScope: string,
  userUid: string,
  input: Partial<Pick<
    SyncStateRow,
    | 'initial_sync_status'
    | 'last_note_cursor_json'
    | 'last_tombstone_cursor_json'
    | 'last_sync_started_at'
    | 'last_sync_finished_at'
    | 'last_sync_status'
    | 'last_sync_error'
  >>
) {
  try {
    const db = await getDB();
    const existing = await getSyncStateRow(ownerScope);
    const updatedAt = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO sync_state (
         owner_uid,
         user_uid,
         initial_sync_status,
         last_note_cursor_json,
         last_tombstone_cursor_json,
         last_sync_started_at,
         last_sync_finished_at,
         last_sync_status,
         last_sync_error,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(owner_uid) DO UPDATE SET
         user_uid = excluded.user_uid,
         initial_sync_status = excluded.initial_sync_status,
         last_note_cursor_json = excluded.last_note_cursor_json,
         last_tombstone_cursor_json = excluded.last_tombstone_cursor_json,
         last_sync_started_at = excluded.last_sync_started_at,
         last_sync_finished_at = excluded.last_sync_finished_at,
         last_sync_status = excluded.last_sync_status,
         last_sync_error = excluded.last_sync_error,
         updated_at = excluded.updated_at`,
      ownerScope,
      userUid,
      input.initial_sync_status ?? existing?.initial_sync_status ?? 'pending',
      input.last_note_cursor_json ?? existing?.last_note_cursor_json ?? null,
      input.last_tombstone_cursor_json ?? existing?.last_tombstone_cursor_json ?? null,
      input.last_sync_started_at ?? existing?.last_sync_started_at ?? null,
      input.last_sync_finished_at ?? existing?.last_sync_finished_at ?? null,
      input.last_sync_status ?? existing?.last_sync_status ?? null,
      input.last_sync_error ?? existing?.last_sync_error ?? null,
      updatedAt
    );
  } catch (error) {
    console.warn('[syncService] Failed to persist sync state:', error);
  }
}

async function getLastRemoteSyncCursor(ownerScope: string, userUid: string) {
  const stateRow = await getSyncStateRow(ownerScope);
  const stateCursor =
    stateRow?.last_note_cursor_json || stateRow?.last_tombstone_cursor_json
      ? {
          notes: normalizeRemoteNoteCursor(
            safeParseJson(stateRow?.last_note_cursor_json)
          ),
          tombstones: normalizeRemoteTombstoneCursor(
            safeParseJson(stateRow?.last_tombstone_cursor_json)
          ),
        }
      : null;

  if (stateCursor?.notes || stateCursor?.tombstones) {
    return stateCursor;
  }

  const rawValue = await getPersistentItem(getRemoteSyncCursorKey(userUid));
  const legacyCursor = parseStoredRemoteSyncCursor(rawValue);
  if (legacyCursor) {
    await upsertSyncState(ownerScope, userUid, {
      last_note_cursor_json: legacyCursor.notes ? JSON.stringify(legacyCursor.notes) : null,
      last_tombstone_cursor_json: legacyCursor.tombstones ? JSON.stringify(legacyCursor.tombstones) : null,
    });
  }

  return legacyCursor;
}

async function setLastRemoteSyncCursor(ownerScope: string, userUid: string, cursor: RemoteSyncCursor) {
  await Promise.all([
    upsertSyncState(ownerScope, userUid, {
      last_note_cursor_json: cursor.notes ? JSON.stringify(cursor.notes) : null,
      last_tombstone_cursor_json: cursor.tombstones ? JSON.stringify(cursor.tombstones) : null,
    }),
    setPersistentItem(getRemoteSyncCursorKey(userUid), JSON.stringify(cursor)),
  ]);
}

function getSyncedNoteIdsKey(userUid: string) {
  return `${REMOTE_SYNCED_NOTE_IDS_KEY_PREFIX}${userUid}`;
}

async function getPreviouslySyncedNoteIds(userUid: string) {
  const rawValue = await getPersistentItem(getSyncedNoteIdsKey(userUid));
  if (!rawValue) {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }

    return new Set(
      parsed
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    );
  } catch {
    return new Set<string>();
  }
}

async function setPreviouslySyncedNoteIds(userUid: string, noteIds: Iterable<string>) {
  const serializedIds = Array.from(
    new Set(
      Array.from(noteIds)
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    )
  ).sort();

  await setPersistentItem(getSyncedNoteIdsKey(userUid), JSON.stringify(serializedIds));
}

export async function isInitialSyncPendingForUser(userUid: string): Promise<boolean> {
  const stateRow = await getSyncStateRow(userUid);
  if (stateRow?.initial_sync_status) {
    return stateRow.initial_sync_status !== 'complete';
  }

  const storedValue = await getPersistentItem(getInitialSyncPendingKey(userUid));
  if (storedValue === 'true' || storedValue === 'false') {
    return storedValue === 'true';
  }

  return !(await getLastRemoteSyncCursor(userUid, userUid));
}

async function setInitialSyncStatusForUser(
  ownerScope: string,
  userUid: string,
  status: 'pending' | 'running' | 'complete' | 'blocked'
) {
  await Promise.all([
    upsertSyncState(ownerScope, userUid, {
      initial_sync_status: status,
    }),
    setPersistentItem(getInitialSyncPendingKey(userUid), status === 'complete' ? 'false' : 'true'),
  ]);
}

function createSyncLeaseToken(itemId: number) {
  return `${itemId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
}

async function beginSyncRun(ownerScope: string, userUid: string, mode: SyncMode) {
  const startedAt = new Date().toISOString();
  const runId = `run:${startedAt}:${Math.random().toString(36).slice(2, 10)}`;

  try {
    const db = await getDB();
    await db.runAsync(
      `INSERT INTO sync_runs (
         owner_uid,
         run_id,
         mode,
         status,
         user_uid,
         started_at,
         heartbeat_at,
         completed_at
       )
       VALUES (?, ?, ?, 'running', ?, ?, ?, NULL)
       ON CONFLICT(owner_uid) DO UPDATE SET
         run_id = excluded.run_id,
         mode = excluded.mode,
         status = excluded.status,
         user_uid = excluded.user_uid,
         started_at = excluded.started_at,
         heartbeat_at = excluded.heartbeat_at,
         completed_at = NULL`,
      ownerScope,
      runId,
      mode,
      userUid,
      startedAt,
      startedAt
    );
  } catch (error) {
    console.warn('[syncService] Failed to persist sync run start:', error);
  }

  await upsertSyncState(ownerScope, userUid, {
    last_sync_started_at: startedAt,
    last_sync_status: 'running',
    last_sync_error: null,
  });

  return { runId, startedAt };
}

async function finishSyncRun(
  ownerScope: string,
  userUid: string,
  runId: string,
  status: 'success' | 'error',
  errorMessage?: string | null
) {
  const completedAt = new Date().toISOString();

  try {
    const db = await getDB();
    await db.runAsync(
      `UPDATE sync_runs
       SET status = ?,
           heartbeat_at = ?,
           completed_at = ?
       WHERE owner_uid = ? AND run_id = ?`,
      status,
      completedAt,
      completedAt,
      ownerScope,
      runId
    );
  } catch (error) {
    console.warn('[syncService] Failed to persist sync run completion:', error);
  }

  await upsertSyncState(ownerScope, userUid, {
    last_sync_finished_at: completedAt,
    last_sync_status: status,
    last_sync_error: errorMessage ?? null,
  });
}

async function ensureSupabaseSessionMatchesUser(userId: string) {
  const session = await getCurrentSupabaseSession();
  const sessionUserId = session?.user?.id?.trim();

  if (!sessionUserId) {
    throw new Error(EXPIRED_SESSION_SYNC_ERROR);
  }

  if (sessionUserId !== userId) {
    throw new Error(MISMATCHED_SESSION_SYNC_ERROR);
  }
}

async function fetchRemoteArtifactSnapshots(
  userId: string,
  noteIds: Iterable<string>
): Promise<Map<string, RemoteArtifactSnapshot>> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Cloud sync is unavailable in this build.');
  }

  const normalizedNoteIds = Array.from(
    new Set(
      Array.from(noteIds)
        .map((noteId) => (typeof noteId === 'string' ? noteId.trim() : ''))
        .filter(Boolean)
    )
  );
  const artifactSnapshots = new Map<string, RemoteArtifactSnapshot>();

  for (let startIndex = 0; startIndex < normalizedNoteIds.length; startIndex += REMOTE_ARTIFACT_FETCH_BATCH_SIZE) {
    const noteIdChunk = normalizedNoteIds.slice(
      startIndex,
      startIndex + REMOTE_ARTIFACT_FETCH_BATCH_SIZE
    );
    if (noteIdChunk.length === 0) {
      continue;
    }

    const { data, error } = await supabase
      .from('notes')
      .select('id, photo_path, paired_video_path, sticker_placements_json')
      .eq('user_id', userId)
      .in('id', noteIdChunk);
    if (error) {
      throw error;
    }

    for (const row of (data ?? []) as {
      id?: string;
      photo_path?: string | null;
      paired_video_path?: string | null;
      sticker_placements_json?: string | null;
    }[]) {
      if (!row.id) {
        continue;
      }

      artifactSnapshots.set(row.id, {
        photoPath: row.photo_path ?? null,
        pairedVideoPath: row.paired_video_path ?? null,
        stickerPlacementsJson: row.sticker_placements_json ?? null,
      });
    }
  }

  return artifactSnapshots;
}

async function fetchRemoteNotePage(
  userId: string,
  options: { since: RemoteNoteCursor | null; limit: number }
): Promise<NoteRow[]> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Cloud sync is unavailable in this build.');
  }

  let request = supabase
    .from('notes')
    .select(
      'id, user_id, type, content, photo_path, is_live_photo, paired_video_path, has_doodle, doodle_strokes_json, has_stickers, sticker_placements_json, location_name, prompt_id, prompt_text_snapshot, prompt_answer, mood_emoji, note_color, latitude, longitude, radius, is_favorite, created_at, updated_at, synced_at'
    )
    .eq('user_id', userId)
    .order('synced_at', { ascending: true })
    .order('id', { ascending: true })
    .range(0, options.limit - 1);

  if (options.since?.syncedAt) {
    const keysetFilter = buildKeysetFilter(
      'synced_at',
      'id',
      options.since.syncedAt,
      options.since.id
    );
    request = keysetFilter ? request.or(keysetFilter) : request.gt('synced_at', options.since.syncedAt);
  }

  const { data, error } = await request;
  if (error) {
    throw error;
  }

  return (data ?? []) as NoteRow[];
}

async function fetchRemoteNoteTombstonePage(
  userId: string,
  options: { since: RemoteTombstoneCursor | null; limit: number }
): Promise<NoteTombstoneRow[]> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Cloud sync is unavailable in this build.');
  }

  let request = supabase
    .from('note_tombstones')
    .select('note_id, user_id, deleted_at')
    .eq('user_id', userId)
    .order('deleted_at', { ascending: true })
    .order('note_id', { ascending: true })
    .range(0, options.limit - 1);

  if (options.since?.deletedAt) {
    const keysetFilter = buildKeysetFilter(
      'deleted_at',
      'note_id',
      options.since.deletedAt,
      options.since.noteId
    );
    request = keysetFilter
      ? request.or(keysetFilter)
      : request.gt('deleted_at', options.since.deletedAt);
  }

  const { data, error } = await request;
  if (error) {
    if (isSupabaseSchemaMismatchError(error) || isSupabasePolicyError(error)) {
      console.warn('[syncService] Skipping note tombstone merge:', error);
      return [];
    }

    throw error;
  }

  return (data ?? []) as NoteTombstoneRow[];
}

async function serializeNoteForSupabase(
  userId: string,
  note: Note,
  syncedAt: string,
  existingRemoteArtifacts: RemoteArtifactSnapshot | null = null
): Promise<NoteRow> {
  const currentPhotoUri =
    note.type === 'photo' ? normalizeMediaUri(note.photoLocalUri ?? note.content) : null;
  const currentPairedVideoUri =
    note.type === 'photo' && note.isLivePhoto
      ? normalizeMediaUri(note.pairedVideoLocalUri ?? null)
      : null;
  let photoPath: string | null = null;
  let pairedVideoPath: string | null = null;
  let stickerPlacementsJson: string | null = null;

  try {
    photoPath =
      note.type === 'photo'
        ? existingRemoteArtifacts?.photoPath &&
          (!currentPhotoUri || currentPhotoUri === normalizeMediaUri(note.photoSyncedLocalUri))
          ? existingRemoteArtifacts.photoPath
          : await uploadPhotoToStorage(
              NOTE_MEDIA_BUCKET,
              `${userId}/${note.id}`,
              currentPhotoUri,
              { allowOverwrite: true }
            )
        : null;
    pairedVideoPath =
      note.type === 'photo' && note.isLivePhoto
        ? existingRemoteArtifacts?.pairedVideoPath &&
          (!currentPairedVideoUri ||
            currentPairedVideoUri === normalizeMediaUri(note.pairedVideoSyncedLocalUri))
          ? existingRemoteArtifacts.pairedVideoPath
          : await uploadPairedVideoToStorage(
              NOTE_MEDIA_BUCKET,
              getRemotePairedVideoPath(`${userId}/${note.id}`, currentPairedVideoUri),
              currentPairedVideoUri,
              { allowOverwrite: true }
            )
        : null;
    const stickerPlacements = parseNoteStickerPlacements(note.stickerPlacementsJson);
    stickerPlacementsJson =
      stickerPlacements.length > 0
        ? await serializeStickerPlacementsForStorage(stickerPlacements, NOTE_MEDIA_BUCKET, userId, {
            serverOwnerUid: userId,
          })
        : null;

    return {
      id: note.id,
      user_id: userId,
      type: note.type,
      content: note.type === 'text' ? note.content : note.caption ?? '',
      photo_path: photoPath,
      is_live_photo: Boolean(note.isLivePhoto && pairedVideoPath),
      paired_video_path: pairedVideoPath,
      has_doodle: Boolean(note.hasDoodle && note.doodleStrokesJson),
      doodle_strokes_json: note.doodleStrokesJson ?? null,
      has_stickers: Boolean(stickerPlacementsJson),
      sticker_placements_json: stickerPlacementsJson,
      location_name: note.locationName,
      prompt_id: note.promptId ?? null,
      prompt_text_snapshot: note.promptTextSnapshot ?? null,
      prompt_answer: note.promptAnswer ?? null,
      mood_emoji: note.moodEmoji ?? null,
      note_color: note.noteColor ?? null,
      latitude: note.latitude,
      longitude: note.longitude,
      radius: note.radius,
      is_favorite: note.isFavorite,
      created_at: note.createdAt,
      updated_at: note.updatedAt,
      synced_at: syncedAt,
    };
  } catch (error) {
    await cleanupRemoteArtifacts(
      NOTE_MEDIA_BUCKET,
      getReusableNoteMediaCleanupArtifacts(
        buildNewRemoteArtifacts(
          {
            photoPath,
            pairedVideoPath,
            stickerPlacementsJson,
          },
          existingRemoteArtifacts
        )
      )
    );
    throw error;
  }
}

function getSyncUserId(user: SyncUser) {
  return user.id ?? user.uid;
}

async function deserializeRemoteNote(
  record: NoteRow,
  existingLocalNote: Note | null
): Promise<{ note: Note | null; advanceCursor: boolean }> {
  if (record.type !== 'text' && record.type !== 'photo') {
    return { note: null, advanceCursor: true };
  }

  if (!record.id || !record.created_at) {
    return { note: null, advanceCursor: true };
  }

  let photoLocalUri: string | null = existingLocalNote?.photoLocalUri ?? null;
  if (!photoLocalUri && existingLocalNote?.type === 'photo') {
    photoLocalUri = existingLocalNote.content;
  }
  let pairedVideoLocalUri: string | null = existingLocalNote?.pairedVideoLocalUri ?? null;

  if (record.type === 'photo' && record.photo_path) {
    try {
      photoLocalUri = await downloadPhotoFromStorage(
        NOTE_MEDIA_BUCKET,
        record.photo_path,
        record.id
      );
    } catch (error) {
      if (!isSupabaseStorageObjectMissingError(error)) {
        throw error;
      }
    }
  }

  if (record.type === 'photo' && record.is_live_photo && record.paired_video_path) {
    try {
      pairedVideoLocalUri = await downloadPairedVideoFromStorage(
        NOTE_MEDIA_BUCKET,
        record.paired_video_path,
        `${record.id}-motion`
      );
    } catch (error) {
      if (!isSupabaseStorageObjectMissingError(error)) {
        throw error;
      }
    }
  }

  if (record.type === 'photo' && !photoLocalUri) {
    console.warn('[syncService] Skipping remote photo note with missing media:', {
      noteId: record.id,
      photoPath: record.photo_path ?? null,
    });
    return {
      note: existingLocalNote?.type === 'photo' ? existingLocalNote : null,
      advanceCursor: true,
    };
  }

  const hydratedStickerPlacements = await hydrateStickerPlacements(
    parseNoteStickerPlacements(record.sticker_placements_json),
    NOTE_MEDIA_BUCKET
  );
  const stickerPlacementsJson =
    hydratedStickerPlacements.length > 0 ? JSON.stringify(hydratedStickerPlacements) : null;
  if (hydratedStickerPlacements.length > 0) {
    await syncStickerAssetsFromPlacements(hydratedStickerPlacements);
  }

  const nextNote: Note = {
    id: record.id,
    type: record.type,
    content: record.type === 'photo' ? photoLocalUri ?? '' : record.content ?? '',
    caption: record.type === 'photo' ? record.content ?? null : null,
    photoLocalUri,
    photoSyncedLocalUri: photoLocalUri,
    photoRemoteBase64: null,
    isLivePhoto: Boolean(record.is_live_photo && pairedVideoLocalUri),
    pairedVideoLocalUri,
    pairedVideoSyncedLocalUri: pairedVideoLocalUri,
    pairedVideoRemotePath: record.paired_video_path ?? null,
    locationName: record.location_name ?? null,
    promptId: record.prompt_id ?? null,
    promptTextSnapshot: record.prompt_text_snapshot ?? null,
    promptAnswer: record.prompt_answer ?? null,
    moodEmoji: record.mood_emoji ?? null,
    noteColor: record.note_color ?? null,
    latitude: record.latitude,
    longitude: record.longitude,
    radius: typeof record.radius === 'number' ? record.radius : 150,
    isFavorite: Boolean(record.is_favorite),
    hasDoodle: Boolean(record.has_doodle && record.doodle_strokes_json),
    doodleStrokesJson: record.doodle_strokes_json ?? null,
    hasStickers: Boolean(record.has_stickers && stickerPlacementsJson),
    stickerPlacementsJson,
    createdAt: record.created_at,
    updatedAt: record.updated_at ?? null,
  };

  return {
    note: nextNote,
    advanceCursor: true,
  };
}

function shouldIgnoreRemoteTombstone(
  tombstone: NoteTombstoneRow,
  remoteNoteSyncMarks: Map<string, string>,
  localNote: Note | null
) {
  const remoteSyncedAt = remoteNoteSyncMarks.get(tombstone.note_id);
  if (remoteSyncedAt && remoteSyncedAt > tombstone.deleted_at) {
    return true;
  }

  if (localNote && getSyncTimestamp(localNote) > new Date(tombstone.deleted_at).getTime()) {
    return true;
  }

  return false;
}

async function markItemFailed(
  syncRepository: SyncRepository,
  item: SyncQueueItem,
  leaseToken: string,
  error: unknown
): Promise<QueueFlushFailure> {
  const retryMetadata = getRetryMetadata(item, error);
  await syncRepository.markFailed(item.id, leaseToken, retryMetadata);
  return {
    itemId: item.id,
    error: retryMetadata.error,
    blockedReason: retryMetadata.blockedReason,
    terminal: retryMetadata.terminal,
  };
}

async function deleteRemoteNote(userId: string, noteId: string) {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Cloud sync is unavailable in this build.');
  }

  const deletedAt = new Date().toISOString();

  const { data: sharedPosts, error: sharedPostsError } = await supabase
    .from('shared_posts')
    .select('id, photo_path, paired_video_path, sticker_placements_json')
    .eq('author_user_id', userId)
    .eq('source_note_id', noteId);
  if (sharedPostsError) {
    throw sharedPostsError;
  }

  const { data: existingNote, error: noteFetchError } = await supabase
    .from('notes')
    .select('photo_path, paired_video_path, sticker_placements_json')
    .eq('id', noteId)
    .eq('user_id', userId)
    .maybeSingle();
  if (noteFetchError) {
    throw noteFetchError;
  }

  const sharedPostIds = normalizeRemoteEntityIds(
    ((sharedPosts ?? []) as { id?: string | null }[]).map((row) => row.id)
  );
  if (sharedPostIds.length > 0) {
    const { data: deletedSharedPosts, error: sharedDeleteError } = await supabase
      .from('shared_posts')
      .delete()
      .eq('author_user_id', userId)
      .in('id', sharedPostIds)
      .select('id');
    if (sharedDeleteError) {
      throw sharedDeleteError;
    }
    await assertExpectedDeleteIds(
      'shared post',
      sharedPostIds,
      collectDeletedIds(deletedSharedPosts as { id?: string | null }[] | null | undefined, 'id'),
      async (missingIds) => {
        const { data: remainingSharedPosts, error: remainingSharedPostsError } = await supabase
          .from('shared_posts')
          .select('id')
          .eq('author_user_id', userId)
          .in('id', missingIds);

        if (remainingSharedPostsError) {
          throw remainingSharedPostsError;
        }

        return collectDeletedIds(
          remainingSharedPosts as { id?: string | null }[] | null | undefined,
          'id'
        );
      }
    );

    await upsertRemoteSharedPostTombstones(userId, sharedPostIds, deletedAt);

    await Promise.all(
      ((sharedPosts ?? []) as (RemoteArtifactSnapshot & { id?: string })[]).map(async (row) => {
        const postId = typeof row.id === 'string' ? row.id.trim() : '';
        if (postId) {
          await clearRemoteStickerAssetRefs(userId, 'shared_post', postId);
        }
      })
    );

    await Promise.all(
      ((sharedPosts ?? []) as (RemoteArtifactSnapshot & { id?: string })[]).map(async (row) => {
        await cleanupRemoteArtifactsBestEffort(
          `shared post ${typeof row.id === 'string' ? row.id : 'unknown'}`,
          SHARED_POST_MEDIA_BUCKET,
          {
            photoPath: row.photoPath ?? (row as { photo_path?: string | null }).photo_path ?? null,
            pairedVideoPath:
              row.pairedVideoPath ?? (row as { paired_video_path?: string | null }).paired_video_path ?? null,
          }
        );
      })
    );
  }
  const expectedDeletedNoteIds = existingNote ? [noteId] : [];
  const { data: deletedNotes, error } = await supabase
    .from('notes')
    .delete()
    .eq('id', noteId)
    .eq('user_id', userId)
    .select('id');
  if (error) {
    throw error;
  }
  await assertExpectedDeleteIds(
    'note',
    expectedDeletedNoteIds,
    collectDeletedIds(deletedNotes as { id?: string | null }[] | null | undefined, 'id'),
    async (missingIds) => {
      const { data: remainingNotes, error: remainingNotesError } = await supabase
        .from('notes')
        .select('id')
        .eq('user_id', userId)
        .in('id', missingIds);

      if (remainingNotesError) {
        throw remainingNotesError;
      }

      return collectDeletedIds(
        remainingNotes as { id?: string | null }[] | null | undefined,
        'id'
      );
    }
  );

  await upsertRemoteNoteTombstones(userId, [noteId], deletedAt);
  await clearRemoteStickerAssetRefs(userId, 'note', noteId);
  await cleanupRemoteArtifactsBestEffort(`note ${noteId}`, NOTE_MEDIA_BUCKET, {
    photoPath: (existingNote as { photo_path?: string | null } | null)?.photo_path ?? null,
    pairedVideoPath:
      (existingNote as { paired_video_path?: string | null } | null)?.paired_video_path ?? null,
  });
}

async function deleteAllRemoteNotesForUser(userId: string) {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Cloud sync is unavailable in this build.');
  }

  const [{ data, error }, { data: sharedPosts, error: sharedPostsError }] = await Promise.all([
    supabase
      .from('notes')
      .select('id, photo_path, paired_video_path, sticker_placements_json')
      .eq('user_id', userId),
    supabase
      .from('shared_posts')
      .select('id, photo_path, paired_video_path, sticker_placements_json')
      .eq('author_user_id', userId),
  ]);
  if (error) {
    throw error;
  }
  if (sharedPostsError) {
    throw sharedPostsError;
  }

  const deletedAt = new Date().toISOString();

  const expectedSharedPostIds = normalizeRemoteEntityIds(
    ((sharedPosts ?? []) as { id?: string | null }[]).map((row) => row.id)
  );
  const { data: deletedSharedPosts, error: deleteSharedPostsError } = await supabase
    .from('shared_posts')
    .delete()
    .eq('author_user_id', userId)
    .select('id');
  if (deleteSharedPostsError) {
    throw deleteSharedPostsError;
  }
  await assertExpectedDeleteIds(
    'shared post',
    expectedSharedPostIds,
    collectDeletedIds(deletedSharedPosts as { id?: string | null }[] | null | undefined, 'id'),
    async (missingIds) => {
      const { data: remainingSharedPosts, error: remainingSharedPostsError } = await supabase
        .from('shared_posts')
        .select('id')
        .eq('author_user_id', userId)
        .in('id', missingIds);

      if (remainingSharedPostsError) {
        throw remainingSharedPostsError;
      }

      return collectDeletedIds(
        remainingSharedPosts as { id?: string | null }[] | null | undefined,
        'id'
      );
    }
  );

  await upsertRemoteSharedPostTombstones(
    userId,
    expectedSharedPostIds,
    deletedAt
  );

  await Promise.all(
    ((sharedPosts ?? []) as {
      id?: string;
      photo_path?: string | null;
      paired_video_path?: string | null;
      sticker_placements_json?: string | null;
    }[]).map(
      async (row) => {
        const postId = typeof row.id === 'string' ? row.id.trim() : '';
        if (postId) {
          await clearRemoteStickerAssetRefs(userId, 'shared_post', postId);
        }
      }
    )
  );
  await Promise.all(
    ((sharedPosts ?? []) as {
      id?: string;
      photo_path?: string | null;
      paired_video_path?: string | null;
      sticker_placements_json?: string | null;
    }[]).map(async (row) => {
      await cleanupRemoteArtifactsBestEffort(
        `shared post ${typeof row.id === 'string' ? row.id : 'unknown'}`,
        SHARED_POST_MEDIA_BUCKET,
        {
          photoPath: row.photo_path ?? null,
          pairedVideoPath: row.paired_video_path ?? null,
          stickerPaths: getRemoteStickerAssetPaths(row.sticker_placements_json ?? null),
        }
      );
    })
  );

  const expectedNoteIds = normalizeRemoteEntityIds(
    ((data ?? []) as { id?: string | null }[]).map((row) => row.id)
  );
  const { data: deletedNotes, error: deleteError } = await supabase
    .from('notes')
    .delete()
    .eq('user_id', userId)
    .select('id');
  if (deleteError) {
    throw deleteError;
  }
  await assertExpectedDeleteIds(
    'note',
    expectedNoteIds,
    collectDeletedIds(deletedNotes as { id?: string | null }[] | null | undefined, 'id'),
    async (missingIds) => {
      const { data: remainingNotes, error: remainingNotesError } = await supabase
        .from('notes')
        .select('id')
        .eq('user_id', userId)
        .in('id', missingIds);

      if (remainingNotesError) {
        throw remainingNotesError;
      }

      return collectDeletedIds(
        remainingNotes as { id?: string | null }[] | null | undefined,
        'id'
      );
    }
  );

  await upsertRemoteNoteTombstones(
    userId,
    expectedNoteIds,
    deletedAt
  );
  await Promise.all(
    ((data ?? []) as { id?: string }[]).map((row) => {
      const noteId = typeof row.id === 'string' ? row.id.trim() : '';
      return noteId ? clearRemoteStickerAssetRefs(userId, 'note', noteId) : Promise.resolve();
    })
  );
  await Promise.all(
    ((data ?? []) as {
      id?: string;
      photo_path?: string | null;
      paired_video_path?: string | null;
      sticker_placements_json?: string | null;
    }[]).map(async (row) => {
      await cleanupRemoteArtifactsBestEffort(
        `note ${typeof row.id === 'string' ? row.id : 'unknown'}`,
        NOTE_MEDIA_BUCKET,
        {
          photoPath: row.photo_path ?? null,
          pairedVideoPath: row.paired_video_path ?? null,
          stickerPaths: getRemoteStickerAssetPaths(row.sticker_placements_json ?? null),
        }
      );
    })
  );
}

async function upsertRemoteNote(
  userId: string,
  note: Note,
  syncMarker: string,
  existingArtifactsOverride?: RemoteArtifactSnapshot | null,
  ownerScope?: string
) {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Cloud sync is unavailable in this build.');
  }

  let existingArtifacts = existingArtifactsOverride;
  if (existingArtifacts === undefined) {
    const { data: existingRemoteNote, error: fetchError } = await supabase
      .from('notes')
      .select('photo_path, paired_video_path, sticker_placements_json')
      .eq('id', note.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (fetchError) {
      throw fetchError;
    }

    existingArtifacts = {
      photoPath: (existingRemoteNote as { photo_path?: string | null } | null)?.photo_path ?? null,
      pairedVideoPath:
        (existingRemoteNote as { paired_video_path?: string | null } | null)?.paired_video_path ?? null,
      stickerPlacementsJson:
        (existingRemoteNote as { sticker_placements_json?: string | null } | null)?.sticker_placements_json ??
        null,
    };
  }

  const serializedNote = await serializeNoteForSupabase(userId, note, syncMarker, existingArtifacts ?? null);
  const { error } = await supabase.from('notes').upsert(serializedNote, {
    onConflict: 'id',
  });
  if (error) {
    await cleanupRemoteArtifacts(
      NOTE_MEDIA_BUCKET,
      getReusableNoteMediaCleanupArtifacts(
        buildNewRemoteArtifacts(
          {
            photoPath: serializedNote.photo_path,
            pairedVideoPath: serializedNote.paired_video_path,
            stickerPlacementsJson: serializedNote.sticker_placements_json,
          },
          existingArtifacts
        )
      )
    );
    throw error;
  }

  await reconcileRemoteStickerAssetRefs(
    userId,
    'note',
    note.id,
    serializedNote.sticker_placements_json ?? null
  );

  let tombstoneError: unknown = null;
  try {
    await deleteRemoteNoteTombstone(userId, note.id);
  } catch (error) {
    tombstoneError = error;
  }

  await cleanupRemoteArtifacts(
    NOTE_MEDIA_BUCKET,
    getReusableNoteMediaCleanupArtifacts(
      buildRemovedRemoteArtifacts(existingArtifacts, {
        photoPath: serializedNote.photo_path,
        pairedVideoPath: serializedNote.paired_video_path,
        stickerPlacementsJson: serializedNote.sticker_placements_json,
      })
    )
  );

  try {
    await upsertNoteForScope({
      ...note,
      content: note.type === 'photo' ? normalizeMediaUri(note.photoLocalUri ?? note.content) ?? '' : note.content,
      caption: note.type === 'photo' ? note.caption ?? null : null,
      photoSyncedLocalUri:
        note.type === 'photo' ? normalizeMediaUri(note.photoLocalUri ?? note.content) : null,
      pairedVideoSyncedLocalUri:
        note.type === 'photo' && note.isLivePhoto
          ? normalizeMediaUri(note.pairedVideoLocalUri ?? null)
          : null,
      pairedVideoRemotePath: serializedNote.paired_video_path ?? null,
      hasStickers: Boolean(serializedNote.sticker_placements_json),
      stickerPlacementsJson: serializedNote.sticker_placements_json ?? null,
    }, ownerScope ?? getActiveNotesScope());
  } catch (error) {
    console.warn('Failed to persist synced media metadata locally:', error);
  }

  if (tombstoneError) {
    throw tombstoneError;
  }
}

async function flushPendingQueueToSupabase(
  user: SyncUser,
  syncRepository: SyncRepository,
  _notes: Note[],
  syncMarker: string,
  syncedNoteIds: Set<string>,
  ownerScope: string
): Promise<FlushQueueResult> {
  const userId = getSyncUserId(user);

  let processedCount = 0;
  let failedCount = 0;
  let lastError: string | null = null;
  let lastBlockedReason: string | null = null;
  let hadLocalWrites = false;

  while (true) {
    const pendingChanges = await syncRepository.listPending(QUEUE_FLUSH_BATCH_SIZE);
    if (pendingChanges.length === 0) {
      break;
    }

    const remoteArtifactSnapshots = await fetchRemoteArtifactSnapshots(
      userId,
      pendingChanges
        .filter((change) => change.operation !== 'delete' && change.operation !== 'deleteAll')
        .map((change) => change.entityId)
        .filter((entityId): entityId is string => Boolean(entityId))
    );

    for (const change of pendingChanges) {
      const leaseToken = createSyncLeaseToken(change.id);
      const claimed = await syncRepository.markProcessing(change.id, leaseToken);
      if (!claimed) {
        continue;
      }

      try {
        if (!(await syncRepository.hasLease(change.id, leaseToken))) {
          continue;
        }

        if (change.operation === 'deleteAll') {
          await deleteAllRemoteNotesForUser(userId);
          syncedNoteIds.clear();
          await syncRepository.markDone(change.id, leaseToken);
          processedCount += 1;
          hadLocalWrites = true;
          continue;
        }

        if (!change.entityId) {
          await syncRepository.markDone(change.id, leaseToken);
          processedCount += 1;
          continue;
        }

        if (change.operation === 'delete') {
          if (!(await syncRepository.hasLease(change.id, leaseToken))) {
            continue;
          }
          await deleteRemoteNote(userId, change.entityId);
        } else {
          const note = await getNoteByIdForScope(change.entityId, ownerScope);
          if (!(await syncRepository.hasLease(change.id, leaseToken))) {
            continue;
          }
          if (!note) {
            await deleteRemoteNote(userId, change.entityId);
          } else {
            await upsertRemoteNote(
              userId,
              note,
              syncMarker,
              remoteArtifactSnapshots.has(note.id)
                ? (remoteArtifactSnapshots.get(note.id) ?? null)
                : null,
              ownerScope
            );
            syncedNoteIds.add(note.id);
          }
        }

        if (change.operation === 'delete') {
          syncedNoteIds.delete(change.entityId);
        }

        await syncRepository.markDone(change.id, leaseToken);
        processedCount += 1;
        hadLocalWrites = true;
      } catch (error) {
        const failure = await markItemFailed(syncRepository, change, leaseToken, error);
        failedCount += 1;
        lastError = failure.error;
        lastBlockedReason = failure.blockedReason ?? lastBlockedReason;
      }
    }
  }

  return {
    processedCount,
    failedCount,
    lastError,
    lastBlockedReason,
    hadLocalWrites,
  };
}

async function uploadLocalSnapshotToSupabase(
  userId: string,
  notes: Note[],
  syncMarker: string,
  ownerScope: string
) {
  const remoteArtifactSnapshots = await fetchRemoteArtifactSnapshots(
    userId,
    notes.map((note) => note.id)
  );
  await mapWithConcurrency(notes, FULL_SNAPSHOT_UPLOAD_CONCURRENCY, async (note) => {
    await upsertRemoteNote(
      userId,
      note,
      syncMarker,
      remoteArtifactSnapshots.has(note.id)
        ? (remoteArtifactSnapshots.get(note.id) ?? null)
        : null,
      ownerScope
    );
  });

  return notes.length;
}

async function reconcileLocallyDeletedNotes(
  ownerScope: string,
  remoteNoteIds: Set<string>,
  syncedNoteIds: Set<string>,
  lastRemoteCursor: RemoteNoteCursor | null
) {
  if (!lastRemoteCursor) {
    return 0;
  }

  const cutoffTime = new Date(lastRemoteCursor.syncedAt).getTime();
  if (Number.isNaN(cutoffTime)) {
    return 0;
  }

  const localNotes = await getAllNotesForScope(ownerScope);
  const staleNotes = localNotes.filter(
    (note) =>
      syncedNoteIds.has(note.id) &&
      !remoteNoteIds.has(note.id) &&
      getSyncTimestamp(note) <= cutoffTime
  );

  for (const note of staleNotes) {
    await deleteNoteForScope(note.id, ownerScope);
    syncedNoteIds.delete(note.id);
  }

  return staleNotes.length;
}

async function mergeRemoteNoteTombstonesFromSupabase(
  userId: string,
  ownerScope: string,
  syncedNoteIds: Set<string>,
  remoteNoteSyncMarks: Map<string, string>,
  options: { since: RemoteTombstoneCursor | null }
): Promise<RemoteTombstoneMergeResult> {
  let deletedCount = 0;
  let tombstoneCursor = options.since;

  while (true) {
    const rows = await fetchRemoteNoteTombstonePage(userId, {
      since: tombstoneCursor,
      limit: REMOTE_SYNC_PAGE_SIZE,
    });
    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      if (!row.note_id) {
        continue;
      }

      tombstoneCursor = buildRemoteTombstoneCursor(row) ?? tombstoneCursor;
      const existingLocalNote = await getNoteByIdForScope(row.note_id, ownerScope);
      if (shouldIgnoreRemoteTombstone(row, remoteNoteSyncMarks, existingLocalNote)) {
        continue;
      }

      syncedNoteIds.delete(row.note_id);

      if (!existingLocalNote) {
        continue;
      }

      await deleteNoteForScope(row.note_id, ownerScope);
      deletedCount += 1;
    }

    if (rows.length < REMOTE_SYNC_PAGE_SIZE) {
      break;
    }
  }

  return { deletedCount, tombstoneCursor };
}

async function mergeRemoteNotesFromSupabase(
  userId: string,
  ownerScope: string,
  localNotes: Note[],
  options: { since: RemoteNoteCursor | null }
): Promise<RemoteMergeResult> {
  const localNoteMap = new Map(localNotes.map((note) => [note.id, note]));
  let importedCount = 0;
  let noteCursor = options.since;
  const remoteNoteIds = new Set<string>();
  const remoteNoteSyncMarks = new Map<string, string>();
  let cursorBlockedByMissingMedia = false;
  let scanCompleted = true;

  while (true) {
    const rows = await fetchRemoteNotePage(userId, {
      since: noteCursor,
      limit: REMOTE_SYNC_PAGE_SIZE,
    });
    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      remoteNoteIds.add(row.id);
      if (row.synced_at) {
        remoteNoteSyncMarks.set(row.id, row.synced_at);
      }

      const existingLocalNote =
        localNoteMap.get(row.id) ?? (await getNoteByIdForScope(row.id, ownerScope));
      if (existingLocalNote && getSyncTimestamp(existingLocalNote) >= getSyncTimestamp(row)) {
        noteCursor = buildRemoteNoteCursor(row) ?? noteCursor;
        continue;
      }

      const { note: nextLocalNote, advanceCursor } = await deserializeRemoteNote(row, existingLocalNote);
      if (!advanceCursor) {
        cursorBlockedByMissingMedia = true;
        scanCompleted = false;
        break;
      }
      if (!nextLocalNote) {
        noteCursor = buildRemoteNoteCursor(row) ?? noteCursor;
        continue;
      }

      await upsertNoteForScope(nextLocalNote, ownerScope);
      localNoteMap.set(nextLocalNote.id, nextLocalNote);
      importedCount += 1;
      noteCursor = buildRemoteNoteCursor(row) ?? noteCursor;
    }

    if (cursorBlockedByMissingMedia || rows.length < REMOTE_SYNC_PAGE_SIZE) {
      break;
    }
  }

  return {
    importedCount,
    noteCursor,
    cursorBlocked: cursorBlockedByMissingMedia,
    scanCompleted,
    remoteNoteIds,
    remoteNoteSyncMarks,
  };
}

function createSqliteSyncRepository(resolveScope: () => string): SyncRepository {
  return {
  async enqueue(change) {
    const db = await getDB();
    const scope = resolveScope();
    const serializedPayload =
      change.payload === undefined ? null : JSON.stringify(change.payload);
    const entityId = change.entityId ?? null;
    const coalesceKey =
      change.type === 'deleteAll'
        ? `scope:${scope}:deleteAll`
        : entityId
          ? `${change.entity}:${entityId}`
          : null;

    if (change.type === 'deleteAll') {
      await db.runAsync('DELETE FROM sync_queue WHERE owner_uid = ?', scope);
    } else if (coalesceKey) {
      const existing = await db.getFirstAsync<QueueRow>(
        `SELECT *
         FROM sync_queue
         WHERE owner_uid = ? AND coalesce_key = ?
         ORDER BY created_at ASC
         LIMIT 1`,
        scope,
        coalesceKey
      );

      if (existing?.id) {
        const nextOperation =
          change.type === 'delete'
            ? 'delete'
            : existing.operation === 'create' || change.type === 'create'
              ? 'create'
              : 'update';

        await db.runAsync(
          `UPDATE sync_queue
           SET entity = ?,
               entity_id = ?,
               operation = ?,
               payload = ?,
               status = 'pending',
               last_error = NULL,
               next_retry_at = NULL,
               terminal = 0,
               blocked_reason = NULL,
               lease_token = NULL
           WHERE id = ? AND owner_uid = ?`,
          change.entity,
          entityId,
          nextOperation,
          serializedPayload,
          existing.id,
          scope
        );
        return;
      }
    }

    await db.runAsync(
      `INSERT INTO sync_queue (
        owner_uid,
        entity,
        entity_id,
        coalesce_key,
        operation,
        payload,
        status,
        attempts,
        last_error,
        next_retry_at,
        terminal,
        blocked_reason,
        lease_token,
        created_at
      )
       VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, NULL, NULL, 0, NULL, NULL, ?)`,
      scope,
      change.entity,
      entityId,
      coalesceKey,
      change.type,
      serializedPayload,
      change.timestamp
    );
  },

  async listPending(limit = 100) {
    const db = await getDB();
    const scope = resolveScope();
    const now = new Date().toISOString();
    const rows = await db.getAllAsync<QueueRow>(
      `SELECT *
       FROM sync_queue
       WHERE owner_uid = ?
         AND status IN ('pending', 'failed')
         AND terminal = 0
         AND (next_retry_at IS NULL OR next_retry_at <= ?)
       ORDER BY created_at ASC
       LIMIT ?`,
      scope,
      now,
      limit
    );
    return rows.map(rowToQueueItem);
  },

  async recoverProcessing() {
    const db = await getDB();
    const scope = resolveScope();
    await db.runAsync(
      `UPDATE sync_queue
       SET status = 'pending',
           last_error = NULL,
           next_retry_at = NULL,
           blocked_reason = NULL,
           lease_token = NULL
       WHERE owner_uid = ? AND status = 'processing'`,
      scope
    );
  },

  async recoverBlockedSessionErrors() {
    const db = await getDB();
    const scope = resolveScope();
    const blockedRows = await db.getAllAsync<Pick<QueueRow, 'id' | 'last_error'>>(
      `SELECT id, last_error
       FROM sync_queue
       WHERE owner_uid = ?
         AND terminal = 1`,
      scope
    );

    const recoverableRowIds = blockedRows
      .filter((row) => isRecoverableSessionSyncErrorMessage(row.last_error))
      .map((row) => row.id);

    if (recoverableRowIds.length === 0) {
      return 0;
    }

    for (const rowId of recoverableRowIds) {
      await db.runAsync(
        `UPDATE sync_queue
         SET status = 'pending',
             attempts = 0,
             last_error = NULL,
             next_retry_at = NULL,
             terminal = 0,
             blocked_reason = NULL,
             lease_token = NULL
         WHERE id = ? AND owner_uid = ?`,
        rowId,
        scope
      );
    }

    return recoverableRowIds.length;
  },

  async markProcessing(id, leaseToken) {
    const db = await getDB();
    const scope = resolveScope();
    await db.runAsync(
      `UPDATE sync_queue
       SET status = 'processing',
           attempts = attempts + 1,
           last_error = NULL,
           blocked_reason = NULL,
           lease_token = ?
       WHERE id = ? AND owner_uid = ?`,
      leaseToken,
      id,
      scope
    );

    const claimedRow = await db.getFirstAsync<{ id: number }>(
      `SELECT id
       FROM sync_queue
       WHERE id = ? AND owner_uid = ? AND lease_token = ? AND status = 'processing'`,
      id,
      scope,
      leaseToken
    );

    return Boolean(claimedRow);
  },

  async hasLease(id, leaseToken) {
    const db = await getDB();
    const scope = resolveScope();
    const leasedRow = await db.getFirstAsync<{ id: number }>(
      `SELECT id
       FROM sync_queue
       WHERE id = ? AND owner_uid = ? AND lease_token = ? AND status = 'processing'`,
      id,
      scope,
      leaseToken
    );

    return Boolean(leasedRow);
  },

  async getStats() {
    const db = await getDB();
    const scope = resolveScope();
    await db.runAsync(
      `UPDATE sync_queue
       SET status = 'pending',
           last_error = NULL,
           next_retry_at = NULL,
           blocked_reason = NULL,
           lease_token = NULL
       WHERE owner_uid = ? AND status = 'processing'`,
      scope
    );
    return readQueueStats(scope);
  },

  async peekStats() {
    const scope = resolveScope();
    return readQueueStats(scope);
  },

  async listRecent(limit = 5) {
    const db = await getDB();
    const scope = resolveScope();
    const rows = await db.getAllAsync<QueueRow>(
      `SELECT *
       FROM sync_queue
       WHERE owner_uid = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      scope,
      limit
    );
    return rows.map(rowToQueueItem);
  },

  async markFailed(id, leaseToken, details) {
    const db = await getDB();
    const scope = resolveScope();
    const normalizedDetails =
      typeof details === 'string'
        ? { error: details, nextRetryAt: null, terminal: false, blockedReason: null }
        : details;
    await db.runAsync(
      `UPDATE sync_queue
       SET status = 'failed',
           last_error = ?,
           next_retry_at = ?,
           terminal = ?,
           blocked_reason = ?,
           lease_token = NULL
       WHERE id = ? AND owner_uid = ? AND lease_token = ?`,
      normalizedDetails?.error ?? null,
      normalizedDetails?.nextRetryAt ?? null,
      normalizedDetails?.terminal ? 1 : 0,
      normalizedDetails?.blockedReason ?? null,
      id,
      scope,
      leaseToken
    );
  },

  async markDone(id, leaseToken) {
    const db = await getDB();
    const scope = resolveScope();
    await db.runAsync(
      'DELETE FROM sync_queue WHERE id = ? AND owner_uid = ? AND lease_token = ?',
      id,
      scope,
      leaseToken
    );
  },

  async clearAll() {
    const db = await getDB();
    const scope = resolveScope();
    await db.runAsync('DELETE FROM sync_queue WHERE owner_uid = ?', scope);
  },
  };
}

const sqliteSyncRepository = createSqliteSyncRepository(() => getActiveNotesScope());

function getScopedSyncRepository(scope: string): SyncRepository {
  return createSqliteSyncRepository(() => scope);
}

const localFirstSyncService: SyncService = {
  isAvailable: Boolean(getSupabase()),
  async recordChange(change) {
    try {
      const syncRepository = getScopedSyncRepository(change.ownerScope ?? getActiveNotesScope());
      await syncRepository.enqueue(change);
    } catch (error) {
      console.warn('[syncService] Failed to enqueue sync change:', error);
    }
  },
};

export async function syncNotes(
  user: SyncUser | null,
  notes: Note[],
  options: SyncOptions = {}
): Promise<SyncResult> {
  if (!user) {
    return {
      status: 'unavailable',
      message: i18n.t('settings.syncSignInMsg'),
    };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      status: 'unavailable',
      message: i18n.t('settings.syncUnavailableMsg'),
    };
  }

  const requestedMode = options.mode ?? 'incremental';
  const userId = getSyncUserId(user);
  const ownerScope = getActiveNotesScope();

  const inFlightRun = syncRunsInFlight.get(ownerScope);
  if (inFlightRun) {
    if (
      requestedMode === 'full' &&
      inFlightRun.requestedMode !== 'full' &&
      inFlightRun.currentMode !== 'full'
    ) {
      inFlightRun.queuedMode = 'full';
    }
    return inFlightRun.promise;
  }

  const runState: InFlightSyncRun = {
    promise: Promise.resolve({
      status: 'error',
      bootstrapCompleted: false,
      message: 'sync-not-started',
    }),
    requestedMode,
    currentMode: requestedMode,
    queuedMode: null,
  };

  const runSyncCycle = async (cycleRequestedMode: SyncMode): Promise<SyncResult> => {
    let runId: string | null = null;

    try {
      await ensureSupabaseSessionMatchesUser(userId);

      const syncRepository = getScopedSyncRepository(ownerScope);
      const syncMarker = new Date().toISOString();
      const lastRemoteCursor = await getLastRemoteSyncCursor(ownerScope, userId);
      const syncedNoteIds = await getPreviouslySyncedNoteIds(userId);
      const mode: SyncMode =
        cycleRequestedMode === 'full' || !lastRemoteCursor ? 'full' : 'incremental';
      runState.currentMode = mode;
      const wasInitialSyncPending = await isInitialSyncPendingForUser(userId);
      const currentLocalNotes = await getAllNotesForScope(ownerScope);

      const run = await beginSyncRun(ownerScope, userId, mode);
      runId = run.runId;

      if (mode === 'full' && wasInitialSyncPending) {
        await setInitialSyncStatusForUser(ownerScope, userId, 'running');
      }

      await syncRepository.recoverProcessing();

      const queueResult = await flushPendingQueueToSupabase(
        user,
        syncRepository,
        currentLocalNotes,
        syncMarker,
        syncedNoteIds,
        ownerScope
      );
      if (queueResult.failedCount > 0) {
        const result = {
          status: 'error' as const,
          syncedCount: queueResult.processedCount,
          uploadedCount: 0,
          importedCount: 0,
          failedCount: queueResult.failedCount,
          bootstrapCompleted: false,
          message:
            queueResult.lastBlockedReason ??
            queueResult.lastError ??
            i18n.t(
              'settings.syncQueueFailureMsg',
              'Some notes could not be synced. Please try again after checking your photo sizes and connection.'
            ),
        };
        if (runId) {
          await finishSyncRun(ownerScope, userId, runId, 'error', result.message ?? null);
        }
        if (mode === 'full' && wasInitialSyncPending) {
          await setInitialSyncStatusForUser(ownerScope, userId, 'pending');
        }
        return result;
      }

      let uploadedSnapshotCount = 0;
      let importedCount = 0;
      let nextCursor: RemoteSyncCursor = lastRemoteCursor ?? {
        notes: null,
        tombstones: null,
      };
      let finalNoteCount = currentLocalNotes.length;
      let finalPhotoNoteCount = countPhotoNotes(currentLocalNotes);
      let finalDailyPhotoNoteCount = countPhotoNotesCreatedToday(currentLocalNotes);
      let finalDailyPhotoNoteDate = getLocalPhotoUsageDateKey();
      let bootstrapCompleted = !wasInitialSyncPending;

      if (mode === 'full') {
        const remoteMergeResult = await mergeRemoteNotesFromSupabase(userId, ownerScope, currentLocalNotes, { since: null });
        const tombstoneMergeResult = await mergeRemoteNoteTombstonesFromSupabase(
          userId,
          ownerScope,
          syncedNoteIds,
          remoteMergeResult.remoteNoteSyncMarks,
          { since: null }
        );
        importedCount = remoteMergeResult.importedCount + tombstoneMergeResult.deletedCount;
        if (remoteMergeResult.scanCompleted) {
          await reconcileLocallyDeletedNotes(
            ownerScope,
            remoteMergeResult.remoteNoteIds,
            syncedNoteIds,
            lastRemoteCursor?.notes ?? null
          );
        }

        const latestLocalNotes = await getAllNotesForScope(ownerScope);
        finalNoteCount = latestLocalNotes.length;
        finalPhotoNoteCount = countPhotoNotes(latestLocalNotes);
        finalDailyPhotoNoteCount = countPhotoNotesCreatedToday(latestLocalNotes);
        finalDailyPhotoNoteDate = getLocalPhotoUsageDateKey();

        if (remoteMergeResult.scanCompleted) {
          for (const note of latestLocalNotes) {
            syncedNoteIds.add(note.id);
          }
          uploadedSnapshotCount = await uploadLocalSnapshotToSupabase(
            userId,
            latestLocalNotes,
            syncMarker,
            ownerScope
          );
          nextCursor = {
            notes: remoteMergeResult.noteCursor,
            tombstones: tombstoneMergeResult.tombstoneCursor,
          };
          bootstrapCompleted = true;
          await setInitialSyncStatusForUser(ownerScope, userId, 'complete');
        } else {
          nextCursor = lastRemoteCursor ?? nextCursor;
          bootstrapCompleted = false;
          if (wasInitialSyncPending) {
            await setInitialSyncStatusForUser(ownerScope, userId, 'pending');
          }
        }
      } else {
        const remoteMergeResult = await mergeRemoteNotesFromSupabase(userId, ownerScope, currentLocalNotes, {
          since: lastRemoteCursor?.notes ?? null,
        });
        const tombstoneMergeResult = await mergeRemoteNoteTombstonesFromSupabase(
          userId,
          ownerScope,
          syncedNoteIds,
          remoteMergeResult.remoteNoteSyncMarks,
          { since: lastRemoteCursor?.tombstones ?? null }
        );
        importedCount = remoteMergeResult.importedCount + tombstoneMergeResult.deletedCount;
        for (const remoteNoteId of remoteMergeResult.remoteNoteIds) {
          syncedNoteIds.add(remoteNoteId);
        }
        nextCursor = {
          notes: remoteMergeResult.noteCursor ?? lastRemoteCursor?.notes ?? null,
          tombstones: tombstoneMergeResult.tombstoneCursor ?? lastRemoteCursor?.tombstones ?? null,
        };
        if (importedCount > 0) {
          const latestLocalNotes = await getAllNotesForScope(ownerScope);
          finalNoteCount = latestLocalNotes.length;
          finalPhotoNoteCount = countPhotoNotes(latestLocalNotes);
          finalDailyPhotoNoteCount = countPhotoNotesCreatedToday(latestLocalNotes);
          finalDailyPhotoNoteDate = getLocalPhotoUsageDateKey();
        }
      }

      await Promise.all([
        setLastRemoteSyncCursor(ownerScope, userId, nextCursor),
        setPreviouslySyncedNoteIds(userId, syncedNoteIds),
      ]);

      const syncedCount = queueResult.processedCount + uploadedSnapshotCount + importedCount;
      const result: SyncResult = {
        status: 'success',
        syncedCount,
        uploadedCount: uploadedSnapshotCount,
        importedCount,
        failedCount: 0,
        bootstrapCompleted,
        message:
          syncedCount === 1
            ? i18n.t('settings.syncSuccessMsgOne')
            : i18n.t('settings.syncSuccessMsgOther', { count: syncedCount }),
      };

      if (runId) {
        await finishSyncRun(ownerScope, userId, runId, 'success');
      }

      void (async () => {
        try {
          const { error: usageError } = await supabase.from('user_usage').upsert(
            {
              user_id: userId,
              note_count: finalNoteCount,
              photo_note_count: finalPhotoNoteCount,
              photo_note_daily_count: finalDailyPhotoNoteCount,
              photo_note_daily_date: finalDailyPhotoNoteDate,
              last_synced_at: syncMarker,
            },
            { onConflict: 'user_id' }
          );

          if (usageError) {
            console.warn('[syncService] Failed to persist user usage after sync:', usageError);
          }
        } catch (error) {
          console.warn('[syncService] Failed to persist user usage after sync:', error);
        }
      })();

      void upsertPublicUserProfile({
        userUid: userId,
        displayName: user.displayName,
        username: user.username,
        email: user.email,
        photoURL: user.photoURL,
      }).catch((error) => {
        console.warn('[syncService] Failed to persist public profile after sync:', error);
      });

      return result;
    } catch (error) {
      if (runId) {
        await finishSyncRun(ownerScope, userId, runId, 'error', getErrorMessage(error));
      }
      if (cycleRequestedMode === 'full' || (await isInitialSyncPendingForUser(userId))) {
        await setInitialSyncStatusForUser(ownerScope, userId, 'pending');
      }
      if (shouldLogSyncWarning(error)) {
        console.warn('[syncService] Supabase sync failed:', error);
      }

      return {
        status: 'error',
        bootstrapCompleted: false,
        message: getSyncFailureMessage(error),
      };
    }
  };

  const syncTask = (async (): Promise<SyncResult> => {
    let cycleRequestedMode = requestedMode;

    while (true) {
      runState.requestedMode = cycleRequestedMode;
      const result = await runSyncCycle(cycleRequestedMode);

      if (runState.queuedMode === 'full' && runState.currentMode !== 'full') {
        runState.queuedMode = null;
        cycleRequestedMode = 'full';
        continue;
      }

      return result;
    }
  })();

  runState.promise = syncTask.finally(() => {
    syncRunsInFlight.delete(ownerScope);
  });
  syncRunsInFlight.set(ownerScope, runState);
  return runState.promise;
}


export function getSyncRepository(): SyncRepository {
  return sqliteSyncRepository;
}

export async function hasStoredRemoteSyncCursor(userUid: string): Promise<boolean> {
  return Boolean(await getLastRemoteSyncCursor(userUid, userUid));
}

export function getSyncService(): SyncService {
  return {
    ...localFirstSyncService,
    isAvailable: Boolean(getSupabase()),
  };
}

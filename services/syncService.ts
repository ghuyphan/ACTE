import { countPhotoNotes } from '../constants/subscription';
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
  deleteNote,
  getActiveNotesScope,
  Note,
  getAllNotes,
  getDB,
  getNoteById,
  upsertNote,
} from './database';
import {
  hydrateStickerPlacements,
  parseNoteStickerPlacements,
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
import { getPairedVideoFileExtension } from './livePhotoStorage';
import { upsertPublicUserProfile } from './publicProfileService';

export type SyncChangeType = 'create' | 'update' | 'delete' | 'deleteAll';
export type SyncQueueStatus = 'pending' | 'processing' | 'failed';
export type SyncMode = 'incremental' | 'full';

export interface SyncChange {
  type: SyncChangeType;
  entity: 'note';
  entityId?: string;
  payload?: unknown;
  timestamp: string;
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
  getStats: () => Promise<{
    pendingCount: number;
    failedCount: number;
    blockedCount: number;
  }>;
  recoverProcessing: () => Promise<void>;
  markProcessing: (id: number) => Promise<void>;
  markFailed: (
    id: number,
    details?:
      | string
      | {
          error?: string;
          nextRetryAt?: string | null;
          terminal?: boolean;
          blockedReason?: string | null;
        }
  ) => Promise<void>;
  markDone: (id: number) => Promise<void>;
  clearAll: () => Promise<void>;
}

function getRemotePairedVideoPath(basePath: string, localUri: string | null | undefined) {
  return `${basePath}.motion${getPairedVideoFileExtension(localUri)}`;
}

function normalizeMediaUri(value: string | null | undefined) {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  return normalizedValue || null;
}

export interface SyncService {
  isAvailable: boolean;
  recordChange: (change: SyncChange) => Promise<void>;
}

export interface SyncUser extends Pick<AppUser, 'uid' | 'displayName' | 'email' | 'photoURL'> {
  id?: string;
}

export interface SyncResult {
  status: 'success' | 'unavailable' | 'error';
  message?: string;
  syncedCount?: number;
  uploadedCount?: number;
  importedCount?: number;
  failedCount?: number;
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

interface SharedPostTombstoneRow {
  post_id: string;
  author_user_id: string;
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

interface RemoteMergeResult {
  importedCount: number;
  latestSyncedAt: string | null;
  remoteNoteIds: Set<string>;
  remoteNoteSyncMarks: Map<string, string>;
}

interface RemoteTombstoneMergeResult {
  deletedCount: number;
  latestDeletedAt: string | null;
}

interface QueueRow {
  id: number;
  owner_uid?: string;
  entity: 'note';
  entity_id: string | null;
  operation: SyncChangeType;
  payload: string | null;
  status: SyncQueueStatus;
  attempts: number;
  last_error: string | null;
  next_retry_at: string | null;
  terminal: number;
  blocked_reason: string | null;
  created_at: string;
}

interface RemoteArtifactSnapshot {
  photoPath?: string | null;
  pairedVideoPath?: string | null;
  stickerPlacementsJson?: string | null;
}

const MAX_SYNC_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
];
const REMOTE_SYNC_CURSOR_KEY_PREFIX = 'sync.lastRemoteCursor.';
const REMOTE_SYNCED_NOTE_IDS_KEY_PREFIX = 'sync.syncedNoteIds.';
const EXPIRED_SESSION_SYNC_ERROR = 'Server session unavailable. Sign in again to resume sync.';
const MISMATCHED_SESSION_SYNC_ERROR =
  'Signed-in session does not match this account. Sign out and sign in again.';

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

function normalizeRemoteArtifactPath(path: string | null | undefined) {
  const normalizedPath = typeof path === 'string' ? path.trim() : '';
  return normalizedPath || null;
}

function getRemoteStickerAssetPaths(stickerPlacementsJson: string | null | undefined) {
  return Array.from(
    new Set(
      parseNoteStickerPlacements(stickerPlacementsJson)
        .map((placement) => normalizeRemoteArtifactPath(placement.asset.remotePath))
        .filter((path): path is string => Boolean(path))
    )
  );
}

function buildNewRemoteArtifacts(
  next: RemoteArtifactSnapshot,
  previous: RemoteArtifactSnapshot | null | undefined
) {
  const previousStickerPaths = new Set(getRemoteStickerAssetPaths(previous?.stickerPlacementsJson));
  return {
    photoPath:
      normalizeRemoteArtifactPath(next.photoPath) !== normalizeRemoteArtifactPath(previous?.photoPath)
        ? normalizeRemoteArtifactPath(next.photoPath)
        : null,
    pairedVideoPath:
      normalizeRemoteArtifactPath(next.pairedVideoPath) !== normalizeRemoteArtifactPath(previous?.pairedVideoPath)
        ? normalizeRemoteArtifactPath(next.pairedVideoPath)
        : null,
    stickerPaths: getRemoteStickerAssetPaths(next.stickerPlacementsJson).filter(
      (path) => !previousStickerPaths.has(path)
    ),
  };
}

function buildRemovedRemoteArtifacts(
  previous: RemoteArtifactSnapshot | null | undefined,
  next: RemoteArtifactSnapshot | null | undefined
) {
  const nextStickerPaths = new Set(getRemoteStickerAssetPaths(next?.stickerPlacementsJson));
  return {
    photoPath:
      normalizeRemoteArtifactPath(previous?.photoPath) !== normalizeRemoteArtifactPath(next?.photoPath)
        ? normalizeRemoteArtifactPath(previous?.photoPath)
        : null,
    pairedVideoPath:
      normalizeRemoteArtifactPath(previous?.pairedVideoPath) !==
      normalizeRemoteArtifactPath(next?.pairedVideoPath)
        ? normalizeRemoteArtifactPath(previous?.pairedVideoPath)
        : null,
    stickerPaths: getRemoteStickerAssetPaths(previous?.stickerPlacementsJson).filter(
      (path) => !nextStickerPaths.has(path)
    ),
  };
}

async function cleanupRemoteArtifacts(
  bucket: string,
  artifacts: {
    photoPath?: string | null;
    pairedVideoPath?: string | null;
    stickerPaths?: string[];
  }
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

  await Promise.allSettled(removals);
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

async function getLastRemoteSyncCursor(userUid: string) {
  return getPersistentItem(getRemoteSyncCursorKey(userUid));
}

async function setLastRemoteSyncCursor(userUid: string, cursor: string) {
  await setPersistentItem(getRemoteSyncCursorKey(userUid), cursor);
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
        ? existingRemoteArtifacts?.photoPath && currentPhotoUri === normalizeMediaUri(note.photoSyncedLocalUri)
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
          currentPairedVideoUri === normalizeMediaUri(note.pairedVideoSyncedLocalUri)
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
        ? await serializeStickerPlacementsForStorage(stickerPlacements, NOTE_MEDIA_BUCKET, userId)
        : null;

    return {
      id: note.id,
      user_id: userId,
      type: note.type,
      content: note.type === 'text' ? note.content : '',
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
      buildNewRemoteArtifacts(
        {
          photoPath,
          pairedVideoPath,
          stickerPlacementsJson,
        },
        existingRemoteArtifacts
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
    return {
      note: existingLocalNote?.type === 'photo' ? existingLocalNote : null,
      advanceCursor: false,
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
  error: unknown
): Promise<QueueFlushFailure> {
  const retryMetadata = getRetryMetadata(item, error);
  await syncRepository.markFailed(item.id, retryMetadata);
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

  const sharedPostIds = ((sharedPosts ?? []) as Array<{ id: string }>).map((row) => row.id).filter(Boolean);
  if (sharedPostIds.length > 0) {
    const { error: sharedDeleteError } = await supabase
      .from('shared_posts')
      .delete()
      .eq('author_user_id', userId)
      .in('id', sharedPostIds);
    if (sharedDeleteError) {
      throw sharedDeleteError;
    }

    await upsertRemoteSharedPostTombstones(userId, sharedPostIds, deletedAt);

    await Promise.all(
      ((sharedPosts ?? []) as Array<RemoteArtifactSnapshot>).map((row) =>
        cleanupRemoteArtifacts(SHARED_POST_MEDIA_BUCKET, {
          photoPath: row.photoPath ?? (row as { photo_path?: string | null }).photo_path ?? null,
          pairedVideoPath:
            row.pairedVideoPath ?? (row as { paired_video_path?: string | null }).paired_video_path ?? null,
          stickerPaths: getRemoteStickerAssetPaths(
            row.stickerPlacementsJson ??
              (row as { sticker_placements_json?: string | null }).sticker_placements_json ??
              null
          ),
        })
      )
    );
  }
  const { error } = await supabase.from('notes').delete().eq('id', noteId).eq('user_id', userId);
  if (error) {
    throw error;
  }

  await upsertRemoteNoteTombstones(userId, [noteId], deletedAt);

  await cleanupRemoteArtifacts(NOTE_MEDIA_BUCKET, {
    photoPath: (existingNote as { photo_path?: string | null } | null)?.photo_path ?? null,
    pairedVideoPath:
      (existingNote as { paired_video_path?: string | null } | null)?.paired_video_path ?? null,
    stickerPaths: getRemoteStickerAssetPaths(
      (existingNote as { sticker_placements_json?: string | null } | null)?.sticker_placements_json ?? null
    ),
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

  const { error: deleteSharedPostsError } = await supabase
    .from('shared_posts')
    .delete()
    .eq('author_user_id', userId);
  if (deleteSharedPostsError) {
    throw deleteSharedPostsError;
  }

  await upsertRemoteSharedPostTombstones(
    userId,
    ((sharedPosts ?? []) as Array<{ id: string }>).map((row) => row.id),
    deletedAt
  );

  await Promise.all(
    ((sharedPosts ?? []) as Array<{ photo_path?: string | null; paired_video_path?: string | null; sticker_placements_json?: string | null }>).map(
      (row) =>
        cleanupRemoteArtifacts(SHARED_POST_MEDIA_BUCKET, {
          photoPath: row.photo_path ?? null,
          pairedVideoPath: row.paired_video_path ?? null,
          stickerPaths: getRemoteStickerAssetPaths(row.sticker_placements_json ?? null),
        })
    )
  );

  const { error: deleteError } = await supabase.from('notes').delete().eq('user_id', userId);
  if (deleteError) {
    throw deleteError;
  }

  await upsertRemoteNoteTombstones(
    userId,
    ((data ?? []) as Array<{ id: string }>).map((row) => row.id),
    deletedAt
  );

  await Promise.all(
    ((data ?? []) as Array<{ photo_path?: string | null; paired_video_path?: string | null; sticker_placements_json?: string | null }>).map(
      (row) =>
        cleanupRemoteArtifacts(NOTE_MEDIA_BUCKET, {
          photoPath: row.photo_path ?? null,
          pairedVideoPath: row.paired_video_path ?? null,
          stickerPaths: getRemoteStickerAssetPaths(row.sticker_placements_json ?? null),
        })
    )
  );
}

async function upsertRemoteNote(userId: string, note: Note, syncMarker: string) {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Cloud sync is unavailable in this build.');
  }

  const { data: existingRemoteNote, error: fetchError } = await supabase
    .from('notes')
    .select('photo_path, paired_video_path, sticker_placements_json')
    .eq('id', note.id)
    .eq('user_id', userId)
    .maybeSingle();
  if (fetchError) {
    throw fetchError;
  }

  const existingArtifacts: RemoteArtifactSnapshot = {
    photoPath: (existingRemoteNote as { photo_path?: string | null } | null)?.photo_path ?? null,
    pairedVideoPath:
      (existingRemoteNote as { paired_video_path?: string | null } | null)?.paired_video_path ?? null,
    stickerPlacementsJson:
      (existingRemoteNote as { sticker_placements_json?: string | null } | null)?.sticker_placements_json ??
      null,
  };
  const serializedNote = await serializeNoteForSupabase(userId, note, syncMarker, existingArtifacts);
  const { error } = await supabase.from('notes').upsert(serializedNote, {
    onConflict: 'id',
  });
  if (error) {
    await cleanupRemoteArtifacts(
      NOTE_MEDIA_BUCKET,
      buildNewRemoteArtifacts(
        {
          photoPath: serializedNote.photo_path,
          pairedVideoPath: serializedNote.paired_video_path,
          stickerPlacementsJson: serializedNote.sticker_placements_json,
        },
        existingArtifacts
      )
    );
    throw error;
  }

  let tombstoneError: unknown = null;
  try {
    await deleteRemoteNoteTombstone(userId, note.id);
  } catch (error) {
    tombstoneError = error;
  }

  await cleanupRemoteArtifacts(
    NOTE_MEDIA_BUCKET,
    buildRemovedRemoteArtifacts(existingArtifacts, {
      photoPath: serializedNote.photo_path,
      pairedVideoPath: serializedNote.paired_video_path,
      stickerPlacementsJson: serializedNote.sticker_placements_json,
    })
  );

  try {
    await upsertNote({
      ...note,
      content: note.type === 'photo' ? normalizeMediaUri(note.photoLocalUri ?? note.content) ?? '' : note.content,
      photoSyncedLocalUri:
        note.type === 'photo' ? normalizeMediaUri(note.photoLocalUri ?? note.content) : null,
      pairedVideoSyncedLocalUri:
        note.type === 'photo' && note.isLivePhoto
          ? normalizeMediaUri(note.pairedVideoLocalUri ?? null)
          : null,
      pairedVideoRemotePath: serializedNote.paired_video_path ?? null,
    });
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
  notes: Note[],
  syncMarker: string,
  syncedNoteIds: Set<string>
): Promise<FlushQueueResult> {
  const pendingChanges = await syncRepository.listPending(5000);
  const noteMap = new Map(notes.map((note) => [note.id, note]));
  const userId = getSyncUserId(user);

  let processedCount = 0;
  let failedCount = 0;
  let lastError: string | null = null;
  let lastBlockedReason: string | null = null;
  let hadLocalWrites = false;

  for (const change of pendingChanges) {
    await syncRepository.markProcessing(change.id);

    try {
      if (change.operation === 'deleteAll') {
        await deleteAllRemoteNotesForUser(userId);
        syncedNoteIds.clear();
        await syncRepository.markDone(change.id);
        processedCount += 1;
        hadLocalWrites = true;
        continue;
      }

      if (!change.entityId) {
        await syncRepository.markDone(change.id);
        processedCount += 1;
        continue;
      }

      if (change.operation === 'delete') {
        await deleteRemoteNote(userId, change.entityId);
      } else {
        const note = noteMap.get(change.entityId);
        if (!note) {
          await deleteRemoteNote(userId, change.entityId);
        } else {
          await upsertRemoteNote(userId, note, syncMarker);
          syncedNoteIds.add(note.id);
        }
      }

      if (change.operation === 'delete') {
        syncedNoteIds.delete(change.entityId);
      }

      await syncRepository.markDone(change.id);
      processedCount += 1;
      hadLocalWrites = true;
    } catch (error) {
      const failure = await markItemFailed(syncRepository, change, error);
      failedCount += 1;
      lastError = failure.error;
      lastBlockedReason = failure.blockedReason ?? lastBlockedReason;
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

async function uploadLocalSnapshotToSupabase(userId: string, notes: Note[], syncMarker: string) {
  for (const note of notes) {
    await upsertRemoteNote(userId, note, syncMarker);
  }

  return notes.length;
}

async function reconcileLocallyDeletedNotes(
  remoteNoteIds: Set<string>,
  syncedNoteIds: Set<string>,
  lastRemoteCursor: string | null
) {
  if (!lastRemoteCursor) {
    return 0;
  }

  const cutoffTime = new Date(lastRemoteCursor).getTime();
  if (Number.isNaN(cutoffTime)) {
    return 0;
  }

  const localNotes = await getAllNotes();
  const staleNotes = localNotes.filter(
    (note) =>
      syncedNoteIds.has(note.id) &&
      !remoteNoteIds.has(note.id) &&
      getSyncTimestamp(note) <= cutoffTime
  );

  for (const note of staleNotes) {
    await deleteNote(note.id);
    syncedNoteIds.delete(note.id);
  }

  return staleNotes.length;
}

async function mergeRemoteNoteTombstonesFromSupabase(
  userId: string,
  syncedNoteIds: Set<string>,
  remoteNoteSyncMarks: Map<string, string>,
  options: { since: string | null }
): Promise<RemoteTombstoneMergeResult> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Cloud sync is unavailable in this build.');
  }

  let request = supabase
    .from('note_tombstones')
    .select('note_id, user_id, deleted_at')
    .eq('user_id', userId)
    .order('deleted_at', { ascending: true });

  if (options.since) {
    request = request.gt('deleted_at', options.since);
  }

  const { data, error } = await request;
  if (error) {
    if (isSupabaseSchemaMismatchError(error) || isSupabasePolicyError(error)) {
      console.warn('[syncService] Skipping note tombstone merge:', error);
      return { deletedCount: 0, latestDeletedAt: options.since };
    }

    throw error;
  }

  let deletedCount = 0;
  let latestDeletedAt = options.since;

  for (const row of (data ?? []) as NoteTombstoneRow[]) {
    if (!row.note_id) {
      continue;
    }

    latestDeletedAt = row.deleted_at ?? latestDeletedAt;
    const existingLocalNote = await getNoteById(row.note_id);
    if (shouldIgnoreRemoteTombstone(row, remoteNoteSyncMarks, existingLocalNote)) {
      continue;
    }

    syncedNoteIds.delete(row.note_id);

    if (!existingLocalNote) {
      continue;
    }

    await deleteNote(row.note_id);
    deletedCount += 1;
  }

  return { deletedCount, latestDeletedAt };
}

async function mergeRemoteNotesFromSupabase(
  userId: string,
  localNotes: Note[],
  options: { since: string | null }
): Promise<RemoteMergeResult> {
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
    .order('synced_at', { ascending: true });

  if (options.since) {
    request = request.gt('synced_at', options.since);
  }

  const { data, error } = await request;
  if (error) {
    throw error;
  }

  const localNoteMap = new Map(localNotes.map((note) => [note.id, note]));
  let importedCount = 0;
  let latestSyncedAt: string | null = options.since;
  const remoteNoteIds = new Set<string>();
  const remoteNoteSyncMarks = new Map<string, string>();
  let cursorBlockedByMissingMedia = false;

  for (const row of (data ?? []) as NoteRow[]) {
    remoteNoteIds.add(row.id);
    if (row.synced_at) {
      remoteNoteSyncMarks.set(row.id, row.synced_at);
    }
    const existingLocalNote = localNoteMap.get(row.id) ?? (await getNoteById(row.id));
    const { note: nextLocalNote, advanceCursor } = await deserializeRemoteNote(row, existingLocalNote);
    if (advanceCursor && !cursorBlockedByMissingMedia) {
      latestSyncedAt = row.synced_at ?? latestSyncedAt;
    }
    if (!advanceCursor) {
      cursorBlockedByMissingMedia = true;
    }
    if (!nextLocalNote) {
      continue;
    }

    if (existingLocalNote && getSyncTimestamp(existingLocalNote) >= getSyncTimestamp(row)) {
      continue;
    }

    await upsertNote(nextLocalNote);
    localNoteMap.set(nextLocalNote.id, nextLocalNote);
    importedCount += 1;
    if (!cursorBlockedByMissingMedia) {
      latestSyncedAt = row.synced_at ?? latestSyncedAt;
    }
  }

  return { importedCount, latestSyncedAt, remoteNoteIds, remoteNoteSyncMarks };
}

const sqliteSyncRepository: SyncRepository = {
  async enqueue(change) {
    const db = await getDB();
    const scope = getActiveNotesScope();
    const serializedPayload =
      change.payload === undefined ? null : JSON.stringify(change.payload);
    await db.runAsync(
      `INSERT INTO sync_queue (
        owner_uid,
        entity,
        entity_id,
        operation,
        payload,
        status,
        attempts,
        last_error,
        next_retry_at,
        terminal,
        blocked_reason,
        created_at
      )
       VALUES (?, ?, ?, ?, ?, 'pending', 0, NULL, NULL, 0, NULL, ?)`,
      scope,
      change.entity,
      change.entityId ?? null,
      change.type,
      serializedPayload,
      change.timestamp
    );
  },

  async listPending(limit = 100) {
    const db = await getDB();
    const scope = getActiveNotesScope();
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
    const scope = getActiveNotesScope();
    await db.runAsync(
      `UPDATE sync_queue
       SET status = 'pending',
           last_error = NULL,
           next_retry_at = NULL,
           blocked_reason = NULL
       WHERE owner_uid = ? AND status = 'processing'`,
      scope
    );
  },

  async markProcessing(id) {
    const db = await getDB();
    const scope = getActiveNotesScope();
    await db.runAsync(
      `UPDATE sync_queue
       SET status = 'processing',
           attempts = attempts + 1,
           last_error = NULL,
           blocked_reason = NULL
       WHERE id = ? AND owner_uid = ?`,
      id,
      scope
    );
  },

  async getStats() {
    const db = await getDB();
    const scope = getActiveNotesScope();
    await sqliteSyncRepository.recoverProcessing();
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
  },

  async markFailed(id, details) {
    const db = await getDB();
    const scope = getActiveNotesScope();
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
           blocked_reason = ?
       WHERE id = ? AND owner_uid = ?`,
      normalizedDetails?.error ?? null,
      normalizedDetails?.nextRetryAt ?? null,
      normalizedDetails?.terminal ? 1 : 0,
      normalizedDetails?.blockedReason ?? null,
      id,
      scope
    );
  },

  async markDone(id) {
    const db = await getDB();
    const scope = getActiveNotesScope();
    await db.runAsync('DELETE FROM sync_queue WHERE id = ? AND owner_uid = ?', id, scope);
  },

  async clearAll() {
    const db = await getDB();
    const scope = getActiveNotesScope();
    await db.runAsync('DELETE FROM sync_queue WHERE owner_uid = ?', scope);
  },
};

const localFirstSyncService: SyncService = {
  isAvailable: Boolean(getSupabase()),
  async recordChange(change) {
    try {
      await sqliteSyncRepository.enqueue(change);
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
      message: 'Sign in to sync your notes.',
    };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      status: 'unavailable',
      message: 'Cloud sync is unavailable in this build.',
    };
  }

  const requestedMode = options.mode ?? 'incremental';
  const userId = getSyncUserId(user);

  try {
    await ensureSupabaseSessionMatchesUser(userId);

    const syncRepository = getSyncRepository();
    const syncMarker = new Date().toISOString();
    const lastRemoteCursor = await getLastRemoteSyncCursor(userId);
    const syncedNoteIds = await getPreviouslySyncedNoteIds(userId);
    const mode: SyncMode =
      requestedMode === 'full' || !lastRemoteCursor ? 'full' : 'incremental';

    await syncRepository.recoverProcessing();

    const queueResult = await flushPendingQueueToSupabase(
      user,
      syncRepository,
      notes,
      syncMarker,
      syncedNoteIds
    );
    if (queueResult.failedCount > 0) {
      return {
        status: 'error',
        syncedCount: queueResult.processedCount,
        uploadedCount: 0,
        importedCount: 0,
        failedCount: queueResult.failedCount,
        message:
          queueResult.lastBlockedReason ??
          queueResult.lastError ??
          'Some notes could not be synced. Please try again after checking your photo sizes and connection.',
      };
    }

    let uploadedSnapshotCount = 0;
    let importedCount = 0;
    let nextCursor = lastRemoteCursor ?? syncMarker;
    let finalNoteCount = notes.length;
    let finalPhotoNoteCount = countPhotoNotes(notes);

    if (mode === 'full') {
      const remoteMergeResult = await mergeRemoteNotesFromSupabase(userId, notes, { since: null });
      const tombstoneMergeResult = await mergeRemoteNoteTombstonesFromSupabase(
        userId,
        syncedNoteIds,
        remoteMergeResult.remoteNoteSyncMarks,
        { since: null }
      );
      importedCount = remoteMergeResult.importedCount + tombstoneMergeResult.deletedCount;
      await reconcileLocallyDeletedNotes(remoteMergeResult.remoteNoteIds, syncedNoteIds, lastRemoteCursor);
      const latestLocalNotes = await getAllNotes();
      finalNoteCount = latestLocalNotes.length;
      finalPhotoNoteCount = countPhotoNotes(latestLocalNotes);
      for (const note of latestLocalNotes) {
        syncedNoteIds.add(note.id);
      }
      uploadedSnapshotCount = await uploadLocalSnapshotToSupabase(userId, latestLocalNotes, syncMarker);
      nextCursor = syncMarker;
    } else {
      const remoteMergeResult = await mergeRemoteNotesFromSupabase(userId, notes, {
        since: lastRemoteCursor,
      });
      const tombstoneMergeResult = await mergeRemoteNoteTombstonesFromSupabase(
        userId,
        syncedNoteIds,
        remoteMergeResult.remoteNoteSyncMarks,
        { since: lastRemoteCursor }
      );
      importedCount = remoteMergeResult.importedCount + tombstoneMergeResult.deletedCount;
      for (const remoteNoteId of remoteMergeResult.remoteNoteIds) {
        syncedNoteIds.add(remoteNoteId);
      }
      if (remoteMergeResult.latestSyncedAt && remoteMergeResult.latestSyncedAt > nextCursor) {
        nextCursor = remoteMergeResult.latestSyncedAt;
      }
      if (tombstoneMergeResult.latestDeletedAt && tombstoneMergeResult.latestDeletedAt > nextCursor) {
        nextCursor = tombstoneMergeResult.latestDeletedAt;
      }
      if (queueResult.hadLocalWrites && syncMarker > nextCursor) {
        nextCursor = syncMarker;
      }
      if (importedCount > 0) {
        const latestLocalNotes = await getAllNotes();
        finalNoteCount = latestLocalNotes.length;
        finalPhotoNoteCount = countPhotoNotes(latestLocalNotes);
      }
    }

    const { error: usageError } = await supabase.from('user_usage').upsert(
      {
        user_id: userId,
        note_count: finalNoteCount,
        photo_note_count: finalPhotoNoteCount,
        last_synced_at: syncMarker,
      },
      { onConflict: 'user_id' }
    );
    if (usageError) {
      throw usageError;
    }

    await Promise.all([
      upsertPublicUserProfile({
        userUid: userId,
        displayName: user.displayName,
        photoURL: user.photoURL,
      }),
      setLastRemoteSyncCursor(userId, nextCursor),
      setPreviouslySyncedNoteIds(userId, syncedNoteIds),
    ]);

    const syncedCount = queueResult.processedCount + uploadedSnapshotCount + importedCount;
    return {
      status: 'success',
      syncedCount,
      uploadedCount: uploadedSnapshotCount,
      importedCount,
      failedCount: 0,
      message:
        syncedCount === 1
          ? 'Synced 1 note with the server.'
          : `Synced ${syncedCount} notes with the server.`,
    };
  } catch (error) {
    if (shouldLogSyncWarning(error)) {
      console.warn('[syncService] Supabase sync failed:', error);
    }

    return {
      status: 'error',
      message: getSyncFailureMessage(error),
    };
  }
}


export function getSyncRepository(): SyncRepository {
  return sqliteSyncRepository;
}

export function getSyncService(): SyncService {
  return {
    ...localFirstSyncService,
    isAvailable: Boolean(getSupabase()),
  };
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  doc,
  FirebaseFirestoreTypes,
  getDocs,
  orderBy,
  query,
  setDoc,
  where,
  writeBatch,
} from '@react-native-firebase/firestore';
import { countPhotoNotes } from '../constants/subscription';
import { Note, getAllNotes, getDB, getNoteById, upsertNote } from './database';
import { readPhotoAsBase64, writePhotoFromBase64 } from './photoStorage';
import { upsertPublicUserProfile } from './publicProfileService';
import { getFirestore } from '../utils/firebase';

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

export interface SyncService {
  isAvailable: boolean;
  recordChange: (change: SyncChange) => Promise<void>;
}

export interface SyncUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export type FirebaseSyncUser = SyncUser;

export interface FirebaseSyncResult {
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

interface FirebaseNoteRecord {
  id: string;
  type: Note['type'];
  content: string;
  photoRemoteBase64?: string | null;
  hasDoodle?: boolean;
  doodleStrokesJson?: string | null;
  locationName: string | null;
  promptId?: string | null;
  promptTextSnapshot?: string | null;
  promptAnswer?: string | null;
  moodEmoji?: string | null;
  latitude: number;
  longitude: number;
  radius: number;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string | null;
  syncedAt: string;
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
}

interface QueueRow {
  id: number;
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

const FIRESTORE_BATCH_LIMIT = 400;
const MAX_SYNC_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
];
const REMOTE_SYNC_CURSOR_KEY_PREFIX = 'sync.lastRemoteCursor.';

type FirestoreDocument = FirebaseFirestoreTypes.DocumentData;
type FirestoreCollection = FirebaseFirestoreTypes.CollectionReference<FirestoreDocument>;
type FirestoreWriteBatch = Pick<FirebaseFirestoreTypes.WriteBatch, 'commit' | 'delete' | 'set'>;

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

function getSyncTimestamp(note: Pick<Note, 'createdAt' | 'updatedAt'> | FirebaseNoteRecord) {
  return new Date(note.updatedAt ?? note.createdAt).getTime();
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Unknown sync error';
}

function isTerminalSyncError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('too large to sync safely');
}

function getRetryDelayMs(attemptCount: number) {
  const index = Math.max(0, Math.min(RETRY_DELAYS_MS.length - 1, attemptCount - 1));
  return RETRY_DELAYS_MS[index] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!;
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
        isTerminalSyncError(error)
          ? 'A photo is too large to sync safely. Retake it with a lower resolution, then try again.'
          : 'This note could not be synced after multiple attempts. Edit it and try again.',
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
  return AsyncStorage.getItem(getRemoteSyncCursorKey(userUid));
}

async function setLastRemoteSyncCursor(userUid: string, cursor: string) {
  await AsyncStorage.setItem(getRemoteSyncCursorKey(userUid), cursor);
}

async function serializeNoteForFirebase(note: Note, syncedAt: string): Promise<FirebaseNoteRecord> {
  let photoRemoteBase64 = note.photoRemoteBase64 ?? null;

  if (note.type === 'photo' && !photoRemoteBase64) {
    photoRemoteBase64 = await readPhotoAsBase64(note.photoLocalUri ?? note.content);
  }

  return {
    id: note.id,
    type: note.type,
    content: note.type === 'text' ? note.content : '',
    photoRemoteBase64,
    hasDoodle: Boolean(note.hasDoodle && note.doodleStrokesJson),
    doodleStrokesJson: note.doodleStrokesJson ?? null,
    locationName: note.locationName,
    promptId: note.promptId ?? null,
    promptTextSnapshot: note.promptTextSnapshot ?? null,
    promptAnswer: note.promptAnswer ?? null,
    moodEmoji: note.moodEmoji ?? null,
    latitude: note.latitude,
    longitude: note.longitude,
    radius: note.radius,
    isFavorite: note.isFavorite,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    syncedAt,
  };
}

async function deserializeRemoteNote(
  record: FirebaseNoteRecord,
  existingLocalNote: Note | null
): Promise<Note | null> {
  if (record.type !== 'text' && record.type !== 'photo') {
    return null;
  }

  if (!record.id || !record.createdAt) {
    return null;
  }

  let photoLocalUri: string | null = existingLocalNote?.photoLocalUri ?? null;
  if (!photoLocalUri && existingLocalNote?.type === 'photo') {
    photoLocalUri = existingLocalNote.content;
  }
  if (record.type === 'photo' && record.photoRemoteBase64) {
    photoLocalUri = await writePhotoFromBase64(record.id, record.photoRemoteBase64);
  }

  if (record.type === 'photo' && !photoLocalUri) {
    return existingLocalNote?.type === 'photo' ? existingLocalNote : null;
  }

  return {
    id: record.id,
    type: record.type,
    content: record.type === 'photo' ? photoLocalUri ?? '' : record.content ?? '',
    photoLocalUri,
    photoRemoteBase64: record.photoRemoteBase64 ?? null,
    locationName: record.locationName ?? null,
    promptId: record.promptId ?? null,
    promptTextSnapshot: record.promptTextSnapshot ?? null,
    promptAnswer: record.promptAnswer ?? null,
    moodEmoji: record.moodEmoji ?? null,
    latitude: record.latitude,
    longitude: record.longitude,
    radius: typeof record.radius === 'number' ? record.radius : 150,
    isFavorite: Boolean(record.isFavorite),
    hasDoodle: Boolean(record.hasDoodle && record.doodleStrokesJson),
    doodleStrokesJson: record.doodleStrokesJson ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt ?? null,
  };
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

async function commitBatch({
  batch,
  items,
  syncRepository,
}: {
  batch: FirestoreWriteBatch;
  items: SyncQueueItem[];
  syncRepository: SyncRepository;
}) {
  if (items.length === 0) {
    return {
      processedCount: 0,
      failedCount: 0,
      error: null as string | null,
      blockedReason: null as string | null,
    };
  }

  try {
    await batch.commit();
    await Promise.all(items.map((item) => syncRepository.markDone(item.id)));
    return {
      processedCount: items.length,
      failedCount: 0,
      error: null as string | null,
      blockedReason: null as string | null,
    };
  } catch (error) {
    const failures = await Promise.all(items.map((item) => markItemFailed(syncRepository, item, error)));
    return {
      processedCount: 0,
      failedCount: failures.length,
      error: failures[failures.length - 1]?.error ?? getErrorMessage(error),
      blockedReason: failures.find((failure) => failure.blockedReason)?.blockedReason ?? null,
    };
  }
}

async function deleteAllRemoteNotesInChunks(
  notesCollection: FirestoreCollection,
  firestore: FirebaseFirestoreTypes.Module
) {
  const snapshot = await getDocs(notesCollection);
  const docs = snapshot.docs ?? [];

  for (let index = 0; index < docs.length; index += FIRESTORE_BATCH_LIMIT) {
    const nextBatch = writeBatch(firestore);
    const chunk = docs.slice(index, index + FIRESTORE_BATCH_LIMIT);
    chunk.forEach((snapshotItem: FirebaseFirestoreTypes.QueryDocumentSnapshot<FirestoreDocument>) => {
      nextBatch.delete(snapshotItem.ref);
    });
    await nextBatch.commit();
  }
}

async function flushPendingQueueToFirebase(
  notesCollection: FirestoreCollection,
  firestore: FirebaseFirestoreTypes.Module,
  syncRepository: SyncRepository,
  notes: Note[],
  syncMarker: string
): Promise<FlushQueueResult> {
  const pendingChanges = await syncRepository.listPending(5000);
  const noteMap = new Map(notes.map((note) => [note.id, note]));

  let currentBatch = writeBatch(firestore);
  let currentBatchItems: SyncQueueItem[] = [];
  let currentBatchOps = 0;
  let processedCount = 0;
  let failedCount = 0;
  let lastError: string | null = null;
  let lastBlockedReason: string | null = null;
  let hadLocalWrites = false;

  const commitCurrentBatch = async () => {
    const result = await commitBatch({
      batch: currentBatch,
      items: currentBatchItems,
      syncRepository,
    });
    processedCount += result.processedCount;
    failedCount += result.failedCount;
    lastError = result.error ?? lastError;
    lastBlockedReason = result.blockedReason ?? lastBlockedReason;
    currentBatch = writeBatch(firestore);
    currentBatchItems = [];
    currentBatchOps = 0;
  };

  for (const change of pendingChanges) {
    await syncRepository.markProcessing(change.id);

    if (change.operation === 'deleteAll') {
      await commitCurrentBatch();

      try {
        await deleteAllRemoteNotesInChunks(notesCollection, firestore);
        await syncRepository.markDone(change.id);
        processedCount += 1;
        hadLocalWrites = true;
      } catch (error) {
        const failure = await markItemFailed(syncRepository, change, error);
        failedCount += 1;
        lastError = failure.error;
        lastBlockedReason = failure.blockedReason ?? lastBlockedReason;
      }
      continue;
    }

    if (!change.entityId) {
      await syncRepository.markDone(change.id);
      processedCount += 1;
      continue;
    }

    try {
      const docRef = doc(notesCollection, change.entityId);
      if (change.operation === 'delete') {
        currentBatch.delete(docRef);
      } else {
        const note = noteMap.get(change.entityId);
        if (!note) {
          currentBatch.delete(docRef);
        } else {
          const serializedNote = await serializeNoteForFirebase(note, syncMarker);
          currentBatch.set(docRef, serializedNote, { merge: true });
        }
      }

      currentBatchItems.push(change);
      currentBatchOps += 1;
      hadLocalWrites = true;

      if (currentBatchOps >= FIRESTORE_BATCH_LIMIT) {
        await commitCurrentBatch();
      }
    } catch (error) {
      const failure = await markItemFailed(syncRepository, change, error);
      failedCount += 1;
      lastError = failure.error;
      lastBlockedReason = failure.blockedReason ?? lastBlockedReason;
    }
  }

  await commitCurrentBatch();

  return {
    processedCount,
    failedCount,
    lastError,
    lastBlockedReason,
    hadLocalWrites,
  };
}

async function uploadLocalSnapshotToFirebase(
  notesCollection: FirestoreCollection,
  firestore: FirebaseFirestoreTypes.Module,
  notes: Note[],
  syncMarker: string
) {
  let uploadedCount = 0;

  for (let index = 0; index < notes.length; index += FIRESTORE_BATCH_LIMIT) {
    const nextBatch = writeBatch(firestore);
    const chunk = notes.slice(index, index + FIRESTORE_BATCH_LIMIT);

    for (const note of chunk) {
      const serializedNote = await serializeNoteForFirebase(note, syncMarker);
      nextBatch.set(doc(notesCollection, note.id), serializedNote, { merge: true });
    }

    await nextBatch.commit();
    uploadedCount += chunk.length;
  }

  return uploadedCount;
}

async function mergeRemoteNotesFromFirebase(
  notesCollection: FirestoreCollection,
  localNotes: Note[],
  options: { since: string | null }
): Promise<RemoteMergeResult> {
  const localNoteMap = new Map(localNotes.map((note) => [note.id, note]));
  const remoteRef = options.since
    ? query(notesCollection, where('syncedAt', '>', options.since), orderBy('syncedAt', 'asc'))
    : notesCollection;
  const snapshot = await getDocs(remoteRef);
  let importedCount = 0;
  let latestSyncedAt: string | null = options.since;

  for (const snapshotDoc of snapshot.docs) {
    const nextRemoteRecord = {
      ...snapshotDoc.data(),
      id: snapshotDoc.id,
    } as FirebaseNoteRecord;
    const existingLocalNote =
      localNoteMap.get(nextRemoteRecord.id) ?? (await getNoteById(nextRemoteRecord.id));
    const nextLocalNote = await deserializeRemoteNote(nextRemoteRecord, existingLocalNote);
    if (!nextLocalNote) {
      latestSyncedAt = nextRemoteRecord.syncedAt ?? latestSyncedAt;
      continue;
    }

    if (existingLocalNote && getSyncTimestamp(existingLocalNote) >= getSyncTimestamp(nextLocalNote)) {
      latestSyncedAt = nextRemoteRecord.syncedAt ?? latestSyncedAt;
      continue;
    }

    await upsertNote(nextLocalNote);
    localNoteMap.set(nextLocalNote.id, nextLocalNote);
    importedCount += 1;
    latestSyncedAt = nextRemoteRecord.syncedAt ?? latestSyncedAt;
  }

  return { importedCount, latestSyncedAt };
}

const sqliteSyncRepository: SyncRepository = {
  async enqueue(change) {
    const db = await getDB();
    const serializedPayload =
      change.payload === undefined ? null : JSON.stringify(change.payload);
    await db.runAsync(
      `INSERT INTO sync_queue (
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
       VALUES (?, ?, ?, ?, 'pending', 0, NULL, NULL, 0, NULL, ?)`,
      change.entity,
      change.entityId ?? null,
      change.type,
      serializedPayload,
      change.timestamp
    );
  },

  async listPending(limit = 100) {
    const db = await getDB();
    const now = new Date().toISOString();
    const rows = await db.getAllAsync<QueueRow>(
      `SELECT *
       FROM sync_queue
       WHERE status IN ('pending', 'failed')
         AND terminal = 0
         AND (next_retry_at IS NULL OR next_retry_at <= ?)
       ORDER BY created_at ASC
       LIMIT ?`,
      now,
      limit
    );
    return rows.map(rowToQueueItem);
  },

  async markProcessing(id) {
    const db = await getDB();
    await db.runAsync(
      `UPDATE sync_queue
       SET status = 'processing',
           attempts = attempts + 1,
           last_error = NULL,
           blocked_reason = NULL
       WHERE id = ?`,
      id
    );
  },

  async getStats() {
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
       FROM sync_queue`
    );

    return {
      pendingCount: row?.pending_count ?? 0,
      failedCount: row?.failed_count ?? 0,
      blockedCount: row?.blocked_count ?? 0,
    };
  },

  async markFailed(id, details) {
    const db = await getDB();
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
       WHERE id = ?`,
      normalizedDetails?.error ?? null,
      normalizedDetails?.nextRetryAt ?? null,
      normalizedDetails?.terminal ? 1 : 0,
      normalizedDetails?.blockedReason ?? null,
      id
    );
  },

  async markDone(id) {
    const db = await getDB();
    await db.runAsync('DELETE FROM sync_queue WHERE id = ?', id);
  },

  async clearAll() {
    const db = await getDB();
    await db.runAsync('DELETE FROM sync_queue');
  },
};

const localFirstSyncService: SyncService = {
  isAvailable: Boolean(getFirestore()),
  async recordChange(change) {
    try {
      await sqliteSyncRepository.enqueue(change);
    } catch (error) {
      console.warn('[syncService] Failed to enqueue sync change:', error);
    }
  },
};

export async function syncNotesToFirebase(
  user: SyncUser | null,
  notes: Note[],
  options: SyncOptions = {}
): Promise<FirebaseSyncResult> {
  if (!user) {
    return {
      status: 'unavailable',
      message: 'Sign in to sync your notes.',
    };
  }

  const firestore = getFirestore();
  if (!firestore) {
    return {
      status: 'unavailable',
      message: 'Firebase sync is unavailable in this build.',
    };
  }

  const requestedMode = options.mode ?? 'incremental';

  try {
    const syncRepository = getSyncRepository();
    const notesCollection = collection(firestore, 'users', user.uid, 'notes');
    const syncMarker = new Date().toISOString();
    const lastRemoteCursor = await getLastRemoteSyncCursor(user.uid);
    const mode: SyncMode =
      requestedMode === 'full' || !lastRemoteCursor ? 'full' : 'incremental';

    const queueResult = await flushPendingQueueToFirebase(
      notesCollection,
      firestore,
      syncRepository,
      notes,
      syncMarker
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
      const remoteMergeResult = await mergeRemoteNotesFromFirebase(notesCollection, notes, { since: null });
      importedCount = remoteMergeResult.importedCount;
      const latestLocalNotes = remoteMergeResult.importedCount > 0 ? await getAllNotes() : notes;
      finalNoteCount = latestLocalNotes.length;
      finalPhotoNoteCount = countPhotoNotes(latestLocalNotes);
      uploadedSnapshotCount = await uploadLocalSnapshotToFirebase(
        notesCollection,
        firestore,
        latestLocalNotes,
        syncMarker
      );
      nextCursor = syncMarker;
    } else {
      const remoteMergeResult = await mergeRemoteNotesFromFirebase(notesCollection, notes, {
        since: lastRemoteCursor,
      });
      importedCount = remoteMergeResult.importedCount;
      if (remoteMergeResult.latestSyncedAt && remoteMergeResult.latestSyncedAt > nextCursor) {
        nextCursor = remoteMergeResult.latestSyncedAt;
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

    await Promise.all([
      setDoc(
        doc(firestore, 'users', user.uid),
        {
          displayName: user.displayName ?? null,
          photoURL: user.photoURL ?? null,
          noteCount: finalNoteCount,
          photoNoteCount: finalPhotoNoteCount,
          lastSyncedAt: syncMarker,
        },
        { merge: true }
      ),
      upsertPublicUserProfile({
        userUid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
      }),
      setLastRemoteSyncCursor(user.uid, nextCursor),
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
          ? 'Synced 1 note with Firebase.'
          : `Synced ${syncedCount} notes with Firebase.`,
    };
  } catch (error) {
    console.warn('[syncService] Firebase sync failed:', error);
    return {
      status: 'error',
      message: 'Unable to sync with Firebase right now. Please try again later.',
    };
  }
}

export function getSyncRepository(): SyncRepository {
  return sqliteSyncRepository;
}

export function getSyncService(): SyncService {
  return {
    ...localFirstSyncService,
    isAvailable: Boolean(getFirestore()),
  };
}

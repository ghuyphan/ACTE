import firestoreModule from '@react-native-firebase/firestore';
import { Note, getDB, getNoteById, upsertNote } from './database';
import { readPhotoAsBase64, writePhotoFromBase64 } from './photoStorage';
import { getFirestore } from '../utils/firebase';

export type SyncChangeType = 'create' | 'update' | 'delete' | 'deleteAll';
export type SyncQueueStatus = 'pending' | 'processing' | 'failed';

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
  createdAt: string;
}

export interface SyncRepository {
  enqueue: (change: SyncChange) => Promise<void>;
  listPending: (limit?: number) => Promise<SyncQueueItem[]>;
  markProcessing: (id: number) => Promise<void>;
  markFailed: (id: number, error?: string) => Promise<void>;
  markDone: (id: number) => Promise<void>;
  clearAll: () => Promise<void>;
}

export interface SyncService {
  isAvailable: boolean;
  recordChange: (change: SyncChange) => Promise<void>;
}

export interface FirebaseSyncUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface FirebaseSyncResult {
  status: 'success' | 'unavailable' | 'error';
  message?: string;
  syncedCount?: number;
  uploadedCount?: number;
  importedCount?: number;
  failedCount?: number;
}

interface FirebaseNoteRecord {
  id: string;
  type: Note['type'];
  content: string;
  photoRemoteBase64?: string | null;
  locationName: string | null;
  latitude: number;
  longitude: number;
  radius: number;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string | null;
}

interface FlushQueueResult {
  processedCount: number;
  failedCount: number;
  lastError: string | null;
}

interface RemoteMergeResult {
  importedCount: number;
}

const FIRESTORE_BATCH_LIMIT = 400;

function rowToQueueItem(row: any): SyncQueueItem {
  return {
    id: row.id,
    entity: row.entity,
    entityId: row.entity_id,
    operation: row.operation,
    payload: row.payload,
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error,
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

async function serializeNoteForFirebase(note: Note): Promise<FirebaseNoteRecord> {
  let photoRemoteBase64 = note.photoRemoteBase64 ?? null;

  if (note.type === 'photo' && !photoRemoteBase64) {
    photoRemoteBase64 = await readPhotoAsBase64(note.photoLocalUri ?? note.content);
  }

  return {
    id: note.id,
    type: note.type,
    content: note.type === 'text' ? note.content : '',
    photoRemoteBase64,
    locationName: note.locationName,
    latitude: note.latitude,
    longitude: note.longitude,
    radius: note.radius,
    isFavorite: note.isFavorite,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
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
    latitude: record.latitude,
    longitude: record.longitude,
    radius: typeof record.radius === 'number' ? record.radius : 150,
    isFavorite: Boolean(record.isFavorite),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt ?? null,
  };
}

async function commitBatch({
  batch,
  itemIds,
  syncRepository,
}: {
  batch: { commit: () => Promise<void> };
  itemIds: number[];
  syncRepository: SyncRepository;
}) {
  if (itemIds.length === 0) {
    return { processedCount: 0, failedCount: 0, error: null as string | null };
  }

  try {
    await batch.commit();
    await Promise.all(itemIds.map((id) => syncRepository.markDone(id)));
    return { processedCount: itemIds.length, failedCount: 0, error: null as string | null };
  } catch (error) {
    const message = getErrorMessage(error);
    await Promise.all(itemIds.map((id) => syncRepository.markFailed(id, message)));
    return { processedCount: 0, failedCount: itemIds.length, error: message };
  }
}

async function deleteAllRemoteNotesInChunks(
  notesCollection: {
    get: () => Promise<{ docs: Array<{ ref: unknown }> }>;
  },
  firestore: {
    batch: () => {
      delete: (ref: unknown) => void;
      commit: () => Promise<void>;
    };
  }
) {
  const snapshot = await notesCollection.get();
  const docs = snapshot.docs ?? [];

  for (let index = 0; index < docs.length; index += FIRESTORE_BATCH_LIMIT) {
    const nextBatch = firestore.batch();
    const chunk = docs.slice(index, index + FIRESTORE_BATCH_LIMIT);
    chunk.forEach((doc) => {
      nextBatch.delete(doc.ref);
    });
    await nextBatch.commit();
  }
}

async function flushPendingQueueToFirebase(
  notesCollection: {
    doc: (id: string) => { set: (data: unknown, options?: unknown) => void; delete: () => void };
    get: () => Promise<{ docs: Array<{ ref: unknown }> }>;
  },
  firestore: {
    batch: () => {
      set: (ref: unknown, data: unknown, options?: unknown) => void;
      delete: (ref: unknown) => void;
      commit: () => Promise<void>;
    };
  },
  syncRepository: SyncRepository,
  notes: Note[]
): Promise<FlushQueueResult> {
  const pendingChanges = await syncRepository.listPending(5000);
  const noteMap = new Map(notes.map((note) => [note.id, note]));

  let currentBatch = firestore.batch();
  let currentBatchItemIds: number[] = [];
  let currentBatchOps = 0;
  let processedCount = 0;
  let failedCount = 0;
  let lastError: string | null = null;

  const commitCurrentBatch = async () => {
    const result = await commitBatch({
      batch: currentBatch,
      itemIds: currentBatchItemIds,
      syncRepository,
    });
    processedCount += result.processedCount;
    failedCount += result.failedCount;
    lastError = result.error ?? lastError;
    currentBatch = firestore.batch();
    currentBatchItemIds = [];
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
      } catch (error) {
        lastError = getErrorMessage(error);
        failedCount += 1;
        await syncRepository.markFailed(change.id, lastError);
      }
      continue;
    }

    if (!change.entityId) {
      await syncRepository.markDone(change.id);
      processedCount += 1;
      continue;
    }

    try {
      const docRef = notesCollection.doc(change.entityId);
      if (change.operation === 'delete') {
        currentBatch.delete(docRef);
      } else {
        const note = noteMap.get(change.entityId);
        if (!note) {
          currentBatch.delete(docRef);
        } else {
          const serializedNote = await serializeNoteForFirebase(note);
          currentBatch.set(
            docRef,
            {
              ...serializedNote,
              syncedAt: firestoreModule.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      }

      currentBatchItemIds.push(change.id);
      currentBatchOps += 1;

      if (currentBatchOps >= FIRESTORE_BATCH_LIMIT) {
        await commitCurrentBatch();
      }
    } catch (error) {
      lastError = getErrorMessage(error);
      failedCount += 1;
      await syncRepository.markFailed(change.id, lastError);
    }
  }

  await commitCurrentBatch();

  return {
    processedCount,
    failedCount,
    lastError,
  };
}

async function uploadLocalSnapshotToFirebase(
  notesCollection: {
    doc: (id: string) => unknown;
  },
  firestore: {
    batch: () => {
      set: (ref: unknown, data: unknown, options?: unknown) => void;
      commit: () => Promise<void>;
    };
  },
  notes: Note[]
) {
  let uploadedCount = 0;

  for (let index = 0; index < notes.length; index += FIRESTORE_BATCH_LIMIT) {
    const nextBatch = firestore.batch();
    const chunk = notes.slice(index, index + FIRESTORE_BATCH_LIMIT);

    for (const note of chunk) {
      const serializedNote = await serializeNoteForFirebase(note);
      nextBatch.set(
        notesCollection.doc(note.id),
        {
          ...serializedNote,
          syncedAt: firestoreModule.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    await nextBatch.commit();
    uploadedCount += chunk.length;
  }

  return uploadedCount;
}

async function mergeRemoteNotesFromFirebase(
  notesCollection: {
    get: () => Promise<{ docs: Array<{ id: string; data: () => FirebaseNoteRecord }> }>;
  },
  localNotes: Note[]
): Promise<RemoteMergeResult> {
  const localNoteMap = new Map(localNotes.map((note) => [note.id, note]));
  const snapshot = await notesCollection.get();
  let importedCount = 0;

  for (const doc of snapshot.docs) {
    const nextRemoteRecord = {
      id: doc.id,
      ...doc.data(),
    } as FirebaseNoteRecord;
    const existingLocalNote = localNoteMap.get(nextRemoteRecord.id) ?? (await getNoteById(nextRemoteRecord.id));
    const nextLocalNote = await deserializeRemoteNote(nextRemoteRecord, existingLocalNote);
    if (!nextLocalNote) {
      continue;
    }

    if (existingLocalNote && getSyncTimestamp(existingLocalNote) >= getSyncTimestamp(nextLocalNote)) {
      continue;
    }

    await upsertNote(nextLocalNote);
    importedCount += 1;
  }

  return { importedCount };
}

const sqliteSyncRepository: SyncRepository = {
  async enqueue(change) {
    const db = await getDB();
    const serializedPayload =
      change.payload === undefined ? null : JSON.stringify(change.payload);
    await db.runAsync(
      `INSERT INTO sync_queue (entity, entity_id, operation, payload, status, attempts, created_at)
       VALUES (?, ?, ?, ?, 'pending', 0, ?)`,
      change.entity,
      change.entityId ?? null,
      change.type,
      serializedPayload,
      change.timestamp
    );
  },

  async listPending(limit = 100) {
    const db = await getDB();
    const rows = await db.getAllAsync(
      `SELECT *
       FROM sync_queue
       WHERE status IN ('pending', 'failed')
       ORDER BY created_at ASC
       LIMIT ?`,
      limit
    );
    return rows.map(rowToQueueItem);
  },

  async markProcessing(id) {
    const db = await getDB();
    await db.runAsync(
      `UPDATE sync_queue
       SET status = 'processing', attempts = attempts + 1, last_error = NULL
       WHERE id = ?`,
      id
    );
  },

  async markFailed(id, error) {
    const db = await getDB();
    await db.runAsync(
      `UPDATE sync_queue
       SET status = 'failed', last_error = ?
       WHERE id = ?`,
      error ?? null,
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
  user: FirebaseSyncUser | null,
  notes: Note[]
): Promise<FirebaseSyncResult> {
  if (!user) {
    return {
      status: 'unavailable',
      message: 'Sign in with Google before syncing your notes.',
    };
  }

  const firestore = getFirestore();
  if (!firestore) {
    return {
      status: 'unavailable',
      message: 'Firebase sync is unavailable in this build.',
    };
  }

  try {
    const syncRepository = getSyncRepository();
    const notesCollection = firestore.collection('users').doc(user.uid).collection('notes');
    const queueResult = await flushPendingQueueToFirebase(
      notesCollection,
      firestore as unknown as {
        batch: () => {
          set: (ref: unknown, data: unknown, options?: unknown) => void;
          delete: (ref: unknown) => void;
          commit: () => Promise<void>;
        };
      },
      syncRepository,
      notes
    );
    if (queueResult.failedCount > 0) {
      return {
        status: 'error',
        syncedCount: queueResult.processedCount,
        uploadedCount: 0,
        importedCount: 0,
        failedCount: queueResult.failedCount,
        message:
          queueResult.lastError ??
          'Some notes could not be synced. Please try again after checking your photo sizes and connection.',
      };
    }

    const uploadedSnapshotCount = await uploadLocalSnapshotToFirebase(
      notesCollection,
      firestore as unknown as {
        batch: () => {
          set: (ref: unknown, data: unknown, options?: unknown) => void;
          commit: () => Promise<void>;
        };
      },
      notes
    );
    const remoteMergeResult = await mergeRemoteNotesFromFirebase(notesCollection, notes);

    await firestore.collection('users').doc(user.uid).set(
      {
        displayName: user.displayName ?? null,
        email: user.email ?? null,
        photoURL: user.photoURL ?? null,
        noteCount: notes.length,
        lastSyncedAt: firestoreModule.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const syncedCount = uploadedSnapshotCount + remoteMergeResult.importedCount;
    return {
      status: 'success',
      syncedCount,
      uploadedCount: uploadedSnapshotCount,
      importedCount: remoteMergeResult.importedCount,
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

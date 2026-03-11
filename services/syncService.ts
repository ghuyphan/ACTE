import firestoreModule from '@react-native-firebase/firestore';
import { Note } from './database';
import { getDB } from './database';
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
}

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
  isAvailable: false,
  async recordChange(change) {
    try {
      await sqliteSyncRepository.enqueue(change);
    } catch (error) {
      console.warn('[syncService] Failed to enqueue sync change:', error);
    }
  },
};

function serializeNoteForFirebase(note: Note) {
  return {
    id: note.id,
    type: note.type,
    content: note.content,
    locationName: note.locationName,
    latitude: note.latitude,
    longitude: note.longitude,
    radius: note.radius,
    isFavorite: note.isFavorite,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    syncedAt: firestoreModule.FieldValue.serverTimestamp(),
  };
}

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
    const pendingChanges = await syncRepository.listPending(5000);
    const notesCollection = firestore.collection('users').doc(user.uid).collection('notes');
    const deletedNoteIds = new Set(
      pendingChanges
        .filter((change) => change.operation === 'delete' && change.entityId)
        .map((change) => change.entityId as string)
    );
    const shouldDeleteAll = pendingChanges.some((change) => change.operation === 'deleteAll');

    if (shouldDeleteAll) {
      const remoteSnapshot = await notesCollection.get();
      for (const doc of remoteSnapshot.docs) {
        await doc.ref.delete();
      }
    } else {
      for (const noteId of deletedNoteIds) {
        await notesCollection.doc(noteId).delete();
      }
    }

    for (const note of notes) {
      await notesCollection.doc(note.id).set(serializeNoteForFirebase(note), { merge: true });
    }

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

    await syncRepository.clearAll();

    return {
      status: 'success',
      syncedCount: notes.length,
      message:
        notes.length === 1
          ? 'Synced 1 note to Firebase.'
          : `Synced ${notes.length} notes to Firebase.`,
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
  return localFirstSyncService;
}

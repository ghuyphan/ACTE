import { getDB } from './database';

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

export function getSyncRepository(): SyncRepository {
  return sqliteSyncRepository;
}

export function getSyncService(): SyncService {
  return localFirstSyncService;
}

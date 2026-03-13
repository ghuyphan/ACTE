type QueueRow = {
  id: number;
  entity: 'note';
  entity_id: string | null;
  operation: 'create' | 'update' | 'delete' | 'deleteAll';
  payload: string | null;
  status: 'pending' | 'processing' | 'failed';
  attempts: number;
  last_error: string | null;
  created_at: string;
};

let queueRows: QueueRow[] = [];
let queueId = 1;
const mockRemoteNotes = new Map<string, any>();

const mockRemoteSet = jest.fn(async (id: string, data: unknown, _options?: unknown) => {
  mockRemoteNotes.set(id, data);
});
const mockRemoteDelete = jest.fn(async (id: string) => {
  mockRemoteNotes.delete(id);
});
const mockUserSet = jest.fn(async (_data?: unknown, _options?: unknown) => undefined);
const mockUpsertNote = jest.fn<Promise<unknown>, [unknown]>(async (note: unknown) => note);
const mockGetNoteById = jest.fn<Promise<null>, [string]>(async () => null);
const mockReadPhotoAsBase64 = jest.fn<Promise<string>, [string]>(async () => 'base64-photo');
const mockWritePhotoFromBase64 = jest.fn<Promise<string>, [string, string]>(
  async (noteId: string) => `file:///synced/${noteId}.jpg`
);

const mockRunAsync = jest.fn(async (sql: string, ...args: any[]) => {
  if (sql.includes('INSERT INTO sync_queue')) {
    const [entity, entityId, operation, payload, createdAt] = args;
    queueRows.push({
      id: queueId++,
      entity,
      entity_id: entityId,
      operation,
      payload,
      status: 'pending',
      attempts: 0,
      last_error: null,
      created_at: createdAt,
    });
    return;
  }

  if (sql.includes("SET status = 'processing'")) {
    const [id] = args;
    queueRows = queueRows.map((row) =>
      row.id === id
        ? { ...row, status: 'processing', attempts: row.attempts + 1, last_error: null }
        : row
    );
    return;
  }

  if (sql.includes("SET status = 'failed'")) {
    const [lastError, id] = args;
    queueRows = queueRows.map((row) =>
      row.id === id ? { ...row, status: 'failed', last_error: lastError } : row
    );
    return;
  }

  if (sql.includes('DELETE FROM sync_queue WHERE id = ?')) {
    const [id] = args;
    queueRows = queueRows.filter((row) => row.id !== id);
    return;
  }

  if (sql.includes('DELETE FROM sync_queue')) {
    queueRows = [];
  }
});

const mockGetAllAsync = jest.fn(async (_sql: string, limit: number) =>
  queueRows
    .filter((row) => row.status === 'pending' || row.status === 'failed')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, limit)
);

jest.mock('../services/database', () => ({
  getDB: async () => ({
    runAsync: (...args: any[]) => mockRunAsync(args[0], ...args.slice(1)),
    getAllAsync: (sql: string, limit: number) => mockGetAllAsync(sql, limit),
  }),
  getNoteById: (id: string) => mockGetNoteById(id),
  upsertNote: (note: unknown) => mockUpsertNote(note),
}));

jest.mock('../services/photoStorage', () => ({
  readPhotoAsBase64: (photoUri: string) => mockReadPhotoAsBase64(photoUri),
  writePhotoFromBase64: (noteId: string, base64Data: string) =>
    mockWritePhotoFromBase64(noteId, base64Data),
}));

function mockCreateDocRef(id: string) {
  return {
    id,
    set: (data: unknown, options: unknown) => mockRemoteSet(id, data, options),
    delete: () => mockRemoteDelete(id),
  };
}

jest.mock('../utils/firebase', () => ({
  getFirestore: () => ({
    batch: () => {
      const ops: Array<() => Promise<void>> = [];
      return {
        set: (ref: { id: string }, data: unknown, options?: unknown) => {
          ops.push(() => mockRemoteSet(ref.id, data, options));
        },
        delete: (ref: { id: string }) => {
          ops.push(() => mockRemoteDelete(ref.id));
        },
        commit: async () => {
          for (const op of ops) {
            await op();
          }
        },
      };
    },
    collection: () => ({
      doc: () => ({
        collection: () => ({
          doc: (id: string) => mockCreateDocRef(id),
          get: async () => ({
            docs: Array.from(mockRemoteNotes.entries()).map(([id, data]) => ({
              id,
              ref: { id, delete: () => mockRemoteDelete(id) },
              data: () => data,
            })),
          }),
        }),
        set: (data: unknown, options: unknown) => mockUserSet(data, options),
      }),
    }),
  }),
}));

jest.mock('@react-native-firebase/firestore', () => ({
  __esModule: true,
  default: {
    FieldValue: {
      serverTimestamp: () => 'SERVER_TIMESTAMP',
    },
  },
}));

import { getSyncRepository, getSyncService, syncNotesToFirebase } from '../services/syncService';

beforeEach(() => {
  jest.clearAllMocks();
  queueRows = [];
  queueId = 1;
  mockRemoteNotes.clear();
});

describe('syncService', () => {
  it('records changes into persistent sync queue', async () => {
    const service = getSyncService();
    await service.recordChange({
      type: 'create',
      entity: 'note',
      entityId: 'note-1',
      payload: { content: 'hello' },
      timestamp: '2026-03-10T00:00:00.000Z',
    });

    expect(queueRows).toHaveLength(1);
    expect(queueRows[0]).toEqual(
      expect.objectContaining({
        operation: 'create',
        entity_id: 'note-1',
        status: 'pending',
      })
    );
  });

  it('supports queue repository lifecycle methods', async () => {
    const repo = getSyncRepository();

    await repo.enqueue({
      type: 'update',
      entity: 'note',
      entityId: 'note-2',
      payload: { content: 'updated' },
      timestamp: '2026-03-10T01:00:00.000Z',
    });

    const pending = await repo.listPending(20);
    expect(pending).toHaveLength(1);
    expect(pending[0].operation).toBe('update');

    await repo.markProcessing(pending[0].id);
    expect(queueRows[0].status).toBe('processing');
    expect(queueRows[0].attempts).toBe(1);

    await repo.markFailed(pending[0].id, 'network failed');
    expect(queueRows[0].status).toBe('failed');
    expect(queueRows[0].last_error).toBe('network failed');

    await repo.markDone(pending[0].id);
    expect(queueRows).toHaveLength(0);
  });

  it('syncs queued deletions and uploads a local backup snapshot to Firebase', async () => {
    mockRemoteNotes.set('note-deleted', { id: 'note-deleted', type: 'text', content: 'gone' });

    const repo = getSyncRepository();
    await repo.enqueue({
      type: 'delete',
      entity: 'note',
      entityId: 'note-deleted',
      timestamp: '2026-03-10T02:00:00.000Z',
    });

    const result = await syncNotesToFirebase(
      {
        uid: 'user-1',
        displayName: 'Test User',
        email: 'test@example.com',
        photoURL: null,
      },
      [
        {
          id: 'note-1',
          type: 'text',
          content: 'hello',
          photoLocalUri: null,
          photoRemoteBase64: null,
          locationName: 'Saigon',
          latitude: 10.77,
          longitude: 106.69,
          radius: 150,
          isFavorite: false,
          createdAt: '2026-03-10T00:00:00.000Z',
          updatedAt: null,
        },
      ]
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'success',
        syncedCount: 1,
        uploadedCount: 1,
      })
    );
    expect(mockRemoteDelete).toHaveBeenCalledWith('note-deleted');
    expect(mockRemoteSet).toHaveBeenCalledWith(
      'note-1',
      expect.objectContaining({
        id: 'note-1',
        content: 'hello',
        syncedAt: 'SERVER_TIMESTAMP',
      }),
      { merge: true }
    );
    expect(mockUserSet).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'Test User',
        email: 'test@example.com',
        noteCount: 1,
        lastSyncedAt: 'SERVER_TIMESTAMP',
      }),
      { merge: true }
    );
    expect(queueRows).toHaveLength(0);
  });
});

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
}));

import { getSyncRepository, getSyncService } from '../services/syncService';

beforeEach(() => {
  jest.clearAllMocks();
  queueRows = [];
  queueId = 1;
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
});

import AsyncStorage from '@react-native-async-storage/async-storage';

type QueueRow = {
  id: number;
  entity: 'note';
  entity_id: string | null;
  operation: 'create' | 'update' | 'delete' | 'deleteAll';
  payload: string | null;
  status: 'pending' | 'processing' | 'failed';
  attempts: number;
  last_error: string | null;
  next_retry_at: string | null;
  terminal: number;
  blocked_reason: string | null;
  created_at: string;
};

type NoteRecord = {
  id: string;
  type: 'text' | 'photo';
  content: string;
  photoLocalUri: string | null;
  photoRemoteBase64: string | null;
  hasDoodle?: boolean;
  doodleStrokesJson?: string | null;
  locationName: string | null;
  latitude: number;
  longitude: number;
  radius: number;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string | null;
};

let queueRows: QueueRow[] = [];
let queueId = 1;
let localNotesStore: NoteRecord[] = [];
const mockRemoteNotes = new Map<string, any>();
const mockUserDocs = new Map<string, any>();
const mockPublicProfiles = new Map<string, any>();

const mockNoteRemoteSet = jest.fn(async (id: string, data: unknown, _options?: unknown) => {
  mockRemoteNotes.set(id, data);
});
const mockRemoteDelete = jest.fn(async (id: string) => {
  mockRemoteNotes.delete(id);
});
const mockUserSet = jest.fn(async (userUid: string, data: unknown, _options?: unknown) => {
  mockUserDocs.set(userUid, data);
});
const mockPublicProfileSet = jest.fn(async (userUid: string, data: unknown, _options?: unknown) => {
  mockPublicProfiles.set(userUid, data);
});
const mockUpsertNote = jest.fn<Promise<unknown>, [NoteRecord]>(async (note: NoteRecord) => {
  localNotesStore = [note, ...localNotesStore.filter((item) => item.id !== note.id)];
  return note;
});
const mockGetNoteById = jest.fn<Promise<NoteRecord | null>, [string]>(async (id: string) => {
  return localNotesStore.find((note) => note.id === id) ?? null;
});
const mockGetAllNotes = jest.fn<Promise<NoteRecord[]>, []>(async () => localNotesStore);
const mockReadPhotoAsBase64 = jest.fn<Promise<string>, [string]>(async () => 'base64-photo');
const mockWritePhotoFromBase64 = jest.fn<Promise<string>, [string, string]>(
  async (noteId: string) => `file:///synced/${noteId}.jpg`
);
const mockBatchCommit = jest.fn(async () => undefined);

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
      next_retry_at: null,
      terminal: 0,
      blocked_reason: null,
      created_at: createdAt,
    });
    return;
  }

  if (sql.includes("SET status = 'processing'")) {
    const [id] = args;
    queueRows = queueRows.map((row) =>
      row.id === id
        ? {
            ...row,
            status: 'processing',
            attempts: row.attempts + 1,
            last_error: null,
            blocked_reason: null,
          }
        : row
    );
    return;
  }

  if (sql.includes("SET status = 'failed'")) {
    const [lastError, nextRetryAt, terminal, blockedReason, id] = args;
    queueRows = queueRows.map((row) =>
      row.id === id
        ? {
            ...row,
            status: 'failed',
            last_error: lastError,
            next_retry_at: nextRetryAt,
            terminal,
            blocked_reason: blockedReason,
          }
        : row
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

const mockGetAllAsync = jest.fn(async (_sql: string, now: string, limit: number) =>
  queueRows
    .filter((row) => (row.status === 'pending' || row.status === 'failed') && row.terminal === 0)
    .filter((row) => !row.next_retry_at || row.next_retry_at <= now)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, limit)
);

jest.mock('../services/database', () => ({
  getDB: async () => ({
    runAsync: (sql: string, ...args: any[]) => mockRunAsync(sql, ...args),
    getAllAsync: (sql: string, now: string, limit: number) => mockGetAllAsync(sql, now, limit),
  }),
  getAllNotes: () => mockGetAllNotes(),
  getNoteById: (id: string) => mockGetNoteById(id),
  upsertNote: (note: NoteRecord) => mockUpsertNote(note),
}));

jest.mock('../services/photoStorage', () => ({
  readPhotoAsBase64: (photoUri: string) => mockReadPhotoAsBase64(photoUri),
  writePhotoFromBase64: (noteId: string, base64Data: string) =>
    mockWritePhotoFromBase64(noteId, base64Data),
}));

jest.mock('../services/publicProfileService', () => ({
  upsertPublicUserProfile: (input: { userUid: string; displayName: string | null; photoURL: string | null }) =>
    mockPublicProfileSet(input.userUid, input),
}));

jest.mock('../utils/firebase', () => ({
  getFirestore: () => ({}),
}));

function mockResolvePath(refOrCollection: any, pathSegments: string[]) {
  if (refOrCollection?.kind === 'collection' || refOrCollection?.kind === 'doc') {
    return [...refOrCollection.path, ...pathSegments];
  }

  return pathSegments;
}

jest.mock('@react-native-firebase/firestore', () => ({
  __esModule: true,
  collection: (_firestore: unknown, ...path: string[]) => ({ kind: 'collection', path }),
  doc: (refOrFirestore: unknown, ...path: string[]) => ({
    kind: 'doc',
    path: mockResolvePath(refOrFirestore, path),
    id: mockResolvePath(refOrFirestore, path).slice(-1)[0],
  }),
  query: (ref: any, ...constraints: any[]) => ({ kind: 'query', ref, constraints }),
  where: (field: string, op: string, value: unknown) => ({ type: 'where', field, op, value }),
  orderBy: (field: string, direction: 'asc' | 'desc' = 'asc') => ({ type: 'orderBy', field, direction }),
  setDoc: async (ref: any, data: any, options?: unknown) => {
    const path = ref.path as string[];
    if (path.length === 2 && path[0] === 'users') {
      await mockUserSet(path[1]!, data, options);
      return;
    }
    if (path.length === 2 && path[0] === 'publicUserProfiles') {
      await mockPublicProfileSet(path[1]!, data, options);
      return;
    }
    if (path.length === 4 && path[0] === 'users' && path[2] === 'notes') {
      await mockNoteRemoteSet(path[3]!, data, options);
    }
  },
  writeBatch: () => {
    const ops: Array<() => Promise<void>> = [];
    return {
      set: (ref: any, data: unknown, options?: unknown) => {
        ops.push(() => mockNoteRemoteSet(ref.id, data, options));
      },
      delete: (ref: any) => {
        ops.push(() => mockRemoteDelete(ref.id));
      },
      commit: async () => {
        await mockBatchCommit();
        for (const op of ops) {
          await op();
        }
      },
    };
  },
  getDocs: async (refOrQuery: any) => {
    const target = refOrQuery.kind === 'query' ? refOrQuery.ref : refOrQuery;
    const constraints = refOrQuery.kind === 'query' ? refOrQuery.constraints : [];
    const whereConstraint = constraints.find((item: any) => item.type === 'where');
    const orderConstraint = constraints.find((item: any) => item.type === 'orderBy');
    const path = target.path as string[];

    if (path.length === 3 && path[0] === 'users' && path[2] === 'notes') {
      let docs = Array.from(mockRemoteNotes.entries()).map(([id, data]) => ({
        id,
        data,
      }));

      if (whereConstraint?.field === 'syncedAt' && whereConstraint.op === '>') {
        docs = docs.filter(({ data }) => String(data?.syncedAt ?? '') > String(whereConstraint.value ?? ''));
      }

      if (orderConstraint?.field === 'syncedAt') {
        docs = [...docs].sort((left, right) => {
          const leftValue = String(left.data?.syncedAt ?? '');
          const rightValue = String(right.data?.syncedAt ?? '');
          return orderConstraint.direction === 'desc'
            ? rightValue.localeCompare(leftValue)
            : leftValue.localeCompare(rightValue);
        });
      }

      return {
        docs: docs.map(({ id, data }) => ({
          id,
          ref: { id },
          data: () => data,
        })),
      };
    }

    return { docs: [] };
  },
}));

import { getSyncRepository, getSyncService, syncNotesToFirebase } from '../services/syncService';

function createTextNote(id: string, content = `note ${id}`): NoteRecord {
  return {
    id,
    type: 'text',
    content,
    photoLocalUri: null,
    photoRemoteBase64: null,
    locationName: 'Saigon',
    latitude: 10.77,
    longitude: 106.69,
    radius: 150,
    isFavorite: false,
    createdAt: '2026-03-10T00:00:00.000Z',
    updatedAt: null,
  };
}

function createPhotoNote(id: string): NoteRecord {
  return {
    ...createTextNote(id),
    type: 'photo',
    content: `file:///photos/${id}.jpg`,
    photoLocalUri: `file:///photos/${id}.jpg`,
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  queueRows = [];
  queueId = 1;
  localNotesStore = [];
  mockRemoteNotes.clear();
  mockUserDocs.clear();
  mockPublicProfiles.clear();
  mockBatchCommit.mockResolvedValue(undefined);
  mockReadPhotoAsBase64.mockResolvedValue('base64-photo');
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
        terminal: 0,
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

    await repo.markFailed(pending[0].id, {
      error: 'network failed',
      nextRetryAt: '2026-03-10T01:05:00.000Z',
    });
    expect(queueRows[0].status).toBe('failed');
    expect(queueRows[0].last_error).toBe('network failed');
    expect(queueRows[0].next_retry_at).toBe('2026-03-10T01:05:00.000Z');

    await repo.markDone(pending[0].id);
    expect(queueRows).toHaveLength(0);
  });

  it('syncs queued deletions and performs a full snapshot upload on initial sync', async () => {
    const note = createTextNote('note-1', 'hello');
    localNotesStore = [note];
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
      localNotesStore
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'success',
        syncedCount: 2,
        uploadedCount: 1,
      })
    );
    expect(mockRemoteDelete).toHaveBeenCalledWith('note-deleted');
    expect(mockNoteRemoteSet).toHaveBeenCalledWith(
      'note-1',
      expect.objectContaining({
        id: 'note-1',
        content: 'hello',
        syncedAt: expect.any(String),
      }),
      { merge: true }
    );
    expect(mockUserSet).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        displayName: 'Test User',
        noteCount: 1,
        photoNoteCount: 0,
        lastSyncedAt: expect.any(String),
      }),
      { merge: true }
    );
    expect(mockPublicProfileSet).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        userUid: 'user-1',
        displayName: 'Test User',
      })
    );
    expect(queueRows).toHaveLength(0);
  });

  it('stores the synced remote photo note count on the user profile document', async () => {
    localNotesStore = [createTextNote('note-1'), createPhotoNote('photo-1')];

    const result = await syncNotesToFirebase(
      {
        uid: 'user-1',
        displayName: 'Test User',
        email: 'test@example.com',
        photoURL: null,
      },
      localNotesStore
    );

    expect(result.status).toBe('success');
    expect(mockUserSet).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        noteCount: 2,
        photoNoteCount: 1,
      }),
      { merge: true }
    );
  });

  it('backs off transient failures and skips retrying until the item is due again', async () => {
    const note = createTextNote('note-1', 'retry me');
    localNotesStore = [note];
    mockBatchCommit.mockRejectedValueOnce(new Error('temporary outage'));

    const repo = getSyncRepository();
    await repo.enqueue({
      type: 'update',
      entity: 'note',
      entityId: note.id,
      timestamp: '2026-03-10T03:00:00.000Z',
    });

    const result = await syncNotesToFirebase(
      {
        uid: 'user-1',
        displayName: 'Test User',
        email: 'test@example.com',
        photoURL: null,
      },
      localNotesStore,
      { mode: 'incremental' }
    );

    expect(result.status).toBe('error');
    expect(queueRows[0]).toEqual(
      expect.objectContaining({
        status: 'failed',
        terminal: 0,
        blocked_reason: null,
        next_retry_at: expect.any(String),
      })
    );

    const pendingImmediately = await repo.listPending(20);
    expect(pendingImmediately).toHaveLength(0);

    queueRows[0] = {
      ...queueRows[0]!,
      next_retry_at: '2026-03-10T02:59:00.000Z',
    };

    const pendingAfterWindow = await repo.listPending(20);
    expect(pendingAfterWindow).toHaveLength(1);
  });

  it('marks oversize photo failures as terminal and stops retrying them', async () => {
    const oversizedPhotoNote: NoteRecord = {
      ...createTextNote('photo-1'),
      type: 'photo',
      content: 'file:///photos/photo-1.jpg',
      photoLocalUri: 'file:///photos/photo-1.jpg',
    };
    localNotesStore = [oversizedPhotoNote];
    mockReadPhotoAsBase64.mockRejectedValueOnce(
      new Error('Photo is too large to sync safely. Please retake it with a lower resolution.')
    );

    const repo = getSyncRepository();
    await repo.enqueue({
      type: 'create',
      entity: 'note',
      entityId: oversizedPhotoNote.id,
      timestamp: '2026-03-10T04:00:00.000Z',
    });

    const result = await syncNotesToFirebase(
      {
        uid: 'user-1',
        displayName: 'Test User',
        email: 'test@example.com',
        photoURL: null,
      },
      localNotesStore,
      { mode: 'incremental' }
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        message: expect.stringContaining('too large'),
      })
    );
    expect(queueRows[0]).toEqual(
      expect.objectContaining({
        status: 'failed',
        terminal: 1,
        blocked_reason: expect.stringContaining('lower resolution'),
      })
    );
    expect(await repo.listPending(20)).toHaveLength(0);
  });

  it('syncs only queued changes during incremental sync instead of uploading the whole library', async () => {
    const firstNote = createTextNote('note-1', 'first');
    const secondNote = {
      ...createTextNote('note-2', 'second'),
      hasDoodle: true,
      doodleStrokesJson: JSON.stringify([{ color: '#1C1C1E', points: [0.1, 0.1, 0.3, 0.3] }]),
    };
    localNotesStore = [firstNote, secondNote];
    await AsyncStorage.setItem('sync.lastRemoteCursor.user-1', '2026-03-10T00:00:00.000Z');

    const repo = getSyncRepository();
    await repo.enqueue({
      type: 'update',
      entity: 'note',
      entityId: secondNote.id,
      timestamp: '2026-03-10T05:00:00.000Z',
    });

    const result = await syncNotesToFirebase(
      {
        uid: 'user-1',
        displayName: 'Test User',
        email: 'test@example.com',
        photoURL: null,
      },
      localNotesStore,
      { mode: 'incremental' }
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'success',
        uploadedCount: 0,
        importedCount: 0,
      })
    );
    expect(mockNoteRemoteSet).toHaveBeenCalledTimes(1);
    expect(mockNoteRemoteSet).toHaveBeenCalledWith(
      'note-2',
      expect.objectContaining({
        id: 'note-2',
        content: 'second',
        hasDoodle: true,
        doodleStrokesJson: JSON.stringify([{ color: '#1C1C1E', points: [0.1, 0.1, 0.3, 0.3] }]),
      }),
      { merge: true }
    );
  });

  it('imports newer remote changes during a full resync and re-uploads the merged snapshot', async () => {
    mockRemoteNotes.set('remote-1', {
      id: 'remote-1',
      type: 'text',
      content: 'remote note',
      photoRemoteBase64: null,
      hasDoodle: true,
      doodleStrokesJson: JSON.stringify([{ color: '#1C1C1E', points: [0.2, 0.2, 0.6, 0.6] }]),
      locationName: 'District 1',
      latitude: 10.78,
      longitude: 106.68,
      radius: 150,
      isFavorite: false,
      createdAt: '2026-03-10T00:00:00.000Z',
      updatedAt: '2026-03-10T01:00:00.000Z',
      syncedAt: '2026-03-10T01:00:00.000Z',
    });

    const result = await syncNotesToFirebase(
      {
        uid: 'user-1',
        displayName: 'Test User',
        email: 'test@example.com',
        photoURL: null,
      },
      [],
      { mode: 'full' }
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'success',
        importedCount: 1,
        uploadedCount: 1,
      })
    );
    expect(mockUpsertNote).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'remote-1',
        content: 'remote note',
        hasDoodle: true,
        doodleStrokesJson: JSON.stringify([{ color: '#1C1C1E', points: [0.2, 0.2, 0.6, 0.6] }]),
      })
    );
    expect(mockNoteRemoteSet).toHaveBeenCalledWith(
      'remote-1',
      expect.objectContaining({
        id: 'remote-1',
        content: 'remote note',
        hasDoodle: true,
        doodleStrokesJson: JSON.stringify([{ color: '#1C1C1E', points: [0.2, 0.2, 0.6, 0.6] }]),
      }),
      { merge: true }
    );
  });
});

import AsyncStorage from '@react-native-async-storage/async-storage';

type QueueRow = {
  id: number;
  owner_uid: string;
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
  photoSyncedLocalUri?: string | null;
  photoRemoteBase64: string | null;
  isLivePhoto?: boolean;
  pairedVideoLocalUri?: string | null;
  pairedVideoSyncedLocalUri?: string | null;
  pairedVideoRemotePath?: string | null;
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
};

let queueRows: QueueRow[] = [];
let queueId = 1;
let localNotesStore: NoteRecord[] = [];
const mockRemoteNotes = new Map<string, any>();
const mockRemoteSharedPosts = new Map<string, any>();
const mockRemoteNoteTombstones = new Map<string, any>();
const mockRemoteSharedPostTombstones = new Map<string, any>();
const mockUserUsage = new Map<string, any>();
const mockPublicProfiles = new Map<string, any>();
let mockNotesUpsertError: unknown = null;
const mockActiveNotesScope = 'test-scope';
let mockSessionUserId = 'user-1';

const mockUploadPhotoToStorage = jest.fn<Promise<string | null>, [string, string, string | null | undefined]>(
  async (_bucket: string, path: string) => path
);
const mockUploadVideoToStorage = jest.fn<Promise<string | null>, [string, string, string | null | undefined]>(
  async (_bucket: string, path: string) => path
);
const mockDownloadPhotoFromStorage = jest.fn<Promise<string | null>, [string, string, string]>(
  async (_bucket: string, path: string) => `file:///synced/${path}`
);
const mockDownloadVideoFromStorage = jest.fn<Promise<string | null>, [string, string, string]>(
  async (_bucket: string, path: string) => `file:///synced/${path}`
);
const mockDeletePhotoFromStorage = jest.fn<Promise<void>, [string, string | null]>(async () => undefined);
const mockDeleteVideoFromStorage = jest.fn<Promise<void>, [string, string | null]>(async () => undefined);
const mockUpsertPublicProfile = jest.fn(async (input: unknown) => {
  const value = input as { userUid: string };
  mockPublicProfiles.set(value.userUid, input);
});
const mockUpsertNote = jest.fn(async (note: NoteRecord) => {
  localNotesStore = [note, ...localNotesStore.filter((item) => item.id !== note.id)];
  return note;
});
const mockDeleteNote = jest.fn(async (id: string) => {
  localNotesStore = localNotesStore.filter((note) => note.id !== id);
});
const mockGetNoteById = jest.fn(async (id: string) => {
  return localNotesStore.find((note) => note.id === id) ?? null;
});
const mockGetAllNotes = jest.fn(async () => localNotesStore);

const mockRunAsync = jest.fn(async (sql: string, ...args: any[]) => {
  if (sql.includes('INSERT INTO sync_queue')) {
    const [ownerUid, entity, entityId, operation, payload, createdAt] = args;
    queueRows.push({
      id: queueId++,
      owner_uid: ownerUid,
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
    const [id, ownerUid] = args;
    queueRows = queueRows.map((row) =>
      row.id === id && row.owner_uid === ownerUid
        ? { ...row, status: 'processing', attempts: row.attempts + 1, last_error: null, blocked_reason: null }
        : row
    );
    return;
  }

  if (sql.includes("SET status = 'pending'")) {
    const [ownerUid] = args;
    queueRows = queueRows.map((row) =>
      row.owner_uid === ownerUid && row.status === 'processing'
        ? { ...row, status: 'pending', last_error: null, next_retry_at: null, blocked_reason: null }
        : row
    );
    return;
  }

  if (sql.includes("SET status = 'failed'")) {
    const [lastError, nextRetryAt, terminal, blockedReason, id, ownerUid] = args;
    queueRows = queueRows.map((row) =>
      row.id === id && row.owner_uid === ownerUid
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

  if (sql.includes('DELETE FROM sync_queue WHERE id = ? AND owner_uid = ?')) {
    const [id, ownerUid] = args;
    queueRows = queueRows.filter((row) => !(row.id === id && row.owner_uid === ownerUid));
    return;
  }

  if (sql.includes('DELETE FROM sync_queue WHERE owner_uid = ?')) {
    const [ownerUid] = args;
    queueRows = queueRows.filter((row) => row.owner_uid !== ownerUid);
  }
});

const mockGetAllAsync = jest.fn(async (_sql: string, ownerUid: string, now: string, limit: number) =>
  queueRows
    .filter((row) => row.owner_uid === ownerUid)
    .filter((row) => (row.status === 'pending' || row.status === 'failed') && row.terminal === 0)
    .filter((row) => !row.next_retry_at || row.next_retry_at <= now)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, limit)
);

const mockGetFirstAsync = jest.fn(async (_sql: string, ownerUid: string) => ({
  pending_count: queueRows.filter((row) => row.owner_uid === ownerUid && row.status === 'pending').length,
  failed_count: queueRows.filter((row) => row.owner_uid === ownerUid && row.status === 'failed' && row.terminal === 0).length,
  blocked_count: queueRows.filter((row) => row.owner_uid === ownerUid && row.terminal === 1).length,
}));

jest.mock('../services/database', () => ({
  getDB: async () => ({
    runAsync: (sql: string, ...args: any[]) => mockRunAsync(sql, ...args),
    getAllAsync: (sql: string, ownerUid: string, now: string, limit: number) =>
      mockGetAllAsync(sql, ownerUid, now, limit),
    getFirstAsync: (sql: string, ownerUid: string) => mockGetFirstAsync(sql, ownerUid),
  }),
  getActiveNotesScope: () => mockActiveNotesScope,
  getAllNotes: () => mockGetAllNotes(),
  getNoteById: (id: string) => mockGetNoteById(id),
  deleteNote: (id: string) => mockDeleteNote(id),
  upsertNote: (note: NoteRecord) => mockUpsertNote(note),
}));

jest.mock('../services/remoteMedia', () => ({
  NOTE_MEDIA_BUCKET: 'note-media',
  SHARED_POST_MEDIA_BUCKET: 'shared-post-media',
  uploadPhotoToStorage: (bucket: string, path: string, localUri?: string | null) =>
    mockUploadPhotoToStorage(bucket, path, localUri),
  uploadPairedVideoToStorage: (bucket: string, path: string, localUri?: string | null) =>
    mockUploadVideoToStorage(bucket, path, localUri),
  downloadPhotoFromStorage: (bucket: string, path: string, fileName: string) =>
    mockDownloadPhotoFromStorage(bucket, path, fileName),
  downloadPairedVideoFromStorage: (bucket: string, path: string, fileName: string) =>
    mockDownloadVideoFromStorage(bucket, path, fileName),
  deletePhotoFromStorage: (bucket: string, path: string | null) =>
    mockDeletePhotoFromStorage(bucket, path),
  deletePairedVideoFromStorage: (bucket: string, path: string | null) =>
    mockDeleteVideoFromStorage(bucket, path),
}));

jest.mock('../services/publicProfileService', () => ({
  upsertPublicUserProfile: (input: unknown) => mockUpsertPublicProfile(input),
}));

function executeNotesQuery(state: any) {
  let rows = Array.from(mockRemoteNotes.values());

  for (const filter of state.filters) {
    if (filter.type === 'eq') {
      rows = rows.filter((row) => row?.[filter.field] === filter.value);
    }

    if (filter.type === 'gt') {
      rows = rows.filter((row) => String(row?.[filter.field] ?? '') > String(filter.value ?? ''));
    }
  }

  if (state.orderField) {
    rows = [...rows].sort((left, right) => {
      const leftValue = String(left?.[state.orderField!] ?? '');
      const rightValue = String(right?.[state.orderField!] ?? '');
      return state.ascending ? leftValue.localeCompare(rightValue) : rightValue.localeCompare(leftValue);
    });
  }

  return rows;
}

function executeSharedPostsQuery(state: any) {
  let rows = Array.from(mockRemoteSharedPosts.values());

  for (const filter of state.filters) {
    if (filter.type === 'eq') {
      rows = rows.filter((row) => row?.[filter.field] === filter.value);
    }

    if (filter.type === 'in') {
      rows = rows.filter((row) => filter.values.includes(row?.[filter.field]));
    }
  }

  return rows;
}

function executeTombstoneQuery(
  state: any,
  store: Map<string, any>
) {
  let rows = Array.from(store.values());

  for (const filter of state.filters) {
    if (filter.type === 'eq') {
      rows = rows.filter((row) => row?.[filter.field] === filter.value);
    }

    if (filter.type === 'gt') {
      rows = rows.filter((row) => String(row?.[filter.field] ?? '') > String(filter.value ?? ''));
    }
  }

  if (state.orderField) {
    rows = [...rows].sort((left, right) => {
      const leftValue = String(left?.[state.orderField!] ?? '');
      const rightValue = String(right?.[state.orderField!] ?? '');
      return state.ascending ? leftValue.localeCompare(rightValue) : rightValue.localeCompare(leftValue);
    });
  }

  return rows;
}

function mockCreateNotesQueryBuilder() {
  const state = {
    filters: [] as Array<{ type: 'eq' | 'gt'; field: string; value: unknown }>,
    orderField: null as string | null,
    ascending: true,
    deleteMode: false,
  };

  const builder: any = {
    select: () => builder,
    eq: (field: string, value: unknown) => {
      state.filters.push({ type: 'eq', field, value });
      return builder;
    },
    gt: (field: string, value: unknown) => {
      state.filters.push({ type: 'gt', field, value });
      return builder;
    },
    order: (field: string, options?: { ascending?: boolean }) => {
      state.orderField = field;
      state.ascending = options?.ascending ?? true;
      return builder;
    },
    maybeSingle: async () => {
      const rows = executeNotesQuery(state);
      return { data: rows[0] ?? null, error: null };
    },
    upsert: async (value: Record<string, unknown>) => {
      if (mockNotesUpsertError) {
        return { error: mockNotesUpsertError };
      }
      mockRemoteNotes.set(String(value.id), value);
      return { error: null };
    },
    delete: () => {
      state.deleteMode = true;
      return builder;
    },
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
      try {
        if (state.deleteMode) {
          const rows = executeNotesQuery(state);
          for (const row of rows) {
            mockRemoteNotes.delete(row.id);
          }
          return Promise.resolve(resolve({ data: null, error: null }));
        }

        return Promise.resolve(resolve({ data: executeNotesQuery(state), error: null }));
      } catch (error) {
        if (reject) {
          return Promise.resolve(reject(error));
        }

        return Promise.reject(error);
      }
    },
  };

  return builder;
}

function mockCreateSharedPostsQueryBuilder() {
  const state = {
    filters: [] as Array<
      | { type: 'eq'; field: string; value: unknown }
      | { type: 'in'; field: string; values: unknown[] }
    >,
    deleteMode: false,
  };

  const builder: any = {
    select: () => builder,
    eq: (field: string, value: unknown) => {
      state.filters.push({ type: 'eq', field, value });
      return builder;
    },
    in: (field: string, values: unknown[]) => {
      state.filters.push({ type: 'in', field, values });
      return builder;
    },
    delete: () => {
      state.deleteMode = true;
      return builder;
    },
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
      try {
        if (state.deleteMode) {
          const rows = executeSharedPostsQuery(state);
          for (const row of rows) {
            mockRemoteSharedPosts.delete(row.id);
          }
          return Promise.resolve(resolve({ data: null, error: null }));
        }

        return Promise.resolve(resolve({ data: executeSharedPostsQuery(state), error: null }));
      } catch (error) {
        if (reject) {
          return Promise.resolve(reject(error));
        }

        return Promise.reject(error);
      }
    },
  };

  return builder;
}

function mockCreateTombstonesQueryBuilder(
  store: Map<string, any>,
  idField: 'note_id' | 'post_id'
) {
  const state = {
    filters: [] as Array<{ type: 'eq' | 'gt'; field: string; value: unknown }>,
    orderField: null as string | null,
    ascending: true,
    deleteMode: false,
  };

  const builder: any = {
    select: () => builder,
    eq: (field: string, value: unknown) => {
      state.filters.push({ type: 'eq', field, value });
      return builder;
    },
    gt: (field: string, value: unknown) => {
      state.filters.push({ type: 'gt', field, value });
      return builder;
    },
    order: (field: string, options?: { ascending?: boolean }) => {
      state.orderField = field;
      state.ascending = options?.ascending ?? true;
      return builder;
    },
    upsert: async (value: Record<string, unknown> | Array<Record<string, unknown>>) => {
      const rows = Array.isArray(value) ? value : [value];
      for (const row of rows) {
        store.set(String(row[idField]), row);
      }
      return { error: null };
    },
    delete: () => {
      state.deleteMode = true;
      return builder;
    },
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
      try {
        if (state.deleteMode) {
          const rows = executeTombstoneQuery(state, store);
          for (const row of rows) {
            store.delete(String(row[idField]));
          }
          return Promise.resolve(resolve({ data: null, error: null }));
        }

        return Promise.resolve(resolve({ data: executeTombstoneQuery(state, store), error: null }));
      } catch (error) {
        if (reject) {
          return Promise.resolve(reject(error));
        }

        return Promise.reject(error);
      }
    },
  };

  return builder;
}

jest.mock('../utils/supabase', () => ({
  getCurrentSupabaseSession: async () => ({
    user: mockSessionUserId ? { id: mockSessionUserId } : null,
  }),
  getSupabaseErrorMessage: (error: unknown) =>
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: unknown }).message ?? 'Unknown Supabase error')
        : 'Unknown Supabase error',
  isSupabaseNetworkError: (error: unknown) =>
    String(
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error && 'message' in error
          ? (error as { message?: unknown }).message ?? ''
          : ''
    )
      .toLowerCase()
      .includes('network'),
  isSupabaseStorageObjectMissingError: (error: unknown) => {
    const code =
      typeof error === 'object' && error && 'code' in error
        ? String((error as { code?: unknown }).code ?? '')
        : '';
    const message = String(
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error && 'message' in error
          ? (error as { message?: unknown }).message ?? ''
          : ''
    ).toLowerCase();

    return (
      code === '404' ||
      code === 'NoSuchKey' ||
      message.includes('object not found') ||
      (message.includes('not found') &&
        (message.includes('object') ||
          message.includes('storage') ||
          message.includes('bucket') ||
          message.includes('key')))
    );
  },
  isSupabasePolicyError: (error: unknown) =>
    String(
      typeof error === 'object' && error && 'code' in error
        ? (error as { code?: unknown }).code ?? ''
        : ''
    ) === '42501',
  isSupabaseSchemaMismatchError: (error: unknown) =>
    ['PGRST204', '42703', '42P01'].includes(
      String(
        typeof error === 'object' && error && 'code' in error
          ? (error as { code?: unknown }).code ?? ''
          : ''
      )
    ),
  getSupabase: () => ({
    from: (table: string) => {
      if (table === 'notes') {
        return mockCreateNotesQueryBuilder();
      }

      if (table === 'shared_posts') {
        return mockCreateSharedPostsQueryBuilder();
      }

      if (table === 'note_tombstones') {
        return mockCreateTombstonesQueryBuilder(mockRemoteNoteTombstones, 'note_id');
      }

      if (table === 'shared_post_tombstones') {
        return mockCreateTombstonesQueryBuilder(mockRemoteSharedPostTombstones, 'post_id');
      }

      if (table === 'user_usage') {
        return {
          upsert: async (value: Record<string, unknown>) => {
            mockUserUsage.set(String(value.user_id), value);
            return { error: null };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

import { getSyncRepository, getSyncService, syncNotes } from '../services/syncService';

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

function createLivePhotoNote(id: string, extension: '.mov' | '.mp4' = '.mov'): NoteRecord {
  return {
    ...createPhotoNote(id),
    isLivePhoto: true,
    pairedVideoLocalUri: `file:///photos/${id}-motion${extension}`,
  };
}

function createRemoteStickerPlacementsJson(remotePath: string) {
  return JSON.stringify([
    {
      id: 'placement-1',
      assetId: 'asset-1',
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
      zIndex: 1,
      opacity: 1,
      asset: {
        id: 'asset-1',
        ownerUid: 'user-1',
        localUri: 'file:///stickers/asset-1.png',
        remotePath,
        mimeType: 'image/png',
        width: 120,
        height: 120,
        createdAt: '2026-03-10T00:00:00.000Z',
        updatedAt: null,
        source: 'import',
      },
    },
  ]);
}

async function setPreviouslySyncedNoteIds(ids: string[]) {
  await AsyncStorage.setItem('sync.syncedNoteIds.user-1', JSON.stringify(ids));
}

const syncUser = {
  id: 'user-1',
  uid: 'user-1',
  displayName: 'Huy',
  email: 'huy@example.com',
  photoURL: null,
} as const;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  queueRows = [];
  queueId = 1;
  mockNotesUpsertError = null;
  mockSessionUserId = 'user-1';
  localNotesStore = [];
  mockRemoteNotes.clear();
  mockRemoteSharedPosts.clear();
  mockRemoteNoteTombstones.clear();
  mockRemoteSharedPostTombstones.clear();
  mockUserUsage.clear();
  mockPublicProfiles.clear();
});

describe('syncService', () => {
  it('records changes into the persistent sync queue', async () => {
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

  it('reports queue stats from the SQLite-backed repository', async () => {
    queueRows = [
      {
        id: 1,
        owner_uid: mockActiveNotesScope,
        entity: 'note',
        entity_id: 'note-1',
        operation: 'create',
        payload: null,
        status: 'pending',
        attempts: 0,
        last_error: null,
        next_retry_at: null,
        terminal: 0,
        blocked_reason: null,
        created_at: '2026-03-10T00:00:00.000Z',
      },
      {
        id: 2,
        owner_uid: mockActiveNotesScope,
        entity: 'note',
        entity_id: 'note-2',
        operation: 'update',
        payload: null,
        status: 'failed',
        attempts: 1,
        last_error: 'network',
        next_retry_at: null,
        terminal: 0,
        blocked_reason: null,
        created_at: '2026-03-10T00:05:00.000Z',
      },
    ];

    const stats = await getSyncRepository().getStats();
    expect(stats).toEqual({
      pendingCount: 1,
      failedCount: 1,
      blockedCount: 0,
    });
  });

  it('recovers stuck processing queue items before reporting queue stats', async () => {
    queueRows = [
      {
        id: 1,
        owner_uid: mockActiveNotesScope,
        entity: 'note',
        entity_id: 'note-1',
        operation: 'create',
        payload: null,
        status: 'processing',
        attempts: 1,
        last_error: 'crash',
        next_retry_at: null,
        terminal: 0,
        blocked_reason: null,
        created_at: '2026-03-10T00:00:00.000Z',
      },
    ];

    const stats = await getSyncRepository().getStats();

    expect(stats).toEqual({
      pendingCount: 1,
      failedCount: 0,
      blockedCount: 0,
    });
    expect(queueRows[0]?.status).toBe('pending');
  });

  it('uploads a full local snapshot to Supabase and stores usage totals', async () => {
    const notes = [createTextNote('note-1'), createPhotoNote('note-2')];
    localNotesStore = notes;
    mockRemoteNoteTombstones.set('note-1', {
      note_id: 'note-1',
      user_id: 'user-1',
      deleted_at: '2026-03-09T00:00:00.000Z',
    });

    const result = await syncNotes(syncUser, notes, { mode: 'full' });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'success',
        uploadedCount: 2,
        importedCount: 0,
      })
    );
    expect(mockRemoteNotes.get('note-1')).toEqual(
      expect.objectContaining({
        user_id: 'user-1',
        type: 'text',
        content: 'note note-1',
      })
    );
    expect(mockRemoteNotes.get('note-2')).toEqual(
      expect.objectContaining({
        user_id: 'user-1',
        type: 'photo',
        photo_path: 'user-1/note-2',
      })
    );
    expect(mockUploadPhotoToStorage).toHaveBeenCalledWith(
      'note-media',
      'user-1/note-2',
      'file:///photos/note-2.jpg'
    );
    expect(mockUpsertNote).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'note-2',
        photoSyncedLocalUri: 'file:///photos/note-2.jpg',
      })
    );
    expect(mockUserUsage.get('user-1')).toEqual(
      expect.objectContaining({
        note_count: 2,
        photo_note_count: 1,
      })
    );
    expect(mockRemoteNoteTombstones.has('note-1')).toBe(false);
    expect(mockUpsertPublicProfile).toHaveBeenCalled();
  });

  it('preserves the paired motion clip extension when syncing a live photo note', async () => {
    localNotesStore = [createLivePhotoNote('note-live', '.mov')];

    const result = await syncNotes(syncUser, localNotesStore, { mode: 'full' });

    expect(result.status).toBe('success');
    expect(mockUploadVideoToStorage).toHaveBeenCalledWith(
      'note-media',
      'user-1/note-live.motion.mov',
      'file:///photos/note-live-motion.mov'
    );
    expect(mockRemoteNotes.get('note-live')).toEqual(
      expect.objectContaining({
        is_live_photo: true,
        paired_video_path: 'user-1/note-live.motion.mov',
      })
    );
    expect(mockUpsertNote).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'note-live',
        pairedVideoSyncedLocalUri: 'file:///photos/note-live-motion.mov',
      })
    );
  });

  it('reuses existing synced photo and motion paths when local media did not change', async () => {
    localNotesStore = [
      {
        ...createLivePhotoNote('note-stable', '.mov'),
        photoSyncedLocalUri: 'file:///photos/note-stable.jpg',
        pairedVideoSyncedLocalUri: 'file:///photos/note-stable-motion.mov',
      },
    ];
    mockRemoteNotes.set('note-stable', {
      id: 'note-stable',
      user_id: 'user-1',
      type: 'photo',
      content: '',
      photo_path: 'user-1/note-stable',
      is_live_photo: true,
      paired_video_path: 'user-1/note-stable.motion.mov',
      has_doodle: false,
      doodle_strokes_json: null,
      has_stickers: false,
      sticker_placements_json: null,
      location_name: 'Saigon',
      prompt_id: null,
      prompt_text_snapshot: null,
      prompt_answer: null,
      mood_emoji: null,
      note_color: null,
      latitude: 10.77,
      longitude: 106.69,
      radius: 150,
      is_favorite: false,
      created_at: '2026-03-10T00:00:00.000Z',
      updated_at: '2026-03-10T00:00:00.000Z',
      synced_at: '2026-03-10T00:00:00.000Z',
    });

    const result = await syncNotes(syncUser, localNotesStore, { mode: 'full' });

    expect(result.status).toBe('success');
    expect(mockUploadPhotoToStorage).not.toHaveBeenCalled();
    expect(mockUploadVideoToStorage).not.toHaveBeenCalled();
  });

  it('imports newer remote notes during incremental sync', async () => {
    await AsyncStorage.setItem('sync.lastRemoteCursor.user-1', '2026-03-09T00:00:00.000Z');
    mockRemoteNotes.set('note-remote', {
      id: 'note-remote',
      user_id: 'user-1',
      type: 'text',
      content: 'remote memory',
      photo_path: null,
      has_doodle: false,
      doodle_strokes_json: null,
      location_name: 'Da Nang',
      prompt_id: null,
      prompt_text_snapshot: null,
      prompt_answer: null,
      mood_emoji: null,
      latitude: 16.06,
      longitude: 108.22,
      radius: 150,
      is_favorite: false,
      created_at: '2026-03-10T00:00:00.000Z',
      updated_at: '2026-03-11T00:00:00.000Z',
      synced_at: '2026-03-11T00:00:00.000Z',
    });

    const result = await syncNotes(syncUser, [], { mode: 'incremental' });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'success',
        importedCount: 1,
      })
    );
    expect(mockUpsertNote).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'note-remote',
        content: 'remote memory',
        locationName: 'Da Nang',
      })
    );
  });

  it('keeps incremental sync running when a remote photo object is missing', async () => {
    await AsyncStorage.setItem('sync.lastRemoteCursor.user-1', '2026-03-09T00:00:00.000Z');
    mockRemoteNotes.set('note-photo-missing', {
      id: 'note-photo-missing',
      user_id: 'user-1',
      type: 'photo',
      content: '',
      photo_path: 'user-1/note-photo-missing',
      has_doodle: false,
      doodle_strokes_json: null,
      has_stickers: false,
      sticker_placements_json: null,
      location_name: 'Hoi An',
      prompt_id: null,
      prompt_text_snapshot: null,
      prompt_answer: null,
      mood_emoji: null,
      note_color: null,
      latitude: 15.88,
      longitude: 108.33,
      radius: 150,
      is_favorite: false,
      created_at: '2026-03-10T00:00:00.000Z',
      updated_at: '2026-03-11T00:00:00.000Z',
      synced_at: '2026-03-11T00:00:00.000Z',
    });
    mockRemoteNotes.set('note-text-later', {
      id: 'note-text-later',
      user_id: 'user-1',
      type: 'text',
      content: 'later text',
      photo_path: null,
      has_doodle: false,
      doodle_strokes_json: null,
      has_stickers: false,
      sticker_placements_json: null,
      location_name: 'Hue',
      prompt_id: null,
      prompt_text_snapshot: null,
      prompt_answer: null,
      mood_emoji: null,
      note_color: null,
      latitude: 16.45,
      longitude: 107.56,
      radius: 150,
      is_favorite: false,
      created_at: '2026-03-10T01:00:00.000Z',
      updated_at: '2026-03-12T00:00:00.000Z',
      synced_at: '2026-03-12T00:00:00.000Z',
    });
    mockDownloadPhotoFromStorage.mockRejectedValueOnce({
      message: 'Object not found',
      code: '404',
    });

    const result = await syncNotes(syncUser, [], { mode: 'incremental' });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'success',
        importedCount: 1,
      })
    );
    expect(mockUpsertNote).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'note-text-later',
        content: 'later text',
      })
    );
    expect(await AsyncStorage.getItem('sync.lastRemoteCursor.user-1')).toBe(
      '2026-03-09T00:00:00.000Z'
    );
  });

  it('removes local notes when note tombstones arrive during incremental sync', async () => {
    await AsyncStorage.setItem('sync.lastRemoteCursor.user-1', '2026-03-09T00:00:00.000Z');
    await setPreviouslySyncedNoteIds(['note-deleted']);
    localNotesStore = [createTextNote('note-deleted')];
    mockRemoteNoteTombstones.set('note-deleted', {
      note_id: 'note-deleted',
      user_id: 'user-1',
      deleted_at: '2026-03-11T00:00:00.000Z',
    });

    const result = await syncNotes(syncUser, localNotesStore, { mode: 'incremental' });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'success',
        importedCount: 1,
      })
    );
    expect(localNotesStore).toHaveLength(0);
    expect(mockDeleteNote).toHaveBeenCalledWith('note-deleted');
    expect(await AsyncStorage.getItem('sync.lastRemoteCursor.user-1')).toBe(
      '2026-03-11T00:00:00.000Z'
    );
  });

  it('keeps local-only notes that were never synced when full sync sees them missing remotely', async () => {
    await AsyncStorage.setItem('sync.lastRemoteCursor.user-1', '2026-03-11T00:00:00.000Z');
    await setPreviouslySyncedNoteIds([]);
    localNotesStore = [createTextNote('note-local-only')];

    const result = await syncNotes(syncUser, localNotesStore, { mode: 'full' });

    expect(result.status).toBe('success');
    expect(localNotesStore).toHaveLength(1);
    expect(mockRemoteNotes.get('note-local-only')).toEqual(
      expect.objectContaining({
        id: 'note-local-only',
        content: 'note note-local-only',
      })
    );
  });

  it('removes previously synced notes that disappeared remotely during full sync', async () => {
    await AsyncStorage.setItem('sync.lastRemoteCursor.user-1', '2026-03-11T00:00:00.000Z');
    await setPreviouslySyncedNoteIds(['note-synced']);
    localNotesStore = [createTextNote('note-synced')];

    const result = await syncNotes(syncUser, localNotesStore, { mode: 'full' });

    expect(result.status).toBe('success');
    expect(localNotesStore).toHaveLength(0);
    expect(mockRemoteNotes.has('note-synced')).toBe(false);
  });

  it('flushes queued delete operations to Supabase', async () => {
    mockRemoteNotes.set('note-1', {
      id: 'note-1',
      user_id: 'user-1',
      type: 'photo',
      content: '',
      photo_path: 'user-1/note-1',
      paired_video_path: null,
      sticker_placements_json: createRemoteStickerPlacementsJson('user-1/note-sticker-1.png'),
      synced_at: '2026-03-09T00:00:00.000Z',
    });
    mockRemoteSharedPosts.set('shared-1', {
      id: 'shared-1',
      author_user_id: 'user-1',
      source_note_id: 'note-1',
      photo_path: 'user-1/shared-1',
      sticker_placements_json: createRemoteStickerPlacementsJson('user-1/shared-sticker-1.png'),
    });

    await getSyncService().recordChange({
      type: 'delete',
      entity: 'note',
      entityId: 'note-1',
      timestamp: '2026-03-10T00:00:00.000Z',
    });

    const result = await syncNotes(syncUser, [], { mode: 'incremental' });

    expect(result.status).toBe('success');
    expect(mockRemoteNotes.has('note-1')).toBe(false);
    expect(mockRemoteSharedPosts.has('shared-1')).toBe(false);
    expect(mockRemoteNoteTombstones.get('note-1')).toEqual(
      expect.objectContaining({
        note_id: 'note-1',
        user_id: 'user-1',
      })
    );
    expect(mockRemoteSharedPostTombstones.get('shared-1')).toEqual(
      expect.objectContaining({
        post_id: 'shared-1',
        author_user_id: 'user-1',
      })
    );
    expect(mockDeletePhotoFromStorage).toHaveBeenCalledWith('note-media', 'user-1/note-1');
    expect(mockDeletePhotoFromStorage).toHaveBeenCalledWith('note-media', 'user-1/note-sticker-1.png');
    expect(mockDeletePhotoFromStorage).toHaveBeenCalledWith('shared-post-media', 'user-1/shared-1');
    expect(mockDeletePhotoFromStorage).toHaveBeenCalledWith(
      'shared-post-media',
      'user-1/shared-sticker-1.png'
    );
  });

  it('deletes the stored paired motion path for live photo notes without assuming mp4', async () => {
    mockRemoteNotes.set('note-live', {
      id: 'note-live',
      user_id: 'user-1',
      type: 'photo',
      content: '',
      photo_path: 'user-1/note-live',
      paired_video_path: 'user-1/note-live.motion.mov',
      synced_at: '2026-03-09T00:00:00.000Z',
    });

    await getSyncService().recordChange({
      type: 'delete',
      entity: 'note',
      entityId: 'note-live',
      timestamp: '2026-03-10T00:00:00.000Z',
    });

    const result = await syncNotes(syncUser, [], { mode: 'incremental' });

    expect(result.status).toBe('success');
    expect(mockDeleteVideoFromStorage).toHaveBeenCalledWith(
      'note-media',
      'user-1/note-live.motion.mov'
    );
  });

  it('flushes queued delete-all operations to Supabase and clears authored shared posts', async () => {
    mockRemoteNotes.set('note-1', {
      id: 'note-1',
      user_id: 'user-1',
      type: 'text',
      content: 'stale note',
      photo_path: null,
      synced_at: '2026-03-09T00:00:00.000Z',
    });
    mockRemoteNotes.set('note-2', {
      id: 'note-2',
      user_id: 'user-1',
      type: 'photo',
      content: '',
      photo_path: 'user-1/note-2',
      sticker_placements_json: createRemoteStickerPlacementsJson('user-1/note-2-sticker.png'),
      synced_at: '2026-03-09T00:00:00.000Z',
    });
    mockRemoteSharedPosts.set('shared-1', {
      id: 'shared-1',
      author_user_id: 'user-1',
      source_note_id: 'note-1',
      photo_path: null,
    });
    mockRemoteSharedPosts.set('shared-2', {
      id: 'shared-2',
      author_user_id: 'user-1',
      source_note_id: 'note-2',
      photo_path: 'user-1/shared-2',
      sticker_placements_json: createRemoteStickerPlacementsJson('user-1/shared-2-sticker.png'),
    });
    mockRemoteSharedPosts.set('shared-foreign', {
      id: 'shared-foreign',
      author_user_id: 'user-2',
      source_note_id: 'note-9',
      photo_path: 'user-2/shared-foreign',
    });

    await getSyncService().recordChange({
      type: 'deleteAll',
      entity: 'note',
      timestamp: '2026-03-10T00:00:00.000Z',
    });

    const result = await syncNotes(syncUser, [], { mode: 'incremental' });

    expect(result.status).toBe('success');
    expect(mockRemoteNotes.size).toBe(0);
    expect(mockRemoteSharedPosts.has('shared-1')).toBe(false);
    expect(mockRemoteSharedPosts.has('shared-2')).toBe(false);
    expect(mockRemoteSharedPosts.has('shared-foreign')).toBe(true);
    expect(mockRemoteNoteTombstones.get('note-1')).toEqual(
      expect.objectContaining({
        note_id: 'note-1',
        user_id: 'user-1',
      })
    );
    expect(mockRemoteNoteTombstones.get('note-2')).toEqual(
      expect.objectContaining({
        note_id: 'note-2',
        user_id: 'user-1',
      })
    );
    expect(mockRemoteSharedPostTombstones.get('shared-1')).toEqual(
      expect.objectContaining({
        post_id: 'shared-1',
        author_user_id: 'user-1',
      })
    );
    expect(mockRemoteSharedPostTombstones.get('shared-2')).toEqual(
      expect.objectContaining({
        post_id: 'shared-2',
        author_user_id: 'user-1',
      })
    );
    expect(mockDeletePhotoFromStorage).toHaveBeenCalledWith('note-media', 'user-1/note-2');
    expect(mockDeletePhotoFromStorage).toHaveBeenCalledWith('note-media', 'user-1/note-2-sticker.png');
    expect(mockDeletePhotoFromStorage).toHaveBeenCalledWith('shared-post-media', 'user-1/shared-2');
    expect(mockDeletePhotoFromStorage).toHaveBeenCalledWith(
      'shared-post-media',
      'user-1/shared-2-sticker.png'
    );
  });

  it('cleans up newly uploaded remote media when note upsert fails', async () => {
    localNotesStore = [createPhotoNote('note-orphan')];
    mockNotesUpsertError = new Error('insert failed');

    const result = await syncNotes(syncUser, localNotesStore, { mode: 'full' });

    expect(result.status).toBe('error');
    expect(mockDeletePhotoFromStorage).toHaveBeenCalledWith('note-media', 'user-1/note-orphan');
  });

  it('returns an actionable message when Supabase policies reject note writes', async () => {
    localNotesStore = [createTextNote('note-1')];
    mockNotesUpsertError = {
      code: '42501',
      message: 'new row violates row-level security policy (USING expression) for table "notes"',
    };

    const result = await syncNotes(syncUser, localNotesStore, { mode: 'full' });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        message:
          'Supabase denied access to sync your notes. Apply the latest Supabase migrations or sign in again.',
      })
    );
  });

  it('returns an actionable message when Supabase schema is missing sticker sync columns', async () => {
    localNotesStore = [createTextNote('note-1')];
    mockNotesUpsertError = {
      code: 'PGRST204',
      message: "Could not find the 'has_stickers' column of 'notes' in the schema cache",
    };

    const result = await syncNotes(syncUser, localNotesStore, { mode: 'full' });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        message:
          'Cloud sync needs the latest server migrations. Apply the latest Supabase migrations, then try again.',
      })
    );
  });
});

import { Platform } from 'react-native';

const mockExecAsync = jest.fn<Promise<void>, [string]>(async () => undefined);
const mockRunAsync = jest.fn<Promise<void>, [string, ...unknown[]]>(async () => undefined);
const mockCloseAsync = jest.fn<Promise<void>, []>(async () => undefined);
const mockDeleteDatabaseAsync = jest.fn<Promise<void>, [string]>(async () => undefined);
const mockGetFirstAsync = jest.fn<Promise<unknown | null>, [string, ...unknown[]]>(async (sql: string) => {
  if (sql.includes('PRAGMA user_version')) {
    return { user_version: 0 };
  }

  return null;
});
const mockGetAllAsync = jest.fn<Promise<unknown[]>, [string, ...unknown[]]>(async (sql: string) => {
  if (sql.includes('PRAGMA table_info(notes)')) {
    return [
      { name: 'id' },
      { name: 'type' },
      { name: 'content' },
      { name: 'location_name' },
      { name: 'latitude' },
      { name: 'longitude' },
      { name: 'radius' },
      { name: 'is_favorite' },
      { name: 'created_at' },
      { name: 'updated_at' },
    ];
  }

  if (sql.includes('SELECT id, type, content, caption, photo_local_uri, location_name, prompt_text_snapshot, prompt_answer, search_text')) {
    return [
      {
        id: 'photo-1',
        type: 'photo',
        content: 'legacy-photo.jpg',
        caption: null,
        photo_local_uri: null,
        location_name: 'District 3',
        search_text: '',
      },
    ];
  }

  if (sql.includes('SELECT id, owner_uid, search_text FROM notes')) {
    return [
      {
        id: 'photo-1',
        owner_uid: '__local__',
        search_text: 'district 3',
      },
    ];
  }

  return [];
});
let mockDatabase: {
  execAsync: (sql: string) => Promise<void>;
  runAsync: (sql: string, ...args: unknown[]) => Promise<void>;
  getAllAsync: (sql: string, ...args: unknown[]) => Promise<unknown[]>;
  getFirstAsync: (sql: string, ...args: unknown[]) => Promise<unknown | null>;
  closeAsync: () => Promise<void>;
  withExclusiveTransactionAsync: (callback: (txn: unknown) => Promise<void>) => Promise<void>;
  withTransactionAsync: (callback: (txn: unknown) => Promise<void>) => Promise<void>;
};

mockDatabase = {
  execAsync: (sql: string) => mockExecAsync(sql),
  runAsync: (sql: string, ...args: unknown[]) => mockRunAsync(sql, ...args),
  getAllAsync: (sql: string, ...args: unknown[]) => mockGetAllAsync(sql, ...args),
  getFirstAsync: (sql: string, ...args: unknown[]) => mockGetFirstAsync(sql, ...args),
  closeAsync: () => mockCloseAsync(),
  withExclusiveTransactionAsync: async (callback: (txn: unknown) => Promise<void>) => {
    await callback(mockDatabase);
  },
  withTransactionAsync: async (callback: (txn: unknown) => Promise<void>) => {
    await callback(mockDatabase);
  },
};

const mockOpenDatabaseAsync = jest.fn<Promise<typeof mockDatabase>, unknown[]>(async () => mockDatabase);

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: (...args: unknown[]) => mockOpenDatabaseAsync(...args),
  deleteDatabaseAsync: (name: string) => mockDeleteDatabaseAsync(name),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'mock-uuid-1234',
}));

jest.mock('../utils/fileSystem', () => ({
  documentDirectory: 'file:///mock-documents/',
}));

function countSqlPlaceholders(sql: string) {
  return (sql.match(/\?/g) ?? []).length;
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

describe('database migrations', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockOpenDatabaseAsync.mockImplementation(async () => mockDatabase);
  });

  it('adds new note columns and backfills photo/search metadata for legacy rows', async () => {
    let getDB!: () => Promise<unknown>;

    jest.isolateModules(() => {
      ({ getDB } = require('../services/database'));
    });

    await getDB();

    expect(mockExecAsync.mock.calls[0]?.[0]).toContain('PRAGMA foreign_keys = ON');
    expect(mockExecAsync.mock.calls[0]?.[0]).not.toContain('idx_notes_search_text ON notes(search_text)');
    expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining('photo_local_uri TEXT'));
    expect(mockExecAsync).toHaveBeenCalledWith('ALTER TABLE notes ADD COLUMN caption TEXT');
    expect(mockExecAsync).toHaveBeenCalledWith('ALTER TABLE notes ADD COLUMN search_text TEXT NOT NULL DEFAULT \'\'');
    expect(mockExecAsync).toHaveBeenCalledWith('DROP INDEX IF EXISTS idx_notes_search_text');
    expect(mockExecAsync).toHaveBeenCalledWith(
      expect.stringContaining('CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts')
    );
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE notes'),
      'file:///mock-documents/photos/legacy-photo.jpg',
      'district 3',
      'photo-1'
    );
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO notes_fts'),
      '__local__'
    );
  });

  it('fails database initialization when a migration step throws', async () => {
    let getDB!: () => Promise<unknown>;

    mockExecAsync.mockImplementationOnce(async () => {
      throw new Error('migration failed');
    });

    jest.isolateModules(() => {
      ({ getDB } = require('../services/database'));
    });

    await expect(getDB()).rejects.toThrow('migration failed');
  });

  it('resets local database without waiting for a stuck initialization', async () => {
    const pendingOpen = createDeferred<typeof mockDatabase>();
    mockOpenDatabaseAsync.mockImplementationOnce(() => pendingOpen.promise);

    let getDB!: () => Promise<unknown>;
    let resetLocalDatabase!: () => Promise<void>;

    jest.isolateModules(() => {
      ({ getDB, resetLocalDatabase } = require('../services/database'));
    });

    const initPromise = getDB();
    await Promise.resolve();

    await expect(resetLocalDatabase()).resolves.toBeUndefined();
    expect(mockDeleteDatabaseAsync).toHaveBeenCalledWith('acte_notes.db');
    expect(mockCloseAsync).not.toHaveBeenCalled();

    pendingOpen.resolve(mockDatabase);
    await expect(initPromise).rejects.toThrow('database-init-stale');
    expect(mockCloseAsync).toHaveBeenCalled();
  });

  it('adds a partial unique index for sync queue coalescing after deduplicating legacy rows', async () => {
    let getDB!: () => Promise<unknown>;

    jest.isolateModules(() => {
      ({ getDB } = require('../services/database'));
    });

    await getDB();

    expect(mockExecAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM sync_queue')
    );
    expect(mockExecAsync).toHaveBeenCalledWith(
      expect.stringContaining('GROUP BY owner_uid, coalesce_key')
    );
    expect(mockExecAsync).toHaveBeenCalledWith(
      expect.stringContaining('CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_queue_owner_coalesce_unique')
    );
    expect(mockExecAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE coalesce_key IS NOT NULL')
    );
  });

  it('preserves the theme default text note color on create and update', async () => {
    let getDB!: () => Promise<unknown>;
    let createNote!: (input: Record<string, unknown>) => Promise<unknown>;
    let updateNote!: (id: string, updates: Record<string, unknown>) => Promise<void>;

    jest.isolateModules(() => {
      ({ getDB, createNote, updateNote } = require('../services/database'));
    });

    await getDB();
    mockRunAsync.mockClear();
    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('PRAGMA user_version')) {
        return { user_version: 0 };
      }

      if (sql.includes('FROM notes')) {
        return {
          id: 'note-1',
          type: 'text',
          content: 'Legacy note',
          photo_local_uri: null,
          photo_remote_base64: null,
          is_live_photo: 0,
          paired_video_local_uri: null,
          paired_video_remote_path: null,
          location_name: 'District 1',
          prompt_id: null,
          prompt_text_snapshot: null,
          prompt_answer: null,
          mood_emoji: null,
          note_color: null,
          latitude: 10.77,
          longitude: 106.69,
          radius: 150,
          is_favorite: 0,
          has_doodle: 0,
          doodle_strokes_json: null,
          has_stickers: 0,
          sticker_placements_json: null,
          created_at: '2026-03-27T00:00:00.000Z',
          updated_at: null,
        };
      }

      return null;
    });

    await createNote({
      type: 'text',
      content: 'Fresh note',
      locationName: 'Cafe',
      latitude: 10.77,
      longitude: 106.69,
      noteColor: null,
    });

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO notes'),
      expect.any(String),
      '__local__',
      'text',
      'Fresh note',
      null,
      null,
      null,
      null,
      0,
      null,
      null,
      null,
      'Cafe',
      null,
      null,
      null,
      null,
      'app-theme-default',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      expect.any(String),
      10.77,
      106.69,
      150,
      expect.any(String)
    );
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO notes_fts'),
      expect.any(String),
      '__local__',
      expect.any(String)
    );

    mockRunAsync.mockClear();

    await updateNote('note-1', { content: 'Updated legacy note' });

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE notes'),
      'Updated legacy note',
      null,
      null,
      null,
      null,
      0,
      null,
      null,
      null,
      'District 1',
      null,
      null,
      null,
      null,
      'app-theme-default',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      expect.any(String),
      150,
      expect.any(String),
      'note-1',
      '__local__'
    );
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO notes_fts'),
      'note-1',
      '__local__',
      expect.any(String)
    );
  });

  it('uses atomic conflict updates when enqueueing sync changes', async () => {
    let getDB!: () => Promise<unknown>;
    let createNote!: (input: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>;

    jest.isolateModules(() => {
      ({ getDB, createNote } = require('../services/database'));
    });

    await getDB();
    mockRunAsync.mockClear();
    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('PRAGMA user_version')) {
        return { user_version: 0 };
      }

      if (sql.includes('SELECT local_revision FROM notes WHERE id = ? AND owner_uid = ?')) {
        return { local_revision: 1 };
      }

      return null;
    });

    await createNote(
      {
        id: 'note-sync-1',
        type: 'text',
        content: 'Queue me',
        locationName: 'Cafe',
        latitude: 10.77,
        longitude: 106.69,
      },
      {
        scope: 'user-1',
        syncChange: {
          entity: 'note',
          entityId: 'note-sync-1',
          payload: { content: 'Queue me' },
          timestamp: '2026-04-26T09:00:00.000Z',
          type: 'update',
        },
      }
    );

    const syncQueueCall = mockRunAsync.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO sync_queue')
    );

    expect(syncQueueCall).toBeDefined();
    expect(syncQueueCall?.[0]).toContain(
      'ON CONFLICT(owner_uid, coalesce_key) WHERE coalesce_key IS NOT NULL DO UPDATE SET'
    );
    expect(syncQueueCall?.[0]).toContain("status = 'pending'");
    expect(syncQueueCall?.slice(1)).toEqual([
      'user-1',
      'note',
      'note-sync-1',
      'note:note-sync-1',
      'update',
      JSON.stringify({ content: 'Queue me', localRevision: 1 }),
      '2026-04-26T09:00:00.000Z',
    ]);
  });

  it('reads the current note row inside the update transaction', async () => {
    let getDB!: () => Promise<unknown>;
    let updateNote!: (id: string, updates: Record<string, unknown>) => Promise<void>;

    jest.isolateModules(() => {
      ({ getDB, updateNote } = require('../services/database'));
    });

    await getDB();
    mockExecAsync.mockClear();
    mockGetFirstAsync.mockClear();
    mockRunAsync.mockClear();
    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM notes')) {
        return {
          id: 'note-1',
          type: 'text',
          content: 'Before transaction edit',
          caption: null,
          photo_local_uri: null,
          photo_synced_local_uri: null,
          photo_remote_base64: null,
          is_live_photo: 0,
          paired_video_local_uri: null,
          paired_video_synced_local_uri: null,
          paired_video_remote_path: null,
          location_name: 'District 1',
          prompt_id: null,
          prompt_text_snapshot: null,
          prompt_answer: null,
          mood_emoji: null,
          note_color: null,
          capture_variant: null,
          dual_primary_photo_local_uri: null,
          dual_secondary_photo_local_uri: null,
          dual_primary_facing: null,
          dual_secondary_facing: null,
          dual_layout_preset: null,
          dual_composed_photo_local_uri: null,
          latitude: 10.77,
          longitude: 106.69,
          radius: 150,
          is_favorite: 0,
          search_text: '',
          has_doodle: 0,
          doodle_strokes_json: null,
          has_stickers: 0,
          sticker_placements_json: null,
          created_at: '2026-03-27T00:00:00.000Z',
          updated_at: null,
        };
      }

      return null;
    });

    await updateNote('note-1', { content: 'After transaction edit' });

    const beginOrder = mockExecAsync.mock.invocationCallOrder[0];
    const commitOrder = mockExecAsync.mock.invocationCallOrder[1];
    const selectOrder = mockGetFirstAsync.mock.invocationCallOrder[0];
    const updateCallIndex = mockRunAsync.mock.calls.findIndex(([sql]) =>
      sql.includes('UPDATE notes')
    );
    const updateOrder = mockRunAsync.mock.invocationCallOrder[updateCallIndex];

    expect(mockExecAsync.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN IMMEDIATE', 'COMMIT']);
    expect(beginOrder).toBeLessThan(selectOrder);
    expect(selectOrder).toBeLessThan(updateOrder);
    expect(updateOrder).toBeLessThan(commitOrder);
  });

  it('persists doodles and stickers alongside note rows and clears them when removed', async () => {
    let getDB!: () => Promise<unknown>;
    let createNote!: (input: Record<string, unknown>) => Promise<unknown>;
    let updateNote!: (id: string, updates: Record<string, unknown>) => Promise<void>;

    jest.isolateModules(() => {
      ({ getDB, createNote, updateNote } = require('../services/database'));
    });

    await getDB();
    mockRunAsync.mockClear();

    await createNote({
      id: 'note-1',
      type: 'text',
      content: 'Note with art',
      locationName: 'Cafe',
      latitude: 10.77,
      longitude: 106.69,
      noteColor: null,
      hasDoodle: true,
      doodleStrokesJson: JSON.stringify([{ color: '#ffffff', points: [0.1, 0.2] }]),
      hasStickers: true,
      stickerPlacementsJson: JSON.stringify([{ id: 'sticker-1' }]),
    });

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO note_doodles'),
      'note-1',
      JSON.stringify([{ color: '#ffffff', points: [0.1, 0.2] }]),
      expect.any(String)
    );
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO note_stickers'),
      'note-1',
      JSON.stringify([{ id: 'sticker-1' }]),
      expect.any(String)
    );

    mockRunAsync.mockClear();
    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('PRAGMA user_version')) {
        return { user_version: 0 };
      }

      if (sql.includes('FROM notes')) {
        return {
          id: 'note-1',
          type: 'text',
          content: 'Note with art',
          photo_local_uri: null,
          photo_remote_base64: null,
          is_live_photo: 0,
          paired_video_local_uri: null,
          paired_video_remote_path: null,
          location_name: 'Cafe',
          prompt_id: null,
          prompt_text_snapshot: null,
          prompt_answer: null,
          mood_emoji: null,
          note_color: null,
          latitude: 10.77,
          longitude: 106.69,
          radius: 150,
          is_favorite: 0,
          has_doodle: 1,
          doodle_strokes_json: JSON.stringify([{ color: '#ffffff', points: [0.1, 0.2] }]),
          has_stickers: 1,
          sticker_placements_json: JSON.stringify([{ id: 'sticker-1' }]),
          created_at: '2026-03-27T00:00:00.000Z',
          updated_at: null,
        };
      }

      return null;
    });

    await updateNote('note-1', {
      hasDoodle: false,
      doodleStrokesJson: null,
      hasStickers: false,
      stickerPlacementsJson: null,
    });

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM note_doodles'),
      'note-1'
    );
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM note_stickers'),
      'note-1'
    );
  });

  it('refuses to overwrite a note that belongs to another scope', async () => {
    let getDB!: () => Promise<unknown>;
    let upsertNoteForScope!: (input: Record<string, unknown>, scope: string) => Promise<unknown>;

    jest.isolateModules(() => {
      ({ getDB, upsertNoteForScope } = require('../services/database'));
    });

    await getDB();
    mockRunAsync.mockClear();
    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('PRAGMA user_version')) {
        return { user_version: 0 };
      }

      if (sql.includes('SELECT owner_uid, created_at, updated_at, local_revision FROM notes WHERE id = ?')) {
        return {
          owner_uid: 'user-1',
          created_at: '2026-04-01T00:00:00.000Z',
          updated_at: null,
          local_revision: 0,
        };
      }

      return null;
    });

    await expect(
      upsertNoteForScope(
        {
          id: 'shared-id',
          type: 'text',
          content: 'Conflicting note',
          locationName: 'Cafe',
          latitude: 10.77,
          longitude: 106.69,
          createdAt: '2026-04-02T00:00:00.000Z',
        },
        'user-2'
      )
    ).rejects.toThrow('Refusing to overwrite note shared-id from scope user-1 with scope user-2.');

    expect(mockRunAsync).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO notes'));
  });

  it('binds one value per placeholder when upserting a scoped note', async () => {
    let getDB!: () => Promise<unknown>;
    let upsertNoteForScope!: (input: Record<string, unknown>, scope: string) => Promise<unknown>;

    jest.isolateModules(() => {
      ({ getDB, upsertNoteForScope } = require('../services/database'));
    });

    await getDB();
    mockRunAsync.mockClear();
    mockGetFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('PRAGMA user_version')) {
        return { user_version: 0 };
      }

      if (sql.includes('SELECT owner_uid, created_at, updated_at, local_revision FROM notes WHERE id = ?')) {
        return null;
      }

      return null;
    });

    await upsertNoteForScope(
      {
        id: 'scoped-note-1',
        type: 'photo',
        content: 'file:///mock-documents/photos/photo-1.jpg',
        caption: 'A bright memory',
        photoLocalUri: 'file:///mock-documents/photos/photo-1.jpg',
        photoSyncedLocalUri: 'file:///mock-documents/photos/photo-1.synced.jpg',
        photoRemoteBase64: 'base64-data',
        isLivePhoto: true,
        pairedVideoLocalUri: 'file:///mock-documents/videos/photo-1.mov',
        pairedVideoSyncedLocalUri: 'file:///mock-documents/videos/photo-1.synced.mov',
        pairedVideoRemotePath: 'remote/path.mov',
        locationName: 'District 1',
        promptId: 'prompt-1',
        promptTextSnapshot: 'Prompt text',
        promptAnswer: 'Prompt answer',
        moodEmoji: 'smile',
        noteColor: 'skyline',
        captureVariant: 'dual',
        dualPrimaryPhotoLocalUri: 'file:///mock-documents/photos/primary.jpg',
        dualSecondaryPhotoLocalUri: 'file:///mock-documents/photos/secondary.jpg',
        dualPrimaryFacing: 'front',
        dualSecondaryFacing: 'back',
        dualLayoutPreset: 'top-left',
        dualComposedPhotoLocalUri: 'file:///mock-documents/photos/composed.jpg',
        latitude: 10.77,
        longitude: 106.69,
        radius: 120,
        isFavorite: true,
        createdAt: '2026-04-02T00:00:00.000Z',
        updatedAt: '2026-04-03T00:00:00.000Z',
      },
      'user-1'
    );

    const insertCall = mockRunAsync.mock.calls.find(([sql]) => sql.includes('INSERT INTO notes'));

    expect(insertCall).toBeDefined();
    expect(countSqlPlaceholders(insertCall![0])).toBe(insertCall!.length - 1);
  });

  it('uses explicit native begin/commit/rollback transactions', async () => {
    let getDB!: () => Promise<unknown>;
    let withDatabaseTransaction!: <T>(task: (txn: { runAsync: typeof mockRunAsync }) => Promise<T>) => Promise<T>;

    jest.isolateModules(() => {
      ({ getDB, withDatabaseTransaction } = require('../services/database'));
    });

    await getDB();

    mockExecAsync.mockClear();
    mockRunAsync.mockClear();

    await withDatabaseTransaction(async (txn) => {
      await txn.runAsync('UPDATE notes SET updated_at = ?', '2026-04-02T00:00:00.000Z');
      return 'ok';
    });

    expect(mockExecAsync.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN IMMEDIATE', 'COMMIT']);

    mockExecAsync.mockClear();
    mockRunAsync.mockImplementationOnce(async () => {
      throw new Error('boom');
    });

    await expect(
      withDatabaseTransaction(async (txn) => {
        await txn.runAsync('UPDATE notes SET updated_at = ?', '2026-04-02T00:00:00.000Z');
      })
    ).rejects.toThrow('boom');

    expect(mockExecAsync.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN IMMEDIATE', 'ROLLBACK']);
  });

  it('keeps direct Android database writes behind active transactions', async () => {
    const originalPlatform = Platform.OS;
    Platform.OS = 'android';

    try {
      let getDB!: () => Promise<{ runAsync: (sql: string, ...args: unknown[]) => Promise<void> }>;
      let withDatabaseTransaction!: <T>(task: (txn: { runAsync: typeof mockRunAsync }) => Promise<T>) => Promise<T>;

      jest.isolateModules(() => {
        ({ getDB, withDatabaseTransaction } = require('../services/database'));
      });

      const database = await getDB();
      mockExecAsync.mockClear();
      mockRunAsync.mockClear();

      let directWriteFinished = false;
      let directWritePromise: Promise<void> | null = null;

      await withDatabaseTransaction(async (txn) => {
        directWritePromise = database.runAsync('DIRECT ANDROID WRITE').then(() => {
          directWriteFinished = true;
        });

        await Promise.resolve();
        await Promise.resolve();

        expect(directWriteFinished).toBe(false);
        expect(mockRunAsync).not.toHaveBeenCalledWith('DIRECT ANDROID WRITE');

        await txn.runAsync('TRANSACTION ANDROID WRITE');
      });

      await directWritePromise;

      const beginOrder = mockExecAsync.mock.invocationCallOrder[0];
      const commitOrder = mockExecAsync.mock.invocationCallOrder[1];
      const transactionWriteOrder = mockRunAsync.mock.invocationCallOrder[
        mockRunAsync.mock.calls.findIndex(([sql]) => sql === 'TRANSACTION ANDROID WRITE')
      ];
      const directWriteOrder = mockRunAsync.mock.invocationCallOrder[
        mockRunAsync.mock.calls.findIndex(([sql]) => sql === 'DIRECT ANDROID WRITE')
      ];

      expect(mockExecAsync.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN IMMEDIATE', 'COMMIT']);
      expect(beginOrder).toBeLessThan(transactionWriteOrder);
      expect(transactionWriteOrder).toBeLessThan(commitOrder);
      expect(commitOrder).toBeLessThan(directWriteOrder);
    } finally {
      Platform.OS = originalPlatform;
    }
  });

  it('keeps empty scoped searches inside the requested owner scope', async () => {
    let getDB!: () => Promise<unknown>;
    let searchNotes!: (query: string, scopeOverride?: string) => Promise<unknown[]>;

    jest.isolateModules(() => {
      ({ getDB, searchNotes } = require('../services/database'));
    });

    await getDB();
    mockGetAllAsync.mockClear();

    await searchNotes('   ', 'user-42');

    expect(mockGetAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE owner_uid = ?'),
      'user-42'
    );
  });

  it('does not migrate local sync metadata into an authenticated account scope', async () => {
    let getDB!: () => Promise<unknown>;
    let migrateNotesScope!: (sourceScope: string, targetScope: string) => Promise<void>;

    jest.isolateModules(() => {
      ({ getDB, migrateNotesScope } = require('../services/database'));
    });

    await getDB();

    mockExecAsync.mockClear();
    mockRunAsync.mockClear();

    await migrateNotesScope('__local__', 'user-1');

    expect(mockRunAsync).toHaveBeenCalledWith(
      'UPDATE notes SET owner_uid = ? WHERE owner_uid = ?',
      'user-1',
      '__local__'
    );
    expect(mockRunAsync).toHaveBeenCalledWith(
      'UPDATE sync_queue SET owner_uid = ? WHERE owner_uid = ?',
      'user-1',
      '__local__'
    );
    expect(mockRunAsync).toHaveBeenCalledWith(
      'DELETE FROM sync_state WHERE owner_uid = ?',
      '__local__'
    );
    expect(mockRunAsync).toHaveBeenCalledWith(
      'DELETE FROM sync_runs WHERE owner_uid = ?',
      '__local__'
    );
    expect(mockRunAsync).not.toHaveBeenCalledWith(
      'UPDATE sync_state SET owner_uid = ? WHERE owner_uid = ?',
      'user-1',
      '__local__'
    );
    expect(mockRunAsync).not.toHaveBeenCalledWith(
      'UPDATE sync_runs SET owner_uid = ? WHERE owner_uid = ?',
      'user-1',
      '__local__'
    );
  });
});

const mockExecAsync = jest.fn<Promise<void>, [string]>(async () => undefined);
const mockRunAsync = jest.fn<Promise<void>, [string, ...unknown[]]>(async () => undefined);
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

  if (sql.includes('SELECT id, type, content, photo_local_uri, location_name, prompt_text_snapshot, prompt_answer, search_text')) {
    return [
      {
        id: 'photo-1',
        type: 'photo',
        content: 'legacy-photo.jpg',
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
  withExclusiveTransactionAsync: (callback: (txn: unknown) => Promise<void>) => Promise<void>;
  withTransactionAsync: (callback: (txn: unknown) => Promise<void>) => Promise<void>;
};

mockDatabase = {
  execAsync: (sql: string) => mockExecAsync(sql),
  runAsync: (sql: string, ...args: unknown[]) => mockRunAsync(sql, ...args),
  getAllAsync: (sql: string, ...args: unknown[]) => mockGetAllAsync(sql, ...args),
  getFirstAsync: (sql: string, ...args: unknown[]) => mockGetFirstAsync(sql, ...args),
  withExclusiveTransactionAsync: async (callback: (txn: unknown) => Promise<void>) => {
    await callback(mockDatabase);
  },
  withTransactionAsync: async (callback: (txn: unknown) => Promise<void>) => {
    await callback(mockDatabase);
  },
};

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => mockDatabase,
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'mock-uuid-1234',
}));

jest.mock('../utils/fileSystem', () => ({
  documentDirectory: 'file:///mock-documents/',
}));

describe('database migrations', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('adds new note columns and backfills photo/search metadata for legacy rows', async () => {
    let getDB!: () => Promise<unknown>;

    jest.isolateModules(() => {
      ({ getDB } = require('../services/database'));
    });

    await getDB();

    expect(mockExecAsync.mock.calls[0]?.[0]).not.toContain('idx_notes_search_text ON notes(search_text)');
    expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining('photo_local_uri TEXT'));
    expect(mockExecAsync).toHaveBeenCalledWith('ALTER TABLE notes ADD COLUMN search_text TEXT NOT NULL DEFAULT \'\'');
    expect(mockExecAsync).toHaveBeenCalledWith('CREATE INDEX IF NOT EXISTS idx_notes_search_text ON notes(search_text)');
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
      'photo-1',
      '__local__',
      'district 3'
    );
  });

  it('normalizes saved text note colors on create and update', async () => {
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
      0,
      null,
      null,
      null,
      'Cafe',
      null,
      null,
      null,
      null,
      'marigold-glow',
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
      0,
      null,
      null,
      null,
      'District 1',
      null,
      null,
      null,
      null,
      'marigold-glow',
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
});

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

  return [];
});

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => ({
    execAsync: (sql: string) => mockExecAsync(sql),
    runAsync: (sql: string, ...args: unknown[]) => mockRunAsync(sql, ...args),
    getAllAsync: (sql: string, ...args: unknown[]) => mockGetAllAsync(sql, ...args),
    getFirstAsync: (sql: string, ...args: unknown[]) => mockGetFirstAsync(sql, ...args),
  }),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'mock-uuid-1234',
}));

jest.mock('expo-file-system/legacy', () => ({
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
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE notes'),
      'file:///mock-documents/photos/legacy-photo.jpg',
      'district 3',
      'photo-1'
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

    expect(mockRunAsync).toHaveBeenLastCalledWith(
      expect.stringContaining('INSERT INTO notes'),
      expect.any(String),
      '__local__',
      'text',
      'Fresh note',
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

    mockRunAsync.mockClear();

    await updateNote('note-1', { content: 'Updated legacy note' });

    expect(mockRunAsync).toHaveBeenLastCalledWith(
      expect.stringContaining('UPDATE notes'),
      'Updated legacy note',
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
  });
});

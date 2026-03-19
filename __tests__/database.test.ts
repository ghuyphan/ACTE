const mockExecAsync = jest.fn<Promise<void>, [string]>(async () => undefined);
const mockRunAsync = jest.fn<Promise<void>, [string, ...unknown[]]>(async () => undefined);
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
    getFirstAsync: async (sql: string) => {
      if (sql.includes('PRAGMA user_version')) {
        return { user_version: 0 };
      }

      return null;
    },
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
});

const mockOpenDatabaseAsync = jest.fn();
const mockGetSecureItem = jest.fn();
const mockSetSecureItem = jest.fn();
const mockGetRandomBytes = jest.fn();
const mockGetInfoAsync = jest.fn();
const mockDeleteAsync = jest.fn();
const mockMoveAsync = jest.fn();

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: (...args: unknown[]) => mockOpenDatabaseAsync(...args),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: unknown[]) => mockGetSecureItem(...args),
  setItemAsync: (...args: unknown[]) => mockSetSecureItem(...args),
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: (...args: unknown[]) => mockGetRandomBytes(...args),
}));

jest.mock('../utils/fileSystem', () => ({
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
  moveAsync: (...args: unknown[]) => mockMoveAsync(...args),
}));

import { openProtectedDatabase } from '../services/databaseEncryption';

function createDatabaseMock(options: {
  path?: string;
  readable?: boolean;
  applicationTableCount?: number;
  userVersion?: number;
  cipherVersion?: string | null;
} = {}) {
  const execAsync = jest.fn(async () => undefined);
  const closeAsync = jest.fn(async () => undefined);
  const getFirstAsync = jest.fn(async (query: string) => {
    if (query.includes('cipher_version')) {
      return options.cipherVersion === null
        ? null
        : { cipher_version: options.cipherVersion ?? '4.6.1' };
    }
    if (query.includes('PRAGMA user_version')) {
      return { user_version: options.userVersion ?? 0 };
    }
    if (query.includes("name NOT LIKE 'sqlite_%'")) {
      return { count: options.applicationTableCount ?? 0 };
    }
    if (query.includes('sqlite_master')) {
      if (options.readable === false) {
        throw new Error('file is not a database');
      }
      return { count: options.applicationTableCount ?? 0 };
    }
    return null;
  });

  return {
    databasePath: options.path ?? '/databases/acte_notes.db',
    execAsync,
    closeAsync,
    getFirstAsync,
  };
}

describe('openProtectedDatabase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSecureItem.mockResolvedValue(null);
    mockSetSecureItem.mockResolvedValue(undefined);
    mockGetRandomBytes.mockResolvedValue(Uint8Array.from({ length: 32 }, (_, index) => index));
    mockGetInfoAsync.mockResolvedValue({
      exists: false,
      isDirectory: false,
      uri: '',
    });
    mockDeleteAsync.mockResolvedValue(undefined);
    mockMoveAsync.mockResolvedValue(undefined);
  });

  it('creates a SecureStore key before initializing a fresh encrypted database', async () => {
    const probeDatabase = createDatabaseMock();
    const encryptedDatabase = createDatabaseMock();
    mockGetInfoAsync.mockImplementation(async (path: string) => ({
      exists: path === 'file:///databases/acte_notes.db',
      isDirectory: false,
      uri: path,
    }));
    mockOpenDatabaseAsync
      .mockResolvedValueOnce(probeDatabase)
      .mockResolvedValueOnce(encryptedDatabase);

    await expect(
      openProtectedDatabase('acte_notes.db', undefined, {
        forceEncryptionInTests: true,
      })
    ).resolves.toBe(encryptedDatabase);

    expect(mockSetSecureItem).toHaveBeenCalledWith(
      'noto.sqlite.encryption-key.v1',
      expect.stringMatching(/^[a-f0-9]{64}$/)
    );
    expect(probeDatabase.closeAsync).toHaveBeenCalled();
    expect(mockDeleteAsync).toHaveBeenCalledWith('file:///databases/acte_notes.db', {
      idempotent: true,
    });
    expect(encryptedDatabase.execAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^PRAGMA key = "x'[a-f0-9]{64}'";$/)
    );
  });

  it('reopens an encrypted database and applies the existing key before verification', async () => {
    const key = 'ab'.repeat(32);
    const probeDatabase = createDatabaseMock({ readable: false });
    const encryptedDatabase = createDatabaseMock();
    mockGetSecureItem.mockResolvedValue(key);
    mockOpenDatabaseAsync
      .mockResolvedValueOnce(probeDatabase)
      .mockResolvedValueOnce(encryptedDatabase);

    await expect(
      openProtectedDatabase('acte_notes.db', undefined, {
        forceEncryptionInTests: true,
      })
    ).resolves.toBe(encryptedDatabase);

    expect(probeDatabase.closeAsync).toHaveBeenCalled();
    expect(encryptedDatabase.execAsync).toHaveBeenCalledWith(
      `PRAGMA key = "x'${key}'";`
    );
  });

  it('keeps plaintext until the encrypted export verifies', async () => {
    const plaintextDatabase = createDatabaseMock({
      applicationTableCount: 4,
      userVersion: 12,
    });
    const encryptedDatabase = createDatabaseMock();
    mockGetInfoAsync.mockImplementation(async (path: string) => ({
      exists: path === 'file:///databases/acte_notes.db',
      isDirectory: false,
      uri: path,
    }));
    mockOpenDatabaseAsync
      .mockResolvedValueOnce(plaintextDatabase)
      .mockResolvedValueOnce(encryptedDatabase);

    await expect(
      openProtectedDatabase('acte_notes.db', undefined, {
        forceEncryptionInTests: true,
      })
    ).resolves.toBe(encryptedDatabase);

    expect(plaintextDatabase.execAsync).toHaveBeenCalledWith(
      expect.stringContaining("SELECT sqlcipher_export('encrypted')")
    );
    expect(plaintextDatabase.execAsync).toHaveBeenCalledWith(
      expect.stringContaining('PRAGMA encrypted.user_version = 12')
    );
    expect(mockOpenDatabaseAsync).toHaveBeenNthCalledWith(
      2,
      'acte_notes.db.encrypted-migration',
      undefined
    );
    expect(mockDeleteAsync).toHaveBeenCalledWith('file:///databases/acte_notes.db', {
      idempotent: true,
    });
    expect(mockMoveAsync).not.toHaveBeenCalled();
  });

  it('adopts a previously verified encrypted export after an interrupted file swap', async () => {
    const key = 'ab'.repeat(32);
    const plaintextDatabase = createDatabaseMock({ applicationTableCount: 4 });
    const encryptedDatabase = createDatabaseMock({
      path: '/databases/acte_notes.db.encrypted-migration',
    });
    mockGetSecureItem.mockResolvedValue(key);
    mockGetInfoAsync.mockImplementation(async (path: string) => ({
      exists:
        path === 'file:///databases/acte_notes.db' ||
        path === 'file:///databases/acte_notes.db.encrypted-migration',
      isDirectory: false,
      uri: path,
    }));
    mockOpenDatabaseAsync
      .mockResolvedValueOnce(plaintextDatabase)
      .mockResolvedValueOnce(encryptedDatabase);

    await expect(
      openProtectedDatabase('acte_notes.db', undefined, {
        forceEncryptionInTests: true,
      })
    ).resolves.toBe(encryptedDatabase);

    expect(encryptedDatabase.execAsync).toHaveBeenCalledWith(
      `PRAGMA key = "x'${key}'";`
    );
    expect(plaintextDatabase.closeAsync).toHaveBeenCalled();
    expect(mockDeleteAsync).toHaveBeenCalledWith('file:///databases/acte_notes.db', {
      idempotent: true,
    });
    expect(plaintextDatabase.execAsync).not.toHaveBeenCalledWith(
      expect.stringContaining("sqlcipher_export('encrypted')")
    );
  });

  it('refuses to reset an encrypted database when its device key is missing', async () => {
    const probeDatabase = createDatabaseMock({ readable: false });
    mockOpenDatabaseAsync.mockResolvedValue(probeDatabase);

    await expect(
      openProtectedDatabase('acte_notes.db', undefined, {
        forceEncryptionInTests: true,
      })
    ).rejects.toThrow('device encryption key is unavailable');

    expect(probeDatabase.closeAsync).toHaveBeenCalled();
    expect(mockSetSecureItem).not.toHaveBeenCalled();
  });

  it('keeps a readable plaintext database available in a stale development build', async () => {
    const plaintextDatabase = createDatabaseMock({
      applicationTableCount: 4,
      cipherVersion: null,
    });
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockOpenDatabaseAsync.mockResolvedValue(plaintextDatabase);

    await expect(
      openProtectedDatabase('acte_notes.db', undefined, {
        allowUnencryptedDevelopmentFallback: true,
        forceEncryptionInTests: true,
      })
    ).resolves.toBe(plaintextDatabase);

    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('Rebuild the native app to enable encryption')
    );
    expect(plaintextDatabase.closeAsync).not.toHaveBeenCalled();
    expect(mockSetSecureItem).not.toHaveBeenCalled();
    expect(mockDeleteAsync).not.toHaveBeenCalled();
    expect(mockMoveAsync).not.toHaveBeenCalled();
  });

  it('fails closed when SQLCipher is unavailable outside the development fallback', async () => {
    const plaintextDatabase = createDatabaseMock({
      applicationTableCount: 4,
      cipherVersion: null,
    });
    mockOpenDatabaseAsync.mockResolvedValue(plaintextDatabase);

    await expect(
      openProtectedDatabase('acte_notes.db', undefined, {
        allowUnencryptedDevelopmentFallback: false,
        forceEncryptionInTests: true,
      })
    ).rejects.toThrow('SQLCipher is unavailable in this native build');

    expect(plaintextDatabase.closeAsync).toHaveBeenCalled();
    expect(mockSetSecureItem).not.toHaveBeenCalled();
  });

  it('never opens an unreadable encrypted database without SQLCipher', async () => {
    const encryptedDatabase = createDatabaseMock({
      readable: false,
      cipherVersion: null,
    });
    mockGetSecureItem.mockResolvedValue('ab'.repeat(32));
    mockOpenDatabaseAsync.mockResolvedValue(encryptedDatabase);

    await expect(
      openProtectedDatabase('acte_notes.db', undefined, {
        allowUnencryptedDevelopmentFallback: true,
        forceEncryptionInTests: true,
      })
    ).rejects.toThrow('SQLCipher is unavailable in this native build');

    expect(encryptedDatabase.closeAsync).toHaveBeenCalled();
  });
});

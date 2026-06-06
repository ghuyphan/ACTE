import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import * as FileSystem from '../utils/fileSystem';

const DATABASE_ENCRYPTION_KEY_NAME = 'noto.sqlite.encryption-key.v1';
const ENCRYPTED_DATABASE_SUFFIX = '.encrypted-migration';
const PLAINTEXT_BACKUP_SUFFIX = '.plaintext-backup';
let didWarnAboutDevelopmentFallback = false;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function escapeSqlLiteral(value: string) {
  return value.replace(/'/g, "''");
}

function toFileUri(path: string) {
  return path.startsWith('/') ? `file://${path}` : path;
}

function assertEncryptionKey(key: string) {
  if (!/^[a-f0-9]{64}$/i.test(key)) {
    throw new Error('The local database encryption key is invalid.');
  }
}

async function createEncryptionKey() {
  const key = bytesToHex(await Crypto.getRandomBytesAsync(32));
  await SecureStore.setItemAsync(DATABASE_ENCRYPTION_KEY_NAME, key);
  return key;
}

async function applyDatabaseKey(database: SQLite.SQLiteDatabase, key: string) {
  assertEncryptionKey(key);
  await database.execAsync(`PRAGMA key = "x'${key}'";`);
}

async function getSqlCipherVersion(database: SQLite.SQLiteDatabase) {
  const row = await database.getFirstAsync<Record<string, unknown>>('PRAGMA cipher_version');
  const version = row ? Object.values(row)[0] : null;
  return typeof version === 'string' ? version.trim() : '';
}

async function assertSqlCipherAvailable(database: SQLite.SQLiteDatabase) {
  if (!(await getSqlCipherVersion(database))) {
    throw new Error('SQLCipher is unavailable in this native build.');
  }
}

async function verifyDatabaseReadable(database: SQLite.SQLiteDatabase) {
  await database.getFirstAsync('SELECT COUNT(*) AS count FROM sqlite_master');
}

async function hasApplicationTables(database: SQLite.SQLiteDatabase) {
  const row = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM sqlite_master
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
  );
  return (row?.count ?? 0) > 0;
}

async function removeFileIfPresent(path: string) {
  const fileUri = toFileUri(path);
  const info = await FileSystem.getInfoAsync(fileUri);
  if (info.exists) {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
  }
}

async function openEncryptedDatabase(
  databaseName: string,
  key: string,
  openOptions?: SQLite.SQLiteOpenOptions
) {
  const database = await SQLite.openDatabaseAsync(databaseName, openOptions);
  try {
    await applyDatabaseKey(database, key);
    await assertSqlCipherAvailable(database);
    await verifyDatabaseReadable(database);
    return database;
  } catch (error) {
    await database.closeAsync().catch(() => undefined);
    throw error;
  }
}

async function replacePlaintextDatabase(
  databaseName: string,
  database: SQLite.SQLiteDatabase,
  key: string,
  openOptions?: SQLite.SQLiteOpenOptions
) {
  const sourcePath = database.databasePath;
  const encryptedDatabaseName = `${databaseName}${ENCRYPTED_DATABASE_SUFFIX}`;
  const encryptedPath = `${sourcePath}${ENCRYPTED_DATABASE_SUFFIX}`;
  await removeFileIfPresent(encryptedPath);

  await database.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
  await database.execAsync('PRAGMA journal_mode = DELETE;');
  const userVersion =
    (
      await database.getFirstAsync<{ user_version: number }>(
        'PRAGMA user_version'
      )
    )?.user_version ?? 0;
  await assertSqlCipherAvailable(database);
  await database.execAsync(`
    ATTACH DATABASE '${escapeSqlLiteral(encryptedPath)}'
      AS encrypted KEY "x'${key}'";
    SELECT sqlcipher_export('encrypted');
    PRAGMA encrypted.user_version = ${Math.max(0, Math.floor(userVersion))};
    DETACH DATABASE encrypted;
  `);
  await database.closeAsync();

  try {
    const encryptedDatabase = await openEncryptedDatabase(
      encryptedDatabaseName,
      key,
      openOptions
    );
    await removeFileIfPresent(sourcePath);
    await removeFileIfPresent(`${sourcePath}-wal`);
    await removeFileIfPresent(`${sourcePath}-shm`);
    return encryptedDatabase;
  } catch (error) {
    // Keep the readable plaintext source intact if verification fails.
    await removeFileIfPresent(encryptedPath);
    throw error;
  }
}

async function tryAdoptEncryptedExport(
  databaseName: string,
  sourceDatabase: SQLite.SQLiteDatabase,
  key: string,
  openOptions?: SQLite.SQLiteOpenOptions
) {
  const sourcePath = sourceDatabase.databasePath;
  const encryptedPath = `${sourcePath}${ENCRYPTED_DATABASE_SUFFIX}`;
  const encryptedInfo = await FileSystem.getInfoAsync(toFileUri(encryptedPath));
  if (!encryptedInfo.exists) {
    return null;
  }

  const encryptedDatabase = await openEncryptedDatabase(
    `${databaseName}${ENCRYPTED_DATABASE_SUFFIX}`,
    key,
    openOptions
  );
  await sourceDatabase.closeAsync();
  try {
    await removeFileIfPresent(sourcePath);
    await removeFileIfPresent(`${sourcePath}-wal`);
    await removeFileIfPresent(`${sourcePath}-shm`);
    await removeFileIfPresent(`${sourcePath}${PLAINTEXT_BACKUP_SUFFIX}`);
  } catch (error) {
    console.warn(
      '[database] Encrypted database verified, but plaintext cleanup must be retried:',
      error
    );
  }
  return encryptedDatabase;
}

export async function openProtectedDatabase(
  databaseName: string,
  openOptions?: SQLite.SQLiteOpenOptions,
  options: {
    allowUnencryptedDevelopmentFallback?: boolean;
    forceEncryptionInTests?: boolean;
  } = {}
) {
  const shouldEncrypt =
    (Platform.OS === 'ios' || Platform.OS === 'android') &&
    (process.env.NODE_ENV !== 'test' || options.forceEncryptionInTests === true);
  if (!shouldEncrypt) {
    return SQLite.openDatabaseAsync(databaseName, openOptions);
  }

  const existingKey = await SecureStore.getItemAsync(DATABASE_ENCRYPTION_KEY_NAME);
  const database = await SQLite.openDatabaseAsync(databaseName, openOptions);
  let plaintextReadable = true;
  try {
    await verifyDatabaseReadable(database);
  } catch {
    plaintextReadable = false;
  }

  const sqlCipherAvailable = Boolean(await getSqlCipherVersion(database));
  if (!sqlCipherAvailable) {
    const allowDevelopmentFallback =
      options.allowUnencryptedDevelopmentFallback ??
      (typeof __DEV__ !== 'undefined' && __DEV__);
    if (plaintextReadable && allowDevelopmentFallback) {
      if (!didWarnAboutDevelopmentFallback) {
        didWarnAboutDevelopmentFallback = true;
        console.warn(
          '[database] SQLCipher is unavailable in this development build; continuing with the readable plaintext database. Rebuild the native app to enable encryption.'
        );
      }
      return database;
    }

    await database.closeAsync().catch(() => undefined);
    throw new Error('SQLCipher is unavailable in this native build.');
  }

  if (existingKey) {
    try {
      const adoptedDatabase = await tryAdoptEncryptedExport(
        databaseName,
        database,
        existingKey,
        openOptions
      );
      if (adoptedDatabase) {
        return adoptedDatabase;
      }
    } catch (error) {
      if (!plaintextReadable) {
        await database.closeAsync().catch(() => undefined);
        throw error;
      }
      await removeFileIfPresent(`${database.databasePath}${ENCRYPTED_DATABASE_SUFFIX}`);
    }
  }

  if (!plaintextReadable) {
    if (!existingKey) {
      await database.closeAsync().catch(() => undefined);
      throw new Error(
        'The encrypted local database exists, but its device encryption key is unavailable.'
      );
    }

    await database.closeAsync().catch(() => undefined);
    return openEncryptedDatabase(databaseName, existingKey, openOptions);
  }

  const key = existingKey ?? (await createEncryptionKey());
  if (!(await hasApplicationTables(database))) {
    const databasePath = database.databasePath;
    await database.closeAsync();
    await removeFileIfPresent(databasePath);
    const encryptedDatabase = await SQLite.openDatabaseAsync(databaseName, openOptions);
    await applyDatabaseKey(encryptedDatabase, key);
    await assertSqlCipherAvailable(encryptedDatabase);
    return encryptedDatabase;
  }

  return replacePlaintextDatabase(databaseName, database, key, openOptions);
}

export async function deleteProtectedDatabase(databaseName: string) {
  await Promise.all([
    SQLite.deleteDatabaseAsync(databaseName).catch(() => undefined),
    SQLite.deleteDatabaseAsync(`${databaseName}${ENCRYPTED_DATABASE_SUFFIX}`).catch(
      () => undefined
    ),
  ]);
}

import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import { DEFAULT_NOTE_RADIUS } from '../constants/noteRadius';
import { buildNoteSearchText } from './noteSearch';
import { resolveStoredPhotoUri } from './photoStorage';

// ─── Types ──────────────────────────────────────────────────────────
export type NoteType = 'text' | 'photo';

export interface Note {
    id: string;
    type: NoteType;
    content: string;          // text content or local photo URI
    photoLocalUri?: string | null;
    photoRemoteBase64?: string | null;
    locationName: string | null;
    latitude: number;
    longitude: number;
    radius: number;           // geofence radius in meters
    isFavorite: boolean;
    createdAt: string;        // ISO timestamp
    updatedAt: string | null;
}

export interface CreateNoteInput {
    type: NoteType;
    content: string;
    photoLocalUri?: string | null;
    photoRemoteBase64?: string | null;
    locationName?: string;
    latitude: number;
    longitude: number;
    radius?: number;
}

export type NoteUpdates = Partial<
    Pick<Note, 'content' | 'photoLocalUri' | 'photoRemoteBase64' | 'locationName' | 'radius'>
>;

export type UpsertNoteInput = Omit<Note, 'isFavorite'> & { isFavorite?: boolean };

interface NoteRow {
    id: string;
    type: NoteType;
    content: string;
    photo_local_uri: string | null;
    photo_remote_base64: string | null;
    location_name: string | null;
    latitude: number;
    longitude: number;
    radius: number;
    is_favorite: number;
    created_at: string;
    updated_at: string | null;
    search_text: string | null;
}

// ─── Database ───────────────────────────────────────────────────────
let db: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;
const NOTE_METADATA_SCHEMA_VERSION = 1;

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
    if (db) {
        return db;
    }

    if (!dbInitPromise) {
        dbInitPromise = (async () => {
            const database = await SQLite.openDatabaseAsync('acte_notes.db');
            await database.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('text', 'photo')),
        content TEXT NOT NULL,
        photo_local_uri TEXT,
        photo_remote_base64 TEXT,
        location_name TEXT,
        search_text TEXT NOT NULL DEFAULT '',
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        radius REAL NOT NULL DEFAULT 150,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at DESC);
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity TEXT NOT NULL CHECK(entity IN ('note')),
        entity_id TEXT,
        operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete', 'deleteAll')),
        payload TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'failed')),
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status_created ON sync_queue(status, created_at ASC);
    `);

            // Migration: add missing columns for existing databases before touching dependent indexes/queries.
            try {
                const userVersionRow = await database.getFirstAsync<{ user_version: number }>(
                    'PRAGMA user_version'
                );
                const currentUserVersion = userVersionRow?.user_version ?? 0;
                const tableInfo = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(notes)`);
                const columns = tableInfo.map((col) => col.name);
                let shouldBackfillNoteMetadata = currentUserVersion < NOTE_METADATA_SCHEMA_VERSION;

                if (!columns.includes('is_favorite')) {
                    await database.execAsync(`ALTER TABLE notes ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0`);
                }
                if (!columns.includes('photo_local_uri')) {
                    await database.execAsync(`ALTER TABLE notes ADD COLUMN photo_local_uri TEXT`);
                    shouldBackfillNoteMetadata = true;
                }
                if (!columns.includes('photo_remote_base64')) {
                    await database.execAsync(`ALTER TABLE notes ADD COLUMN photo_remote_base64 TEXT`);
                }
                if (!columns.includes('search_text')) {
                    await database.execAsync(`ALTER TABLE notes ADD COLUMN search_text TEXT NOT NULL DEFAULT ''`);
                    shouldBackfillNoteMetadata = true;
                }

                await database.execAsync(`CREATE INDEX IF NOT EXISTS idx_notes_search_text ON notes(search_text)`);

                if (shouldBackfillNoteMetadata) {
                    const rows = await database.getAllAsync<{
                        id: string;
                        type: NoteType;
                        content: string;
                        photo_local_uri: string | null;
                        location_name: string | null;
                        search_text: string | null;
                    }>(
                        `SELECT id, type, content, photo_local_uri, location_name, search_text
                         FROM notes`
                    );

                    for (const row of rows) {
                        const photoLocalUri =
                            row.type === 'photo'
                                ? resolveStoredPhotoUri(row.photo_local_uri ?? row.content)
                                : null;
                        const searchText = buildNoteSearchText({
                            type: row.type,
                            content: row.type === 'photo' ? '' : row.content,
                            locationName: row.location_name,
                        });

                        if (
                            row.photo_local_uri !== photoLocalUri ||
                            (row.search_text ?? '') !== searchText
                        ) {
                            await database.runAsync(
                                `UPDATE notes
                                 SET photo_local_uri = ?, search_text = ?
                                 WHERE id = ?`,
                                photoLocalUri,
                                searchText,
                                row.id
                            );
                        }
                    }
                }

                if (currentUserVersion < NOTE_METADATA_SCHEMA_VERSION) {
                    await database.execAsync(`PRAGMA user_version = ${NOTE_METADATA_SCHEMA_VERSION}`);
                }
            } catch (e) {
                console.warn('Migration check failed:', e);
            }

            db = database;
            return database;
        })().catch((error) => {
            db = null;
            dbInitPromise = null;
            throw error;
        });
    }

    return dbInitPromise;
}

// ─── Helpers ────────────────────────────────────────────────────────
function generateId(): string {
    // Replaced Math.random with cryptographically secure UUID
    return `note-${Date.now()}-${Crypto.randomUUID().substring(0, 8)}`;
}

function getResolvedPhotoLocalUri(row: Pick<NoteRow, 'type' | 'content' | 'photo_local_uri'>) {
    if (row.type !== 'photo') {
        return null;
    }

    return resolveStoredPhotoUri(row.photo_local_uri ?? row.content);
}

function buildSearchText(input: {
    type: NoteType;
    content: string;
    locationName: string | null;
}) {
    return buildNoteSearchText({
        type: input.type,
        content: input.type === 'text' ? input.content : '',
        locationName: input.locationName,
    });
}

function rowToNote(row: NoteRow): Note {
    const photoLocalUri = getResolvedPhotoLocalUri(row);
    return {
        id: row.id,
        type: row.type as NoteType,
        content: row.type === 'photo' ? photoLocalUri ?? '' : row.content,
        photoLocalUri,
        photoRemoteBase64: row.photo_remote_base64,
        locationName: row.location_name,
        latitude: row.latitude,
        longitude: row.longitude,
        radius: row.radius,
        isFavorite: row.is_favorite === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// ─── CRUD Operations ────────────────────────────────────────────────
export async function createNote(input: CreateNoteInput): Promise<Note> {
    const database = await getDB();
    const id = generateId();
    const now = new Date().toISOString();
    const photoLocalUri =
        input.type === 'photo' ? resolveStoredPhotoUri(input.photoLocalUri ?? input.content) : null;
    const normalizedContent = input.type === 'photo' ? photoLocalUri ?? '' : input.content;
    const searchText = buildSearchText({
        type: input.type,
        content: normalizedContent,
        locationName: input.locationName ?? null,
    });

    await database.runAsync(
        `INSERT INTO notes (
            id,
            type,
            content,
            photo_local_uri,
            photo_remote_base64,
            location_name,
            search_text,
            latitude,
            longitude,
            radius,
            is_favorite,
            created_at
        )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        id,
        input.type,
        normalizedContent,
        photoLocalUri,
        input.photoRemoteBase64 ?? null,
        input.locationName ?? null,
        searchText,
        input.latitude,
        input.longitude,
        input.radius ?? DEFAULT_NOTE_RADIUS,
        now
    );

    return {
        id,
        type: input.type,
        content: normalizedContent,
        photoLocalUri,
        photoRemoteBase64: input.photoRemoteBase64 ?? null,
        locationName: input.locationName ?? null,
        latitude: input.latitude,
        longitude: input.longitude,
        radius: input.radius ?? DEFAULT_NOTE_RADIUS,
        isFavorite: false,
        createdAt: now,
        updatedAt: null,
    };
}

export async function getAllNotes(): Promise<Note[]> {
    const database = await getDB();
    const rows = await database.getAllAsync<NoteRow>('SELECT * FROM notes ORDER BY created_at DESC');
    return rows.map(rowToNote);
}

export async function getNoteById(id: string): Promise<Note | null> {
    const database = await getDB();
    const row = await database.getFirstAsync<NoteRow>('SELECT * FROM notes WHERE id = ?', id);
    return row ? rowToNote(row) : null;
}

export async function updateNote(id: string, updates: NoteUpdates): Promise<void> {
    const database = await getDB();
    const existing = await getNoteById(id);
    if (!existing) {
        return;
    }

    const nextType = existing.type;
    const nextPhotoLocalUri =
        nextType === 'photo'
            ? resolveStoredPhotoUri(
                updates.photoLocalUri ??
                (updates.content !== undefined ? updates.content : existing.photoLocalUri ?? existing.content)
            )
            : null;
    const nextContent =
        nextType === 'photo'
            ? nextPhotoLocalUri ?? ''
            : updates.content ?? existing.content;
    const nextLocationName =
        updates.locationName !== undefined ? updates.locationName : existing.locationName;
    const nextRadius = updates.radius ?? existing.radius;
    const nextPhotoRemoteBase64 =
        updates.photoRemoteBase64 !== undefined
            ? updates.photoRemoteBase64
            : existing.photoRemoteBase64 ?? null;
    const now = new Date().toISOString();
    const searchText = buildSearchText({
        type: nextType,
        content: nextContent,
        locationName: nextLocationName,
    });

    await database.runAsync(
        `UPDATE notes
         SET content = ?,
             photo_local_uri = ?,
             photo_remote_base64 = ?,
             location_name = ?,
             search_text = ?,
             radius = ?,
             updated_at = ?
         WHERE id = ?`,
        nextContent,
        nextPhotoLocalUri,
        nextPhotoRemoteBase64,
        nextLocationName,
        searchText,
        nextRadius,
        now,
        id
    );
}

export async function toggleFavorite(id: string): Promise<boolean> {
    const database = await getDB();
    const row = await database.getFirstAsync<{ is_favorite: number }>(
        'SELECT is_favorite FROM notes WHERE id = ?',
        id
    );
    if (!row) return false;
    const newValue = row.is_favorite === 1 ? 0 : 1;
    await database.runAsync(
        'UPDATE notes SET is_favorite = ?, updated_at = ? WHERE id = ?',
        newValue,
        new Date().toISOString(),
        id
    );
    return newValue === 1;
}

export async function searchNotes(query: string): Promise<Note[]> {
    const database = await getDB();
    const normalizedTokens = buildNoteSearchText({
        type: 'text',
        content: query,
        locationName: null,
    })
        .split(' ')
        .filter(Boolean);

    if (normalizedTokens.length === 0) {
        return getAllNotes();
    }

    const whereClause = normalizedTokens.map(() => `search_text LIKE ?`).join(' AND ');
    const params = normalizedTokens.map((token) => `%${token}%`);
    const rows = await database.getAllAsync<NoteRow>(
        `SELECT * FROM notes WHERE ${whereClause} ORDER BY created_at DESC`,
        ...params
    );
    return rows.map(rowToNote);
}

export async function deleteNote(id: string): Promise<void> {
    const database = await getDB();
    await database.runAsync('DELETE FROM notes WHERE id = ?', id);
}

export async function deleteAllNotes(): Promise<void> {
    const database = await getDB();
    await database.runAsync('DELETE FROM notes');
}

export async function getNotesCount(): Promise<number> {
    const database = await getDB();
    const result = await database.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM notes'
    );
    return result?.count ?? 0;
}

export async function upsertNote(input: UpsertNoteInput): Promise<Note> {
    const database = await getDB();
    const photoLocalUri =
        input.type === 'photo'
            ? resolveStoredPhotoUri(input.photoLocalUri ?? input.content)
            : null;
    const normalizedContent = input.type === 'photo' ? photoLocalUri ?? '' : input.content;
    const searchText = buildSearchText({
        type: input.type,
        content: normalizedContent,
        locationName: input.locationName,
    });

    await database.runAsync(
        `INSERT INTO notes (
            id,
            type,
            content,
            photo_local_uri,
            photo_remote_base64,
            location_name,
            search_text,
            latitude,
            longitude,
            radius,
            is_favorite,
            created_at,
            updated_at
        )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
            type = excluded.type,
            content = excluded.content,
            photo_local_uri = excluded.photo_local_uri,
            photo_remote_base64 = excluded.photo_remote_base64,
            location_name = excluded.location_name,
            search_text = excluded.search_text,
            latitude = excluded.latitude,
            longitude = excluded.longitude,
            radius = excluded.radius,
            is_favorite = excluded.is_favorite,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at`,
        input.id,
        input.type,
        normalizedContent,
        photoLocalUri,
        input.photoRemoteBase64 ?? null,
        input.locationName ?? null,
        searchText,
        input.latitude,
        input.longitude,
        input.radius ?? DEFAULT_NOTE_RADIUS,
        input.isFavorite ? 1 : 0,
        input.createdAt,
        input.updatedAt ?? null
    );

    return {
        id: input.id,
        type: input.type,
        content: normalizedContent,
        photoLocalUri,
        photoRemoteBase64: input.photoRemoteBase64 ?? null,
        locationName: input.locationName ?? null,
        latitude: input.latitude,
        longitude: input.longitude,
        radius: input.radius ?? DEFAULT_NOTE_RADIUS,
        isFavorite: Boolean(input.isFavorite),
        createdAt: input.createdAt,
        updatedAt: input.updatedAt ?? null,
    };
}

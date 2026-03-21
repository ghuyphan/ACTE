import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
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
    promptId?: string | null;
    promptTextSnapshot?: string | null;
    promptAnswer?: string | null;
    moodEmoji?: string | null;
    latitude: number;
    longitude: number;
    radius: number;           // geofence radius in meters
    isFavorite: boolean;
    hasDoodle?: boolean;
    doodleStrokesJson?: string | null;
    createdAt: string;        // ISO timestamp
    updatedAt: string | null;
}

export interface CreateNoteInput {
    type: NoteType;
    content: string;
    photoLocalUri?: string | null;
    photoRemoteBase64?: string | null;
    locationName?: string;
    promptId?: string | null;
    promptTextSnapshot?: string | null;
    promptAnswer?: string | null;
    moodEmoji?: string | null;
    latitude: number;
    longitude: number;
    radius?: number;
    hasDoodle?: boolean;
    doodleStrokesJson?: string | null;
}

export type NoteUpdates = Partial<
    Pick<
        Note,
        | 'content'
        | 'photoLocalUri'
        | 'photoRemoteBase64'
        | 'locationName'
        | 'promptId'
        | 'promptTextSnapshot'
        | 'promptAnswer'
        | 'moodEmoji'
        | 'radius'
    >
>;

export type UpsertNoteInput = Omit<Note, 'isFavorite'> & { isFavorite?: boolean };

interface NoteRow {
    id: string;
    type: NoteType;
    content: string;
    photo_local_uri: string | null;
    photo_remote_base64: string | null;
    location_name: string | null;
    prompt_id: string | null;
    prompt_text_snapshot: string | null;
    prompt_answer: string | null;
    mood_emoji: string | null;
    latitude: number;
    longitude: number;
    radius: number;
    is_favorite: number;
    created_at: string;
    updated_at: string | null;
    search_text: string | null;
    has_doodle?: number;
    doodle_strokes_json?: string | null;
}

// ─── Database ───────────────────────────────────────────────────────
let db: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;
const APP_SCHEMA_VERSION = 5;
const NOTES_SELECT_FIELDS = `notes.*,
      EXISTS(SELECT 1 FROM note_doodles doodles WHERE doodles.note_id = notes.id) AS has_doodle,
      (SELECT doodles.strokes_json FROM note_doodles doodles WHERE doodles.note_id = notes.id LIMIT 1) AS doodle_strokes_json`;

async function safelyCloseDatabase(database: SQLite.SQLiteDatabase | null) {
    if (!database) {
        return;
    }

    try {
        await database.closeAsync();
    } catch {
        // Ignore close failures while recovering from a broken native handle.
    }
}

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
    if (db) {
        if (Platform.OS === 'android') {
            try {
                await db.isInTransactionAsync();
            } catch {
                await safelyCloseDatabase(db);
                db = null;
                dbInitPromise = null;
            }
        }
    }

    if (db) {
        return db;
    }

    if (!dbInitPromise) {
        dbInitPromise = (async () => {
            const database = await SQLite.openDatabaseAsync(
                'acte_notes.db',
                Platform.OS === 'android' ? { useNewConnection: true } : undefined
            );
            await database.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('text', 'photo')),
        content TEXT NOT NULL,
        photo_local_uri TEXT,
        photo_remote_base64 TEXT,
        location_name TEXT,
        prompt_id TEXT,
        prompt_text_snapshot TEXT,
        prompt_answer TEXT,
        mood_emoji TEXT,
        search_text TEXT NOT NULL DEFAULT '',
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        radius REAL NOT NULL DEFAULT 150,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at DESC);
      CREATE TABLE IF NOT EXISTS note_doodles (
        note_id TEXT PRIMARY KEY NOT NULL,
        strokes_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity TEXT NOT NULL CHECK(entity IN ('note')),
        entity_id TEXT,
        operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete', 'deleteAll')),
        payload TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'failed')),
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        next_retry_at TEXT,
        terminal INTEGER NOT NULL DEFAULT 0,
        blocked_reason TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status_created ON sync_queue(status, created_at ASC);
      CREATE TABLE IF NOT EXISTS rooms_cache (
        user_uid TEXT NOT NULL,
        id TEXT NOT NULL,
        name TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_post_at TEXT,
        cover_photo_url TEXT,
        current_user_role TEXT NOT NULL CHECK(current_user_role IN ('owner', 'member')),
        member_count INTEGER NOT NULL DEFAULT 0,
        last_post_preview TEXT,
        PRIMARY KEY (user_uid, id)
      );
      CREATE INDEX IF NOT EXISTS idx_rooms_cache_user_updated ON rooms_cache(user_uid, updated_at DESC);
      CREATE TABLE IF NOT EXISTS room_memberships_cache (
        user_uid TEXT NOT NULL,
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('owner', 'member')),
        display_name_snapshot TEXT,
        photo_url_snapshot TEXT,
        joined_at TEXT NOT NULL,
        last_read_at TEXT,
        PRIMARY KEY (user_uid, room_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_room_memberships_cache_room ON room_memberships_cache(user_uid, room_id);
      CREATE TABLE IF NOT EXISTS room_posts_cache (
        user_uid TEXT NOT NULL,
        room_id TEXT NOT NULL,
        id TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_display_name TEXT,
        origin TEXT NOT NULL CHECK(origin IN ('shared_note', 'room_native')),
        type TEXT NOT NULL CHECK(type IN ('text', 'photo')),
        text TEXT NOT NULL DEFAULT '',
        photo_local_uri TEXT,
        photo_remote_base64 TEXT,
        place_name TEXT,
        source_note_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        PRIMARY KEY (user_uid, room_id, id)
      );
      CREATE INDEX IF NOT EXISTS idx_room_posts_cache_room_created ON room_posts_cache(user_uid, room_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS room_read_state (
        user_uid TEXT NOT NULL,
        room_id TEXT NOT NULL,
        last_read_at TEXT,
        PRIMARY KEY (user_uid, room_id)
      );
      CREATE INDEX IF NOT EXISTS idx_room_read_state_user ON room_read_state(user_uid, room_id);
      CREATE TABLE IF NOT EXISTS room_invites_cache (
        user_uid TEXT NOT NULL,
        room_id TEXT NOT NULL,
        id TEXT NOT NULL,
        token TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT,
        revoked_at TEXT,
        url TEXT NOT NULL,
        PRIMARY KEY (user_uid, room_id)
      );
      CREATE TABLE IF NOT EXISTS rooms_cache_meta (
        user_uid TEXT PRIMARY KEY NOT NULL,
        last_updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS shared_friends_cache (
        user_uid TEXT NOT NULL,
        friend_uid TEXT NOT NULL,
        display_name_snapshot TEXT,
        photo_url_snapshot TEXT,
        friended_at TEXT NOT NULL,
        last_shared_at TEXT,
        created_by_invite_id TEXT,
        created_by_invite_token TEXT,
        PRIMARY KEY (user_uid, friend_uid)
      );
      CREATE INDEX IF NOT EXISTS idx_shared_friends_cache_user ON shared_friends_cache(user_uid, friended_at ASC);
      CREATE TABLE IF NOT EXISTS shared_posts_cache (
        user_uid TEXT NOT NULL,
        id TEXT NOT NULL,
        author_uid TEXT NOT NULL,
        author_display_name TEXT,
        author_photo_url_snapshot TEXT,
        audience_user_ids TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('text', 'photo')),
        text TEXT NOT NULL DEFAULT '',
        photo_local_uri TEXT,
        photo_remote_base64 TEXT,
        doodle_strokes_json TEXT,
        place_name TEXT,
        source_note_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        PRIMARY KEY (user_uid, id)
      );
      CREATE INDEX IF NOT EXISTS idx_shared_posts_cache_user_created ON shared_posts_cache(user_uid, created_at DESC);
      CREATE TABLE IF NOT EXISTS shared_invites_cache (
        user_uid TEXT PRIMARY KEY NOT NULL,
        id TEXT NOT NULL,
        inviter_uid TEXT NOT NULL,
        inviter_display_name_snapshot TEXT,
        inviter_photo_url_snapshot TEXT,
        token TEXT NOT NULL,
        created_at TEXT NOT NULL,
        revoked_at TEXT,
        accepted_by_uid TEXT,
        accepted_at TEXT,
        expires_at TEXT,
        url TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS shared_feed_cache_meta (
        user_uid TEXT PRIMARY KEY NOT NULL,
        last_updated_at TEXT
      );
    `);

            // Migration: add missing columns for existing databases before touching dependent indexes/queries.
            try {
                const userVersionRow = await database.getFirstAsync<{ user_version: number }>(
                    'PRAGMA user_version'
                );
                const currentUserVersion = userVersionRow?.user_version ?? 0;
                const tableInfo = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(notes)`);
                const columns = tableInfo.map((col) => col.name);
                let shouldBackfillNoteMetadata = currentUserVersion < APP_SCHEMA_VERSION;

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
                if (!columns.includes('prompt_id')) {
                    await database.execAsync(`ALTER TABLE notes ADD COLUMN prompt_id TEXT`);
                }
                if (!columns.includes('prompt_text_snapshot')) {
                    await database.execAsync(`ALTER TABLE notes ADD COLUMN prompt_text_snapshot TEXT`);
                    shouldBackfillNoteMetadata = true;
                }
                if (!columns.includes('prompt_answer')) {
                    await database.execAsync(`ALTER TABLE notes ADD COLUMN prompt_answer TEXT`);
                    shouldBackfillNoteMetadata = true;
                }
                if (!columns.includes('mood_emoji')) {
                    await database.execAsync(`ALTER TABLE notes ADD COLUMN mood_emoji TEXT`);
                }

                await database.execAsync(`CREATE INDEX IF NOT EXISTS idx_notes_search_text ON notes(search_text)`);
                await database.execAsync(
                    `CREATE TABLE IF NOT EXISTS note_doodles (
                        note_id TEXT PRIMARY KEY NOT NULL,
                        strokes_json TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE
                    )`
                );

                if (shouldBackfillNoteMetadata) {
                    const rows = await database.getAllAsync<{
                        id: string;
                        type: NoteType;
                        content: string;
                        photo_local_uri: string | null;
                        location_name: string | null;
                        prompt_text_snapshot: string | null;
                        prompt_answer: string | null;
                        search_text: string | null;
                    }>(
                        `SELECT id, type, content, photo_local_uri, location_name, prompt_text_snapshot, prompt_answer, search_text
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
                            promptTextSnapshot: row.prompt_text_snapshot,
                            promptAnswer: row.prompt_answer,
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

                const syncQueueInfo = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(sync_queue)`);
                const syncQueueColumns = syncQueueInfo.map((col) => col.name);

                if (!syncQueueColumns.includes('next_retry_at')) {
                    await database.execAsync(`ALTER TABLE sync_queue ADD COLUMN next_retry_at TEXT`);
                }
                if (!syncQueueColumns.includes('terminal')) {
                    await database.execAsync(`ALTER TABLE sync_queue ADD COLUMN terminal INTEGER NOT NULL DEFAULT 0`);
                }
                if (!syncQueueColumns.includes('blocked_reason')) {
                    await database.execAsync(`ALTER TABLE sync_queue ADD COLUMN blocked_reason TEXT`);
                }

                await database.execAsync(
                    `CREATE INDEX IF NOT EXISTS idx_sync_queue_retry_window ON sync_queue(status, terminal, next_retry_at, created_at ASC)`
                );
                await database.execAsync(
                    `CREATE TABLE IF NOT EXISTS room_invites_cache (
                        user_uid TEXT NOT NULL,
                        room_id TEXT NOT NULL,
                        id TEXT NOT NULL,
                        token TEXT NOT NULL,
                        created_by TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        expires_at TEXT,
                        revoked_at TEXT,
                        url TEXT NOT NULL,
                        PRIMARY KEY (user_uid, room_id)
                    )`
                );
                await database.execAsync(
                    `CREATE TABLE IF NOT EXISTS rooms_cache_meta (
                        user_uid TEXT PRIMARY KEY NOT NULL,
                        last_updated_at TEXT
                    )`
                );
                await database.execAsync(
                    `CREATE TABLE IF NOT EXISTS shared_friends_cache (
                        user_uid TEXT NOT NULL,
                        friend_uid TEXT NOT NULL,
                        display_name_snapshot TEXT,
                        photo_url_snapshot TEXT,
                        friended_at TEXT NOT NULL,
                        last_shared_at TEXT,
                        created_by_invite_id TEXT,
                        created_by_invite_token TEXT,
                        PRIMARY KEY (user_uid, friend_uid)
                    )`
                );
                await database.execAsync(
                    `CREATE INDEX IF NOT EXISTS idx_shared_friends_cache_user ON shared_friends_cache(user_uid, friended_at ASC)`
                );
                await database.execAsync(
                    `CREATE TABLE IF NOT EXISTS shared_posts_cache (
                        user_uid TEXT NOT NULL,
                        id TEXT NOT NULL,
                        author_uid TEXT NOT NULL,
                        author_display_name TEXT,
                        author_photo_url_snapshot TEXT,
                        audience_user_ids TEXT NOT NULL,
                        type TEXT NOT NULL CHECK(type IN ('text', 'photo')),
                        text TEXT NOT NULL DEFAULT '',
                        photo_local_uri TEXT,
                        photo_remote_base64 TEXT,
                        doodle_strokes_json TEXT,
                        place_name TEXT,
                        source_note_id TEXT,
                        created_at TEXT NOT NULL,
                        updated_at TEXT,
                        PRIMARY KEY (user_uid, id)
                    )`
                );
                await database.execAsync(
                    `CREATE INDEX IF NOT EXISTS idx_shared_posts_cache_user_created ON shared_posts_cache(user_uid, created_at DESC)`
                );
                await database.execAsync(
                    `CREATE TABLE IF NOT EXISTS shared_invites_cache (
                        user_uid TEXT PRIMARY KEY NOT NULL,
                        id TEXT NOT NULL,
                        inviter_uid TEXT NOT NULL,
                        inviter_display_name_snapshot TEXT,
                        inviter_photo_url_snapshot TEXT,
                        token TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        revoked_at TEXT,
                        accepted_by_uid TEXT,
                        accepted_at TEXT,
                        expires_at TEXT,
                        url TEXT NOT NULL
                    )`
                );
                await database.execAsync(
                    `CREATE TABLE IF NOT EXISTS shared_feed_cache_meta (
                        user_uid TEXT PRIMARY KEY NOT NULL,
                        last_updated_at TEXT
                    )`
                );

                if (currentUserVersion < APP_SCHEMA_VERSION) {
                    await database.execAsync(`PRAGMA user_version = ${APP_SCHEMA_VERSION}`);
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
    promptTextSnapshot?: string | null;
    promptAnswer?: string | null;
}) {
    return buildNoteSearchText({
        type: input.type,
        content: input.type === 'text' ? input.content : '',
        locationName: input.locationName,
        promptTextSnapshot: input.promptTextSnapshot,
        promptAnswer: input.promptAnswer,
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
        promptId: row.prompt_id,
        promptTextSnapshot: row.prompt_text_snapshot,
        promptAnswer: row.prompt_answer,
        moodEmoji: row.mood_emoji,
        latitude: row.latitude,
        longitude: row.longitude,
        radius: row.radius,
        isFavorite: row.is_favorite === 1,
        hasDoodle: row.has_doodle === 1,
        doodleStrokesJson: row.doodle_strokes_json ?? null,
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
        promptTextSnapshot: input.promptTextSnapshot ?? null,
        promptAnswer: input.promptAnswer ?? null,
    });

    await database.runAsync(
        `INSERT INTO notes (
            id,
            type,
            content,
            photo_local_uri,
            photo_remote_base64,
            location_name,
            prompt_id,
            prompt_text_snapshot,
            prompt_answer,
            mood_emoji,
            search_text,
            latitude,
            longitude,
            radius,
            is_favorite,
            created_at
        )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        id,
        input.type,
        normalizedContent,
        photoLocalUri,
        input.photoRemoteBase64 ?? null,
        input.locationName ?? null,
        input.promptId ?? null,
        input.promptTextSnapshot ?? null,
        input.promptAnswer ?? null,
        input.moodEmoji ?? null,
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
        promptId: input.promptId ?? null,
        promptTextSnapshot: input.promptTextSnapshot ?? null,
        promptAnswer: input.promptAnswer ?? null,
        moodEmoji: input.moodEmoji ?? null,
        latitude: input.latitude,
        longitude: input.longitude,
        radius: input.radius ?? DEFAULT_NOTE_RADIUS,
        isFavorite: false,
        hasDoodle: input.hasDoodle ?? false,
        doodleStrokesJson: input.doodleStrokesJson ?? null,
        createdAt: now,
        updatedAt: null,
    };
}

export async function getAllNotes(): Promise<Note[]> {
    const database = await getDB();
    const rows = await database.getAllAsync<NoteRow>(
        `SELECT ${NOTES_SELECT_FIELDS}
         FROM notes
         ORDER BY created_at DESC`
    );
    return rows.map(rowToNote);
}

export async function getNoteById(id: string): Promise<Note | null> {
    const database = await getDB();
    const row = await database.getFirstAsync<NoteRow>(
        `SELECT ${NOTES_SELECT_FIELDS}
         FROM notes
         WHERE id = ?`,
        id
    );
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
    const nextPromptId =
        updates.promptId !== undefined ? updates.promptId : existing.promptId ?? null;
    const nextPromptTextSnapshot =
        updates.promptTextSnapshot !== undefined
            ? updates.promptTextSnapshot
            : existing.promptTextSnapshot ?? null;
    const nextPromptAnswer =
        updates.promptAnswer !== undefined ? updates.promptAnswer : existing.promptAnswer ?? null;
    const nextMoodEmoji =
        updates.moodEmoji !== undefined ? updates.moodEmoji : existing.moodEmoji ?? null;
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
        promptTextSnapshot: nextPromptTextSnapshot,
        promptAnswer: nextPromptAnswer,
    });

    await database.runAsync(
        `UPDATE notes
         SET content = ?,
             photo_local_uri = ?,
             photo_remote_base64 = ?,
             location_name = ?,
             prompt_id = ?,
             prompt_text_snapshot = ?,
             prompt_answer = ?,
             mood_emoji = ?,
             search_text = ?,
             radius = ?,
             updated_at = ?
         WHERE id = ?`,
        nextContent,
        nextPhotoLocalUri,
        nextPhotoRemoteBase64,
        nextLocationName,
        nextPromptId,
        nextPromptTextSnapshot,
        nextPromptAnswer,
        nextMoodEmoji,
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
        promptTextSnapshot: null,
        promptAnswer: null,
    })
        .split(' ')
        .filter(Boolean);

    if (normalizedTokens.length === 0) {
        return getAllNotes();
    }

    const whereClause = normalizedTokens.map(() => `search_text LIKE ?`).join(' AND ');
    const params = normalizedTokens.map((token) => `%${token}%`);
    const rows = await database.getAllAsync<NoteRow>(
        `SELECT ${NOTES_SELECT_FIELDS}
         FROM notes
         WHERE ${whereClause}
         ORDER BY created_at DESC`,
        ...params
    );
    return rows.map(rowToNote);
}

export async function deleteNote(id: string): Promise<void> {
    const database = await getDB();
    await database.runAsync('DELETE FROM note_doodles WHERE note_id = ?', id);
    await database.runAsync('DELETE FROM notes WHERE id = ?', id);
}

export async function deleteAllNotes(): Promise<void> {
    const database = await getDB();
    await database.runAsync('DELETE FROM note_doodles');
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
        promptTextSnapshot: input.promptTextSnapshot ?? null,
        promptAnswer: input.promptAnswer ?? null,
    });

    await database.runAsync(
        `INSERT INTO notes (
            id,
            type,
            content,
            photo_local_uri,
            photo_remote_base64,
            location_name,
            prompt_id,
            prompt_text_snapshot,
            prompt_answer,
            mood_emoji,
            search_text,
            latitude,
            longitude,
            radius,
            is_favorite,
            created_at,
            updated_at
        )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
            type = excluded.type,
            content = excluded.content,
            photo_local_uri = excluded.photo_local_uri,
            photo_remote_base64 = excluded.photo_remote_base64,
            location_name = excluded.location_name,
            prompt_id = excluded.prompt_id,
            prompt_text_snapshot = excluded.prompt_text_snapshot,
            prompt_answer = excluded.prompt_answer,
            mood_emoji = excluded.mood_emoji,
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
        input.promptId ?? null,
        input.promptTextSnapshot ?? null,
        input.promptAnswer ?? null,
        input.moodEmoji ?? null,
        searchText,
        input.latitude,
        input.longitude,
        input.radius ?? DEFAULT_NOTE_RADIUS,
        input.isFavorite ? 1 : 0,
        input.createdAt,
        input.updatedAt ?? null
    );

    if (input.hasDoodle && input.doodleStrokesJson) {
        await database.runAsync(
            `INSERT INTO note_doodles (note_id, strokes_json, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(note_id) DO UPDATE SET
                strokes_json = excluded.strokes_json,
                updated_at = excluded.updated_at`,
            input.id,
            input.doodleStrokesJson,
            input.updatedAt ?? input.createdAt
        );
    } else {
        await database.runAsync('DELETE FROM note_doodles WHERE note_id = ?', input.id);
    }

    return {
        id: input.id,
        type: input.type,
        content: normalizedContent,
        photoLocalUri,
        photoRemoteBase64: input.photoRemoteBase64 ?? null,
        locationName: input.locationName ?? null,
        promptId: input.promptId ?? null,
        promptTextSnapshot: input.promptTextSnapshot ?? null,
        promptAnswer: input.promptAnswer ?? null,
        moodEmoji: input.moodEmoji ?? null,
        latitude: input.latitude,
        longitude: input.longitude,
        radius: input.radius ?? DEFAULT_NOTE_RADIUS,
        isFavorite: Boolean(input.isFavorite),
        hasDoodle: input.hasDoodle ?? false,
        doodleStrokesJson: input.doodleStrokesJson ?? null,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt ?? null,
    };
}

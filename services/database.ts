import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { DEFAULT_NOTE_RADIUS } from '../constants/noteRadius';
import { buildNoteSearchText, tokenizeSearchQuery } from './noteSearch';
import { normalizeSavedTextNoteColor } from './noteAppearance';
import { resolveStoredPhotoUri } from './photoStorage';
import { resolveStoredPairedVideoUri } from './livePhotoStorage';

// ─── Types ──────────────────────────────────────────────────────────
export type NoteType = 'text' | 'photo';

export interface Note {
    id: string;
    type: NoteType;
    content: string;          // text content or local photo URI
    photoLocalUri?: string | null;
    photoSyncedLocalUri?: string | null;
    photoRemoteBase64?: string | null;
    isLivePhoto?: boolean;
    pairedVideoLocalUri?: string | null;
    pairedVideoSyncedLocalUri?: string | null;
    pairedVideoRemotePath?: string | null;
    locationName: string | null;
    promptId?: string | null;
    promptTextSnapshot?: string | null;
    promptAnswer?: string | null;
    moodEmoji?: string | null;
    noteColor?: string | null;
    latitude: number;
    longitude: number;
    radius: number;           // geofence radius in meters
    isFavorite: boolean;
    hasDoodle?: boolean;
    doodleStrokesJson?: string | null;
    hasStickers?: boolean;
    stickerPlacementsJson?: string | null;
    createdAt: string;        // ISO timestamp
    updatedAt: string | null;
}

export interface CreateNoteInput {
    id?: string;
    type: NoteType;
    content: string;
    photoLocalUri?: string | null;
    photoSyncedLocalUri?: string | null;
    photoRemoteBase64?: string | null;
    isLivePhoto?: boolean;
    pairedVideoLocalUri?: string | null;
    pairedVideoSyncedLocalUri?: string | null;
    pairedVideoRemotePath?: string | null;
    locationName?: string;
    promptId?: string | null;
    promptTextSnapshot?: string | null;
    promptAnswer?: string | null;
    moodEmoji?: string | null;
    noteColor?: string | null;
    latitude: number;
    longitude: number;
    radius?: number;
    hasDoodle?: boolean;
    doodleStrokesJson?: string | null;
    hasStickers?: boolean;
    stickerPlacementsJson?: string | null;
}

export type NoteUpdates = Partial<
    Pick<
        Note,
        | 'content'
        | 'photoLocalUri'
        | 'photoSyncedLocalUri'
        | 'photoRemoteBase64'
        | 'isLivePhoto'
        | 'pairedVideoLocalUri'
        | 'pairedVideoSyncedLocalUri'
        | 'pairedVideoRemotePath'
        | 'locationName'
        | 'promptId'
        | 'promptTextSnapshot'
        | 'promptAnswer'
        | 'moodEmoji'
        | 'noteColor'
        | 'radius'
        | 'hasDoodle'
        | 'doodleStrokesJson'
        | 'hasStickers'
        | 'stickerPlacementsJson'
    >
>;

export type UpsertNoteInput = Omit<Note, 'isFavorite'> & { isFavorite?: boolean };

interface NoteRow {
    id: string;
    type: NoteType;
    content: string;
    photo_local_uri: string | null;
    photo_synced_local_uri: string | null;
    photo_remote_base64: string | null;
    is_live_photo: number;
    paired_video_local_uri: string | null;
    paired_video_synced_local_uri: string | null;
    paired_video_remote_path: string | null;
    location_name: string | null;
    prompt_id: string | null;
    prompt_text_snapshot: string | null;
    prompt_answer: string | null;
    mood_emoji: string | null;
    note_color: string | null;
    latitude: number;
    longitude: number;
    radius: number;
    is_favorite: number;
    created_at: string;
    updated_at: string | null;
    search_text: string | null;
    has_doodle?: number;
    doodle_strokes_json?: string | null;
    has_stickers?: number;
    sticker_placements_json?: string | null;
}

// ─── Database ───────────────────────────────────────────────────────
let db: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let transactionQueue: Promise<void> = Promise.resolve();
let androidDatabaseQueue: Promise<void> = Promise.resolve();
const APP_SCHEMA_VERSION = 12;
export const LOCAL_NOTES_SCOPE = '__local__';
let activeNotesScope = LOCAL_NOTES_SCOPE;
const SQLITE_LOCK_RETRY_DELAYS_MS = [30, 80, 160];
const NOTES_FTS_TABLE = 'notes_fts';
const NOTES_SELECT_FIELDS = `notes.*,
      CASE WHEN doodles.note_id IS NOT NULL THEN 1 ELSE 0 END AS has_doodle,
      doodles.strokes_json AS doodle_strokes_json,
      CASE WHEN stickers.note_id IS NOT NULL THEN 1 ELSE 0 END AS has_stickers,
      stickers.placements_json AS sticker_placements_json`;
const NOTES_FROM_CLAUSE = `notes
      LEFT JOIN note_doodles doodles ON doodles.note_id = notes.id
      LEFT JOIN note_stickers stickers ON stickers.note_id = notes.id`;

function getDatabaseErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    if (typeof error === 'object' && error && 'message' in error) {
        return String((error as { message?: unknown }).message ?? '');
    }

    return '';
}

function isDatabaseLockedError(error: unknown) {
    const message = getDatabaseErrorMessage(error).toLowerCase();
    return message.includes('database is locked') || message.includes('error code 5');
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSerializedNativeTransaction<T>(task: () => Promise<T>): Promise<T> {
    const previous = transactionQueue.catch(() => undefined);
    let releaseQueue!: () => void;
    transactionQueue = new Promise<void>((resolve) => {
        releaseQueue = resolve;
    });

    await previous;

    try {
        return await task();
    } finally {
        releaseQueue();
    }
}

function runSerializedAndroidDatabaseOperation<T>(task: () => Promise<T>): Promise<T> {
    if (Platform.OS !== 'android') {
        return task();
    }

    const previous = androidDatabaseQueue.catch(() => undefined);
    let releaseQueue!: () => void;
    androidDatabaseQueue = new Promise<void>((resolve) => {
        releaseQueue = resolve;
    });

    return previous.then(async () => {
        try {
            return await task();
        } finally {
            releaseQueue();
        }
    });
}

function createSerializedDatabase(database: SQLite.SQLiteDatabase): SQLite.SQLiteDatabase {
    if (Platform.OS !== 'android') {
        return database;
    }

    const overrides = {
        runAsync: (...args: any[]) =>
            runSerializedAndroidDatabaseOperation(() => (database as any).runAsync(...args)),
        getFirstAsync: (...args: any[]) =>
            runSerializedAndroidDatabaseOperation(() => (database as any).getFirstAsync(...args)),
        getAllAsync: (...args: any[]) =>
            runSerializedAndroidDatabaseOperation(() => (database as any).getAllAsync(...args)),
        execAsync: (...args: any[]) =>
            runSerializedAndroidDatabaseOperation(() => (database as any).execAsync(...args)),
        withTransactionAsync: (...args: any[]) =>
            runSerializedAndroidDatabaseOperation(() => (database as any).withTransactionAsync(...args)),
        withExclusiveTransactionAsync: (...args: any[]) =>
            runSerializedAndroidDatabaseOperation(() => (database as any).withExclusiveTransactionAsync(...args)),
        isInTransactionAsync: (...args: any[]) =>
            runSerializedAndroidDatabaseOperation(() => (database as any).isInTransactionAsync(...args)),
    };

    return new Proxy(database as object, {
        get(target, prop, receiver) {
            if (Reflect.has(overrides, prop)) {
                return Reflect.get(overrides, prop, receiver);
            }

            const value = Reflect.get(target, prop, target);
            return typeof value === 'function' ? value.bind(target) : value;
        },
    }) as SQLite.SQLiteDatabase;
}

export type SQLiteTransactionExecutor = Pick<SQLite.SQLiteDatabase, 'runAsync' | 'getFirstAsync' | 'getAllAsync' | 'execAsync'>;

export function getActiveNotesScope() {
    return activeNotesScope;
}

export function setActiveNotesScope(scope: string | null | undefined) {
    activeNotesScope = scope?.trim() || LOCAL_NOTES_SCOPE;
}

function hasStoredDecorationPayload(payload: string | null | undefined) {
    if (!payload) {
        return false;
    }

    try {
        const parsed = JSON.parse(payload);
        return Array.isArray(parsed) && parsed.length > 0;
    } catch {
        return false;
    }
}

interface NoteDecorationState {
    doodleStrokesJson: string | null;
    stickerPlacementsJson: string | null;
}

interface ReminderSelectionRow {
    id: string;
    type: NoteType;
    content: string;
    location_name: string | null;
    latitude: number;
    longitude: number;
    radius: number;
    is_favorite: number;
    created_at: string;
    updated_at: string | null;
}

function resolveNoteDecorationState(input: {
    doodleStrokesJson?: string | null;
    stickerPlacementsJson?: string | null;
}): NoteDecorationState {
    return {
        doodleStrokesJson: input.doodleStrokesJson ?? null,
        stickerPlacementsJson: input.stickerPlacementsJson ?? null,
    };
}

async function persistNoteDecorationRows(
    executor: Pick<SQLite.SQLiteDatabase, 'runAsync'>,
    noteId: string,
    noteDecorations: NoteDecorationState,
    updatedAt: string
) {
    if (hasStoredDecorationPayload(noteDecorations.doodleStrokesJson)) {
        await executor.runAsync(
            `INSERT INTO note_doodles (note_id, strokes_json, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(note_id) DO UPDATE SET
                strokes_json = excluded.strokes_json,
                updated_at = excluded.updated_at`,
            noteId,
            noteDecorations.doodleStrokesJson,
            updatedAt
        );
    } else {
        await executor.runAsync('DELETE FROM note_doodles WHERE note_id = ?', noteId);
    }

    if (hasStoredDecorationPayload(noteDecorations.stickerPlacementsJson)) {
        await executor.runAsync(
            `INSERT INTO note_stickers (note_id, placements_json, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(note_id) DO UPDATE SET
                placements_json = excluded.placements_json,
                updated_at = excluded.updated_at`,
            noteId,
            noteDecorations.stickerPlacementsJson,
            updatedAt
        );
    } else {
        await executor.runAsync('DELETE FROM note_stickers WHERE note_id = ?', noteId);
    }
}

export async function migrateNotesScope(sourceScope: string, targetScope: string): Promise<void> {
    const normalizedSourceScope = sourceScope.trim();
    const normalizedTargetScope = targetScope.trim();

    if (!normalizedSourceScope || !normalizedTargetScope || normalizedSourceScope === normalizedTargetScope) {
        return;
    }

    await withDatabaseTransaction(async (txn) => {
        await txn.runAsync(
            'UPDATE notes SET owner_uid = ? WHERE owner_uid = ?',
            normalizedTargetScope,
            normalizedSourceScope
        );
        await txn.runAsync(
            'UPDATE sync_queue SET owner_uid = ? WHERE owner_uid = ?',
            normalizedTargetScope,
            normalizedSourceScope
        );
        await txn.runAsync(
            'UPDATE sticker_assets SET owner_uid = ? WHERE owner_uid = ?',
            normalizedTargetScope,
            normalizedSourceScope
        );
        await txn.runAsync(
            'DELETE FROM note_doodles WHERE note_id NOT IN (SELECT id FROM notes)'
        );
        await txn.runAsync(
            'DELETE FROM note_stickers WHERE note_id NOT IN (SELECT id FROM notes)'
        );
        await txn.runAsync(
            `DELETE FROM ${NOTES_FTS_TABLE}
             WHERE owner_uid IN (?, ?)`,
            normalizedSourceScope,
            normalizedTargetScope
        );
        await txn.runAsync(
            `INSERT INTO ${NOTES_FTS_TABLE} (note_id, owner_uid, search_text)
             SELECT id, owner_uid, search_text
             FROM notes
             WHERE owner_uid = ?`,
            normalizedTargetScope
        );
        await txn.runAsync(
            `DELETE FROM ${NOTES_FTS_TABLE}
             WHERE note_id NOT IN (SELECT id FROM notes)`
        );
    });
}

export async function migrateLocalNotesScopeToUser(userUid: string): Promise<void> {
    await migrateNotesScope(LOCAL_NOTES_SCOPE, userUid);
}

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
    if (db) {
        return db;
    }

    if (!dbInitPromise) {
        dbInitPromise = (async () => {
            const database = await SQLite.openDatabaseAsync(
                'acte_notes.db',
                Platform.OS === 'android'
                    ? {
                        useNewConnection: true,
                        // Work around an Expo SQLite FTS close/finalize crash on Android.
                        finalizeUnusedStatementsBeforeClosing: false,
                    }
                    : undefined
            );
            await database.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY NOT NULL,
        owner_uid TEXT NOT NULL DEFAULT '__local__',
        type TEXT NOT NULL CHECK(type IN ('text', 'photo')),
        content TEXT NOT NULL,
        photo_local_uri TEXT,
        photo_synced_local_uri TEXT,
        photo_remote_base64 TEXT,
        is_live_photo INTEGER NOT NULL DEFAULT 0,
        paired_video_local_uri TEXT,
        paired_video_synced_local_uri TEXT,
        paired_video_remote_path TEXT,
        location_name TEXT,
        prompt_id TEXT,
        prompt_text_snapshot TEXT,
        prompt_answer TEXT,
        mood_emoji TEXT,
        note_color TEXT,
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
      CREATE TABLE IF NOT EXISTS sticker_assets (
        id TEXT PRIMARY KEY NOT NULL,
        owner_uid TEXT NOT NULL DEFAULT '__local__',
        local_uri TEXT NOT NULL,
        remote_path TEXT,
        upload_fingerprint TEXT,
        mime_type TEXT NOT NULL,
        width REAL NOT NULL,
        height REAL NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        source TEXT NOT NULL DEFAULT 'import'
      );
      CREATE INDEX IF NOT EXISTS idx_sticker_assets_owner_created ON sticker_assets(owner_uid, created_at DESC);
      CREATE TABLE IF NOT EXISTS note_stickers (
        note_id TEXT PRIMARY KEY NOT NULL,
        placements_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_uid TEXT NOT NULL DEFAULT '__local__',
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
      CREATE TABLE IF NOT EXISTS shared_friends_cache (
        user_uid TEXT NOT NULL,
        friend_uid TEXT NOT NULL,
        display_name_snapshot TEXT,
        photo_url_snapshot TEXT,
        friended_at TEXT NOT NULL,
        last_shared_at TEXT,
        created_by_invite_id TEXT,
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
        photo_path TEXT,
        photo_local_uri TEXT,
        is_live_photo INTEGER NOT NULL DEFAULT 0,
        paired_video_path TEXT,
        paired_video_local_uri TEXT,
        doodle_strokes_json TEXT,
        sticker_placements_json TEXT,
        note_color TEXT,
        place_name TEXT,
        source_note_id TEXT,
        latitude REAL,
        longitude REAL,
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
                if (!columns.includes('owner_uid')) {
                    await database.execAsync(`ALTER TABLE notes ADD COLUMN owner_uid TEXT NOT NULL DEFAULT '${LOCAL_NOTES_SCOPE}'`);
                }
                if (!columns.includes('photo_local_uri')) {
                    await database.execAsync(`ALTER TABLE notes ADD COLUMN photo_local_uri TEXT`);
                    shouldBackfillNoteMetadata = true;
                }
                if (!columns.includes('photo_synced_local_uri')) {
                    await database.execAsync(`ALTER TABLE notes ADD COLUMN photo_synced_local_uri TEXT`);
                }
                if (!columns.includes('photo_remote_base64')) {
                    await database.execAsync(`ALTER TABLE notes ADD COLUMN photo_remote_base64 TEXT`);
                }
                if (!columns.includes('is_live_photo')) {
                    await database.execAsync(`ALTER TABLE notes ADD COLUMN is_live_photo INTEGER NOT NULL DEFAULT 0`);
                }
                if (!columns.includes('paired_video_local_uri')) {
                    await database.execAsync(`ALTER TABLE notes ADD COLUMN paired_video_local_uri TEXT`);
                }
                if (!columns.includes('paired_video_synced_local_uri')) {
                    await database.execAsync(
                        `ALTER TABLE notes ADD COLUMN paired_video_synced_local_uri TEXT`
                    );
                }
                if (!columns.includes('paired_video_remote_path')) {
                    await database.execAsync(`ALTER TABLE notes ADD COLUMN paired_video_remote_path TEXT`);
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
                if (!columns.includes('note_color')) {
                    await database.execAsync(`ALTER TABLE notes ADD COLUMN note_color TEXT`);
                }

                await database.execAsync(`CREATE INDEX IF NOT EXISTS idx_notes_search_text ON notes(search_text)`);
                await database.execAsync(`CREATE INDEX IF NOT EXISTS idx_notes_owner_created ON notes(owner_uid, created_at DESC)`);
                await database.execAsync(
                    `CREATE VIRTUAL TABLE IF NOT EXISTS ${NOTES_FTS_TABLE}
                     USING fts5(note_id UNINDEXED, owner_uid, search_text)`
                );
                await database.execAsync(
                    `CREATE TABLE IF NOT EXISTS note_doodles (
                        note_id TEXT PRIMARY KEY NOT NULL,
                        strokes_json TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE
                    )`
                );
                await database.execAsync(
                    `CREATE TABLE IF NOT EXISTS sticker_assets (
                        id TEXT PRIMARY KEY NOT NULL,
                        owner_uid TEXT NOT NULL DEFAULT '${LOCAL_NOTES_SCOPE}',
                        local_uri TEXT NOT NULL,
                        remote_path TEXT,
                        upload_fingerprint TEXT,
                        mime_type TEXT NOT NULL,
                        width REAL NOT NULL,
                        height REAL NOT NULL,
                        created_at TEXT NOT NULL,
                        updated_at TEXT,
                        source TEXT NOT NULL DEFAULT 'import'
                    )`
                );
                await database.execAsync(
                    `CREATE INDEX IF NOT EXISTS idx_sticker_assets_owner_created ON sticker_assets(owner_uid, created_at DESC)`
                );
                const stickerAssetInfo = await database.getAllAsync<{ name: string }>(
                    `PRAGMA table_info(sticker_assets)`
                );
                const stickerAssetColumns = stickerAssetInfo.map((col) => col.name);
                if (!stickerAssetColumns.includes('upload_fingerprint')) {
                    await database.execAsync(
                        `ALTER TABLE sticker_assets ADD COLUMN upload_fingerprint TEXT`
                    );
                }
                await database.execAsync(
                    `CREATE TABLE IF NOT EXISTS note_stickers (
                        note_id TEXT PRIMARY KEY NOT NULL,
                        placements_json TEXT NOT NULL,
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

                if (currentUserVersion < APP_SCHEMA_VERSION) {
                    const searchRows = await database.getAllAsync<{
                        id: string;
                        owner_uid: string | null;
                        search_text: string | null;
                    }>(`SELECT id, owner_uid, search_text FROM notes`);

                    await database.runAsync(`DELETE FROM ${NOTES_FTS_TABLE}`);
                    for (const row of searchRows) {
                        await database.runAsync(
                            `INSERT INTO ${NOTES_FTS_TABLE} (note_id, owner_uid, search_text)
                             VALUES (?, ?, ?)`,
                            row.id,
                            row.owner_uid ?? LOCAL_NOTES_SCOPE,
                            row.search_text ?? ''
                        );
                    }
                }

                const syncQueueInfo = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(sync_queue)`);
                const syncQueueColumns = syncQueueInfo.map((col) => col.name);

                if (!syncQueueColumns.includes('next_retry_at')) {
                    await database.execAsync(`ALTER TABLE sync_queue ADD COLUMN next_retry_at TEXT`);
                }
                if (!syncQueueColumns.includes('owner_uid')) {
                    await database.execAsync(`ALTER TABLE sync_queue ADD COLUMN owner_uid TEXT NOT NULL DEFAULT '${LOCAL_NOTES_SCOPE}'`);
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
                    `CREATE INDEX IF NOT EXISTS idx_sync_queue_owner_status_created ON sync_queue(owner_uid, status, created_at ASC)`
                );

                if (currentUserVersion < APP_SCHEMA_VERSION) {
                    await database.execAsync(`
                        DROP TABLE IF EXISTS rooms_cache;
                        DROP TABLE IF EXISTS room_memberships_cache;
                        DROP TABLE IF EXISTS room_posts_cache;
                        DROP TABLE IF EXISTS room_read_state;
                        DROP TABLE IF EXISTS room_invites_cache;
                        DROP TABLE IF EXISTS rooms_cache_meta;
                        DROP TABLE IF EXISTS shared_friends_cache;
                        DROP TABLE IF EXISTS shared_posts_cache;
                        DROP TABLE IF EXISTS shared_invites_cache;
                        DROP TABLE IF EXISTS shared_feed_cache_meta;
                    `);
                }

                await database.execAsync(
                    `CREATE TABLE IF NOT EXISTS shared_friends_cache (
                        user_uid TEXT NOT NULL,
                        friend_uid TEXT NOT NULL,
                        display_name_snapshot TEXT,
                        photo_url_snapshot TEXT,
                        friended_at TEXT NOT NULL,
                        last_shared_at TEXT,
                        created_by_invite_id TEXT,
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
                        photo_path TEXT,
                        photo_local_uri TEXT,
                        is_live_photo INTEGER NOT NULL DEFAULT 0,
                        paired_video_path TEXT,
                        paired_video_local_uri TEXT,
                        doodle_strokes_json TEXT,
                        sticker_placements_json TEXT,
                        note_color TEXT,
                        place_name TEXT,
                        source_note_id TEXT,
                        latitude REAL,
                        longitude REAL,
                        created_at TEXT NOT NULL,
                        updated_at TEXT,
                        PRIMARY KEY (user_uid, id)
                    )`
                );
                const sharedPostsCacheInfo = await database.getAllAsync<{ name: string }>(
                    `PRAGMA table_info(shared_posts_cache)`
                );
                const sharedPostsCacheColumns = sharedPostsCacheInfo.map((col) => col.name);
                if (!sharedPostsCacheColumns.includes('is_live_photo')) {
                    await database.execAsync(`ALTER TABLE shared_posts_cache ADD COLUMN is_live_photo INTEGER NOT NULL DEFAULT 0`);
                }
                if (!sharedPostsCacheColumns.includes('paired_video_path')) {
                    await database.execAsync(`ALTER TABLE shared_posts_cache ADD COLUMN paired_video_path TEXT`);
                }
                if (!sharedPostsCacheColumns.includes('paired_video_local_uri')) {
                    await database.execAsync(`ALTER TABLE shared_posts_cache ADD COLUMN paired_video_local_uri TEXT`);
                }
                if (!sharedPostsCacheColumns.includes('note_color')) {
                    await database.execAsync(`ALTER TABLE shared_posts_cache ADD COLUMN note_color TEXT`);
                }
                if (!sharedPostsCacheColumns.includes('latitude')) {
                    await database.execAsync(`ALTER TABLE shared_posts_cache ADD COLUMN latitude REAL`);
                }
                if (!sharedPostsCacheColumns.includes('longitude')) {
                    await database.execAsync(`ALTER TABLE shared_posts_cache ADD COLUMN longitude REAL`);
                }
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

            db = createSerializedDatabase(database);
            return db;
        })().catch((error) => {
            db = null;
            dbInitPromise = null;
            throw error;
        });
    }

    return dbInitPromise;
}

export async function withDatabaseTransaction<T>(
    task: (txn: SQLiteTransactionExecutor) => Promise<T>
): Promise<T> {
    const database = await getDB();

    if (Platform.OS === 'web') {
        let result: T | undefined;
        await database.withTransactionAsync(async () => {
            result = await task(database);
        });
        return result as T;
    }

    return runSerializedNativeTransaction(async () => {
        for (let attempt = 0; attempt <= SQLITE_LOCK_RETRY_DELAYS_MS.length; attempt += 1) {
            let transactionStarted = false;

            try {
                await database.execAsync('BEGIN IMMEDIATE');
                transactionStarted = true;
                const result = await task(database);
                await database.execAsync('COMMIT');
                return result;
            } catch (error) {
                if (transactionStarted) {
                    try {
                        await database.execAsync('ROLLBACK');
                    } catch (rollbackError) {
                        console.warn('Database rollback failed:', rollbackError);
                    }
                }

                if (!isDatabaseLockedError(error) || attempt === SQLITE_LOCK_RETRY_DELAYS_MS.length) {
                    throw error;
                }

                await sleep(SQLITE_LOCK_RETRY_DELAYS_MS[attempt] ?? 50);
            }
        }

        throw new Error('Database transaction retry failed unexpectedly.');
    });
}

// ─── Helpers ────────────────────────────────────────────────────────
export function generateNoteId(): string {
    const secureUuid = typeof Crypto.randomUUID === 'function' ? Crypto.randomUUID() : null;
    const randomId =
        typeof secureUuid === 'string' && secureUuid.length > 0
            ? secureUuid.substring(0, 8)
            : Math.random().toString(36).slice(2, 10);
    return `note-${Date.now()}-${randomId}`;
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

function buildFtsMatchExpression(query: string) {
    const tokens = tokenizeSearchQuery(query);
    return tokens.map((token) => `"${token.replace(/"/g, '""')}"*`).join(' AND ');
}

async function upsertNoteSearchDocument(
    executor: Pick<SQLite.SQLiteDatabase, 'runAsync'>,
    noteId: string,
    ownerUid: string,
    searchText: string
) {
    await executor.runAsync(`DELETE FROM ${NOTES_FTS_TABLE} WHERE note_id = ?`, noteId);
    await executor.runAsync(
        `INSERT INTO ${NOTES_FTS_TABLE} (note_id, owner_uid, search_text) VALUES (?, ?, ?)`,
        noteId,
        ownerUid,
        searchText
    );
}

async function deleteNoteSearchDocument(
    executor: Pick<SQLite.SQLiteDatabase, 'runAsync'>,
    noteId: string
) {
    await executor.runAsync(`DELETE FROM ${NOTES_FTS_TABLE} WHERE note_id = ?`, noteId);
}

async function deleteNoteSearchDocumentsForScope(
    executor: Pick<SQLite.SQLiteDatabase, 'runAsync'>,
    ownerUid: string
) {
    await executor.runAsync(`DELETE FROM ${NOTES_FTS_TABLE} WHERE owner_uid = ?`, ownerUid);
}

function rowToNote(row: NoteRow): Note {
    const photoLocalUri = getResolvedPhotoLocalUri(row);
    const pairedVideoLocalUri = resolveStoredPairedVideoUri(row.paired_video_local_uri);
    return {
        id: row.id,
        type: row.type as NoteType,
        content: row.type === 'photo' ? photoLocalUri ?? '' : row.content,
        photoLocalUri,
        photoSyncedLocalUri: resolveStoredPhotoUri(row.photo_synced_local_uri),
        photoRemoteBase64: row.photo_remote_base64,
        isLivePhoto: row.is_live_photo === 1,
        pairedVideoLocalUri,
        pairedVideoSyncedLocalUri: resolveStoredPairedVideoUri(row.paired_video_synced_local_uri),
        pairedVideoRemotePath: row.paired_video_remote_path ?? null,
        locationName: row.location_name,
        promptId: row.prompt_id,
        promptTextSnapshot: row.prompt_text_snapshot,
        promptAnswer: row.prompt_answer,
        moodEmoji: row.mood_emoji,
        noteColor: row.note_color ?? null,
        latitude: row.latitude,
        longitude: row.longitude,
        radius: row.radius,
        isFavorite: row.is_favorite === 1,
        hasDoodle: row.has_doodle === 1,
        doodleStrokesJson: row.doodle_strokes_json ?? null,
        hasStickers: row.has_stickers === 1,
        stickerPlacementsJson: row.sticker_placements_json ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function rowToReminderSelectionNote(row: ReminderSelectionRow): Note {
    return {
        id: row.id,
        type: row.type as NoteType,
        content: row.content,
        photoLocalUri: null,
        photoRemoteBase64: null,
        isLivePhoto: false,
        pairedVideoLocalUri: null,
        pairedVideoRemotePath: null,
        locationName: row.location_name,
        promptId: null,
        promptTextSnapshot: null,
        promptAnswer: null,
        moodEmoji: null,
        noteColor: null,
        latitude: row.latitude,
        longitude: row.longitude,
        radius: row.radius,
        isFavorite: row.is_favorite === 1,
        hasDoodle: false,
        doodleStrokesJson: null,
        hasStickers: false,
        stickerPlacementsJson: null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function getCurrentScope() {
    return getActiveNotesScope();
}

// ─── CRUD Operations ────────────────────────────────────────────────
export async function createNote(input: CreateNoteInput): Promise<Note> {
    const scope = getCurrentScope();
    const id = input.id ?? generateNoteId();
    const now = new Date().toISOString();
    const photoLocalUri =
        input.type === 'photo' ? resolveStoredPhotoUri(input.photoLocalUri ?? input.content) : null;
    const photoSyncedLocalUri =
        input.type === 'photo' ? resolveStoredPhotoUri(input.photoSyncedLocalUri) : null;
    const pairedVideoLocalUri =
        input.type === 'photo' && input.isLivePhoto
            ? resolveStoredPairedVideoUri(input.pairedVideoLocalUri)
            : null;
    const pairedVideoSyncedLocalUri =
        input.type === 'photo' && input.isLivePhoto
            ? resolveStoredPairedVideoUri(input.pairedVideoSyncedLocalUri)
            : null;
    const normalizedContent = input.type === 'photo' ? photoLocalUri ?? '' : input.content;
    const normalizedNoteColor =
        input.type === 'text' ? normalizeSavedTextNoteColor(input.noteColor) : null;
    const searchText = buildSearchText({
        type: input.type,
        content: normalizedContent,
        locationName: input.locationName ?? null,
        promptTextSnapshot: input.promptTextSnapshot ?? null,
        promptAnswer: input.promptAnswer ?? null,
    });
    const noteDecorations = resolveNoteDecorationState({
        doodleStrokesJson: input.doodleStrokesJson,
        stickerPlacementsJson: input.stickerPlacementsJson,
    });

    await withDatabaseTransaction(async (txn) => {
        await txn.runAsync(
            `INSERT INTO notes (
                id,
                owner_uid,
                type,
                content,
                photo_local_uri,
                photo_synced_local_uri,
                photo_remote_base64,
                is_live_photo,
                paired_video_local_uri,
                paired_video_synced_local_uri,
                paired_video_remote_path,
                location_name,
                prompt_id,
                prompt_text_snapshot,
                prompt_answer,
                mood_emoji,
                note_color,
                search_text,
                latitude,
                longitude,
                radius,
                is_favorite,
                created_at
            )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
            id,
            scope,
            input.type,
            normalizedContent,
            photoLocalUri,
            photoSyncedLocalUri,
            input.photoRemoteBase64 ?? null,
            input.isLivePhoto ? 1 : 0,
            pairedVideoLocalUri,
            pairedVideoSyncedLocalUri,
            input.pairedVideoRemotePath ?? null,
            input.locationName ?? null,
            input.promptId ?? null,
            input.promptTextSnapshot ?? null,
            input.promptAnswer ?? null,
            input.moodEmoji ?? null,
            normalizedNoteColor,
            searchText,
            input.latitude,
            input.longitude,
            input.radius ?? DEFAULT_NOTE_RADIUS,
            now
        );
        await upsertNoteSearchDocument(txn, id, scope, searchText);
        await persistNoteDecorationRows(txn, id, noteDecorations, now);
    });

    return {
        id,
        type: input.type,
        content: normalizedContent,
        photoLocalUri,
        photoSyncedLocalUri,
        photoRemoteBase64: input.photoRemoteBase64 ?? null,
        isLivePhoto: Boolean(input.isLivePhoto && pairedVideoLocalUri),
        pairedVideoLocalUri,
        pairedVideoSyncedLocalUri,
        pairedVideoRemotePath: input.pairedVideoRemotePath ?? null,
        locationName: input.locationName ?? null,
        promptId: input.promptId ?? null,
        promptTextSnapshot: input.promptTextSnapshot ?? null,
        promptAnswer: input.promptAnswer ?? null,
        moodEmoji: input.moodEmoji ?? null,
        noteColor: normalizedNoteColor,
        latitude: input.latitude,
        longitude: input.longitude,
        radius: input.radius ?? DEFAULT_NOTE_RADIUS,
        isFavorite: false,
        hasDoodle: hasStoredDecorationPayload(noteDecorations.doodleStrokesJson),
        doodleStrokesJson: noteDecorations.doodleStrokesJson,
        hasStickers: hasStoredDecorationPayload(noteDecorations.stickerPlacementsJson),
        stickerPlacementsJson: noteDecorations.stickerPlacementsJson,
        createdAt: now,
        updatedAt: null,
    };
}

export async function getAllNotes(): Promise<Note[]> {
    const scope = getCurrentScope();
    return getAllNotesForScope(scope);
}

export async function getAllNotesForScope(scope: string): Promise<Note[]> {
    const database = await getDB();
    const rows = await database.getAllAsync<NoteRow>(
        `SELECT ${NOTES_SELECT_FIELDS}
         FROM ${NOTES_FROM_CLAUSE}
         WHERE owner_uid = ?
         ORDER BY created_at DESC`
        ,
        scope
    );
    return rows.map(rowToNote);
}

export async function getNoteById(id: string): Promise<Note | null> {
    const database = await getDB();
    const scope = getCurrentScope();
    const row = await database.getFirstAsync<NoteRow>(
        `SELECT ${NOTES_SELECT_FIELDS}
         FROM ${NOTES_FROM_CLAUSE}
         WHERE id = ? AND owner_uid = ?`,
        id,
        scope
    );
    return row ? rowToNote(row) : null;
}

export async function updateNote(id: string, updates: NoteUpdates): Promise<void> {
    const scope = getCurrentScope();
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
    const nextPhotoSyncedLocalUri =
        nextType === 'photo'
            ? resolveStoredPhotoUri(
                updates.photoSyncedLocalUri !== undefined
                    ? updates.photoSyncedLocalUri
                    : nextPhotoLocalUri === (existing.photoLocalUri ?? null)
                        ? existing.photoSyncedLocalUri ?? null
                        : null
            )
            : null;
    const nextIsLivePhoto =
        nextType === 'photo'
            ? updates.isLivePhoto !== undefined
                ? updates.isLivePhoto
                : existing.isLivePhoto ?? false
            : false;
    const nextPairedVideoLocalUri =
        nextType === 'photo' && nextIsLivePhoto
            ? resolveStoredPairedVideoUri(
                updates.pairedVideoLocalUri !== undefined
                    ? updates.pairedVideoLocalUri
                    : existing.pairedVideoLocalUri ?? null
            )
            : null;
    const nextPairedVideoSyncedLocalUri =
        nextType === 'photo' && nextIsLivePhoto
            ? resolveStoredPairedVideoUri(
                updates.pairedVideoSyncedLocalUri !== undefined
                    ? updates.pairedVideoSyncedLocalUri
                    : nextPairedVideoLocalUri === (existing.pairedVideoLocalUri ?? null)
                        ? existing.pairedVideoSyncedLocalUri ?? null
                        : null
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
    const nextNoteColor =
        nextType === 'text'
            ? normalizeSavedTextNoteColor(
                updates.noteColor !== undefined ? updates.noteColor : existing.noteColor ?? null
            )
            : null;
    const nextRadius = updates.radius ?? existing.radius;
    const nextPhotoRemoteBase64 =
        updates.photoRemoteBase64 !== undefined
            ? updates.photoRemoteBase64
            : existing.photoRemoteBase64 ?? null;
    const nextPairedVideoRemotePath =
        nextIsLivePhoto
            ? updates.pairedVideoRemotePath !== undefined
                ? updates.pairedVideoRemotePath
                : existing.pairedVideoRemotePath ?? null
            : null;
    const now = new Date().toISOString();
    const searchText = buildSearchText({
        type: nextType,
        content: nextContent,
        locationName: nextLocationName,
        promptTextSnapshot: nextPromptTextSnapshot,
        promptAnswer: nextPromptAnswer,
    });
    const nextDecorations = resolveNoteDecorationState({
        doodleStrokesJson:
            updates.doodleStrokesJson !== undefined ? updates.doodleStrokesJson : existing.doodleStrokesJson,
        stickerPlacementsJson:
            updates.stickerPlacementsJson !== undefined ? updates.stickerPlacementsJson : existing.stickerPlacementsJson,
    });

    await withDatabaseTransaction(async (txn) => {
        await txn.runAsync(
            `UPDATE notes
             SET content = ?,
                 photo_local_uri = ?,
                 photo_synced_local_uri = ?,
                 photo_remote_base64 = ?,
                 is_live_photo = ?,
                 paired_video_local_uri = ?,
                 paired_video_synced_local_uri = ?,
                 paired_video_remote_path = ?,
                 location_name = ?,
                 prompt_id = ?,
                 prompt_text_snapshot = ?,
                 prompt_answer = ?,
                 mood_emoji = ?,
                 note_color = ?,
                 search_text = ?,
                 radius = ?,
                 updated_at = ?
             WHERE id = ? AND owner_uid = ?`,
            nextContent,
            nextPhotoLocalUri,
            nextPhotoSyncedLocalUri,
            nextPhotoRemoteBase64,
            nextIsLivePhoto ? 1 : 0,
            nextPairedVideoLocalUri,
            nextPairedVideoSyncedLocalUri,
            nextPairedVideoRemotePath,
            nextLocationName,
            nextPromptId,
            nextPromptTextSnapshot,
            nextPromptAnswer,
            nextMoodEmoji,
            nextNoteColor,
            searchText,
            nextRadius,
            now,
            id,
            scope
        );
        await upsertNoteSearchDocument(txn, id, scope, searchText);
        await persistNoteDecorationRows(txn, id, nextDecorations, now);
    });
}

export async function toggleFavorite(id: string): Promise<boolean> {
    const database = await getDB();
    const scope = getCurrentScope();
    const row = await database.getFirstAsync<{ is_favorite: number }>(
        'SELECT is_favorite FROM notes WHERE id = ? AND owner_uid = ?',
        id,
        scope
    );
    if (!row) return false;
    const newValue = row.is_favorite === 1 ? 0 : 1;
    await database.runAsync(
        'UPDATE notes SET is_favorite = ?, updated_at = ? WHERE id = ? AND owner_uid = ?',
        newValue,
        new Date().toISOString(),
        id,
        scope
    );
    return newValue === 1;
}

export async function searchNotes(query: string): Promise<Note[]> {
    const database = await getDB();
    const scope = getCurrentScope();
    const matchExpression = buildFtsMatchExpression(query);

    if (!matchExpression) {
        return getAllNotes();
    }

    const rows = await database.getAllAsync<NoteRow>(
        `SELECT ${NOTES_SELECT_FIELDS}
         FROM ${NOTES_FROM_CLAUSE}
         INNER JOIN ${NOTES_FTS_TABLE} notes_fts ON notes_fts.note_id = notes.id
         WHERE notes.owner_uid = ?
           AND notes_fts.owner_uid = ?
           AND notes_fts.search_text MATCH ?
         ORDER BY created_at DESC`,
        scope,
        scope,
        matchExpression
    );
    return rows.map(rowToNote);
}

export async function getNotesForReminderSelection(): Promise<Note[]> {
    const database = await getDB();
    const scope = getCurrentScope();
    const rows = await database.getAllAsync<ReminderSelectionRow>(
        `SELECT
            id,
            type,
            content,
            location_name,
            latitude,
            longitude,
            radius,
            is_favorite,
            created_at,
            updated_at
         FROM notes
         WHERE owner_uid = ?
         ORDER BY created_at DESC`,
        scope
    );
    return rows.map(rowToReminderSelectionNote);
}

export async function deleteNote(id: string): Promise<void> {
    const database = await getDB();
    const scope = getCurrentScope();
    await database.runAsync(
        'DELETE FROM note_doodles WHERE note_id IN (SELECT id FROM notes WHERE id = ? AND owner_uid = ?)',
        id,
        scope
    );
    await database.runAsync(
        'DELETE FROM note_stickers WHERE note_id IN (SELECT id FROM notes WHERE id = ? AND owner_uid = ?)',
        id,
        scope
    );
    await deleteNoteSearchDocument(database, id);
    await database.runAsync('DELETE FROM notes WHERE id = ? AND owner_uid = ?', id, scope);
}

export async function deleteAllNotes(): Promise<void> {
    const scope = getCurrentScope();
    await deleteAllNotesForScope(scope);
}

export async function deleteAllNotesForScope(scope: string): Promise<void> {
    const database = await getDB();
    await database.runAsync(
        'DELETE FROM note_doodles WHERE note_id IN (SELECT id FROM notes WHERE owner_uid = ?)',
        scope
    );
    await database.runAsync(
        'DELETE FROM note_stickers WHERE note_id IN (SELECT id FROM notes WHERE owner_uid = ?)',
        scope
    );
    await deleteNoteSearchDocumentsForScope(database, scope);
    await database.runAsync('DELETE FROM notes WHERE owner_uid = ?', scope);
}

export async function getNotesCount(): Promise<number> {
    const database = await getDB();
    const scope = getCurrentScope();
    const result = await database.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM notes WHERE owner_uid = ?',
        scope
    );
    return result?.count ?? 0;
}

export async function upsertNote(input: UpsertNoteInput): Promise<Note> {
    const scope = getCurrentScope();
    const photoLocalUri =
        input.type === 'photo'
            ? resolveStoredPhotoUri(input.photoLocalUri ?? input.content)
            : null;
    const photoSyncedLocalUri =
        input.type === 'photo' ? resolveStoredPhotoUri(input.photoSyncedLocalUri) : null;
    const pairedVideoLocalUri =
        input.type === 'photo' && input.isLivePhoto
            ? resolveStoredPairedVideoUri(input.pairedVideoLocalUri)
            : null;
    const pairedVideoSyncedLocalUri =
        input.type === 'photo' && input.isLivePhoto
            ? resolveStoredPairedVideoUri(input.pairedVideoSyncedLocalUri)
            : null;
    const normalizedContent = input.type === 'photo' ? photoLocalUri ?? '' : input.content;
    const searchText = buildSearchText({
        type: input.type,
        content: normalizedContent,
        locationName: input.locationName,
        promptTextSnapshot: input.promptTextSnapshot ?? null,
        promptAnswer: input.promptAnswer ?? null,
    });
    const noteDecorations = resolveNoteDecorationState({
        doodleStrokesJson: input.doodleStrokesJson,
        stickerPlacementsJson: input.stickerPlacementsJson,
    });
    const updatedAt = input.updatedAt ?? input.createdAt;

    await withDatabaseTransaction(async (txn) => {
        await txn.runAsync(
            `INSERT INTO notes (
                id,
                owner_uid,
                type,
                content,
                photo_local_uri,
                photo_synced_local_uri,
                photo_remote_base64,
                is_live_photo,
                paired_video_local_uri,
                paired_video_synced_local_uri,
                paired_video_remote_path,
                location_name,
                prompt_id,
                prompt_text_snapshot,
                prompt_answer,
                mood_emoji,
                note_color,
                search_text,
                latitude,
                longitude,
                radius,
                is_favorite,
                created_at,
                updated_at
            )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                owner_uid = excluded.owner_uid,
                type = excluded.type,
                content = excluded.content,
                photo_local_uri = excluded.photo_local_uri,
                photo_synced_local_uri = excluded.photo_synced_local_uri,
                photo_remote_base64 = excluded.photo_remote_base64,
                is_live_photo = excluded.is_live_photo,
                paired_video_local_uri = excluded.paired_video_local_uri,
                paired_video_synced_local_uri = excluded.paired_video_synced_local_uri,
                paired_video_remote_path = excluded.paired_video_remote_path,
                location_name = excluded.location_name,
                prompt_id = excluded.prompt_id,
                prompt_text_snapshot = excluded.prompt_text_snapshot,
                prompt_answer = excluded.prompt_answer,
                mood_emoji = excluded.mood_emoji,
                note_color = excluded.note_color,
                search_text = excluded.search_text,
                latitude = excluded.latitude,
                longitude = excluded.longitude,
                radius = excluded.radius,
                is_favorite = excluded.is_favorite,
                created_at = excluded.created_at,
                updated_at = excluded.updated_at`,
            input.id,
            scope,
            input.type,
            normalizedContent,
            photoLocalUri,
            photoSyncedLocalUri,
            input.photoRemoteBase64 ?? null,
            input.isLivePhoto ? 1 : 0,
            pairedVideoLocalUri,
            pairedVideoSyncedLocalUri,
            input.pairedVideoRemotePath ?? null,
            input.locationName ?? null,
            input.promptId ?? null,
            input.promptTextSnapshot ?? null,
            input.promptAnswer ?? null,
            input.moodEmoji ?? null,
            input.noteColor ?? null,
            searchText,
            input.latitude,
            input.longitude,
            input.radius ?? DEFAULT_NOTE_RADIUS,
            input.isFavorite ? 1 : 0,
            input.createdAt,
            input.updatedAt ?? null
        );
        await upsertNoteSearchDocument(txn, input.id, scope, searchText);
        await persistNoteDecorationRows(txn, input.id, noteDecorations, updatedAt);
    });

    return {
        id: input.id,
        type: input.type,
        content: normalizedContent,
        photoLocalUri,
        photoSyncedLocalUri,
        photoRemoteBase64: input.photoRemoteBase64 ?? null,
        isLivePhoto: Boolean(input.isLivePhoto && pairedVideoLocalUri),
        pairedVideoLocalUri,
        pairedVideoSyncedLocalUri,
        pairedVideoRemotePath: input.pairedVideoRemotePath ?? null,
        locationName: input.locationName ?? null,
        promptId: input.promptId ?? null,
        promptTextSnapshot: input.promptTextSnapshot ?? null,
        promptAnswer: input.promptAnswer ?? null,
        moodEmoji: input.moodEmoji ?? null,
        noteColor: input.noteColor ?? null,
        latitude: input.latitude,
        longitude: input.longitude,
        radius: input.radius ?? DEFAULT_NOTE_RADIUS,
        isFavorite: Boolean(input.isFavorite),
        hasDoodle: hasStoredDecorationPayload(noteDecorations.doodleStrokesJson),
        doodleStrokesJson: noteDecorations.doodleStrokesJson,
        hasStickers: hasStoredDecorationPayload(noteDecorations.stickerPlacementsJson),
        stickerPlacementsJson: noteDecorations.stickerPlacementsJson,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt ?? null,
    };
}

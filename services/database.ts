import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

// ─── Types ──────────────────────────────────────────────────────────
export type NoteType = 'text' | 'photo';

export interface Note {
    id: string;
    type: NoteType;
    content: string;          // text content or local photo URI
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
    locationName?: string;
    latitude: number;
    longitude: number;
    radius?: number;
}

// ─── Database ───────────────────────────────────────────────────────
let db: SQLite.SQLiteDatabase | null = null;

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
    if (!db) {
        db = await SQLite.openDatabaseAsync('acte_notes.db');
        await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('text', 'photo')),
        content TEXT NOT NULL,
        location_name TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        radius REAL NOT NULL DEFAULT 150,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at DESC);
    `);

        // Migration: add is_favorite column if missing (existing databases)
        try {
            const tableInfo = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(notes)`);
            const columns = tableInfo.map((col) => col.name);
            if (!columns.includes('is_favorite')) {
                await db.execAsync(`ALTER TABLE notes ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0`);
            }
        } catch (e) {
            console.warn('Migration check failed:', e);
        }
    }
    return db;
}

// ─── Helpers ────────────────────────────────────────────────────────
function generateId(): string {
    // Replaced Math.random with cryptographically secure UUID
    return `note-${Date.now()}-${Crypto.randomUUID().substring(0, 8)}`;
}

function rowToNote(row: any): Note {
    return {
        id: row.id,
        type: row.type as NoteType,
        content: row.content,
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

    await database.runAsync(
        `INSERT INTO notes (id, type, content, location_name, latitude, longitude, radius, is_favorite, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        id,
        input.type,
        input.content,
        input.locationName ?? null,
        input.latitude,
        input.longitude,
        input.radius ?? 150,
        now
    );

    return {
        id,
        type: input.type,
        content: input.content,
        locationName: input.locationName ?? null,
        latitude: input.latitude,
        longitude: input.longitude,
        radius: input.radius ?? 150,
        isFavorite: false,
        createdAt: now,
        updatedAt: null,
    };
}

export async function getAllNotes(): Promise<Note[]> {
    const database = await getDB();
    const rows = await database.getAllAsync('SELECT * FROM notes ORDER BY created_at DESC');
    return rows.map(rowToNote);
}

export async function getNoteById(id: string): Promise<Note | null> {
    const database = await getDB();
    const row = await database.getFirstAsync('SELECT * FROM notes WHERE id = ?', id);
    return row ? rowToNote(row) : null;
}

export async function updateNote(
    id: string,
    updates: Partial<Pick<Note, 'content' | 'locationName'>>
): Promise<void> {
    const database = await getDB();
    const now = new Date().toISOString();

    const setClauses: string[] = ['updated_at = ?'];
    const values: any[] = [now];

    if (updates.content !== undefined) {
        setClauses.push('content = ?');
        values.push(updates.content);
    }
    if (updates.locationName !== undefined) {
        setClauses.push('location_name = ?');
        values.push(updates.locationName);
    }

    values.push(id);
    await database.runAsync(
        `UPDATE notes SET ${setClauses.join(', ')} WHERE id = ?`,
        ...values
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
    const pattern = `%${query}%`;
    const rows = await database.getAllAsync(
        `SELECT * FROM notes WHERE content LIKE ? OR location_name LIKE ? ORDER BY created_at DESC`,
        pattern,
        pattern
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
import { getDB } from './database';

export interface NoteDoodle {
  noteId: string;
  strokesJson: string;
  updatedAt: string;
}

export async function getNoteDoodle(noteId: string): Promise<NoteDoodle | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<{
    note_id: string;
    strokes_json: string;
    updated_at: string;
  }>('SELECT note_id, strokes_json, updated_at FROM note_doodles WHERE note_id = ?', noteId);

  if (!row) {
    return null;
  }

  return {
    noteId: row.note_id,
    strokesJson: row.strokes_json,
    updatedAt: row.updated_at,
  };
}

export async function saveNoteDoodle(noteId: string, strokesJson: string): Promise<NoteDoodle> {
  const database = await getDB();
  const updatedAt = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO note_doodles (note_id, strokes_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(note_id) DO UPDATE SET
        strokes_json = excluded.strokes_json,
        updated_at = excluded.updated_at`,
    noteId,
    strokesJson,
    updatedAt
  );

  return {
    noteId,
    strokesJson,
    updatedAt,
  };
}

export async function clearNoteDoodle(noteId: string): Promise<void> {
  const database = await getDB();
  await database.runAsync('DELETE FROM note_doodles WHERE note_id = ?', noteId);
}

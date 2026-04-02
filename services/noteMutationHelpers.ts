import { Note, NoteUpdates } from './database';
import { getNotePhotoUri } from './photoStorage';
import { getNotePairedVideoUri } from './livePhotoStorage';

function resolveNullableValue<T>(nextValue: T | undefined, currentValue: T | null | undefined) {
  return nextValue !== undefined ? nextValue : currentValue ?? null;
}

function resolveBooleanValue(nextValue: boolean | undefined, currentValue: boolean | undefined) {
  return nextValue !== undefined ? nextValue : currentValue ?? false;
}

export function prependNote(notes: Note[], note: Note): Note[] {
  return [note, ...notes];
}

export function replaceNoteInCollection(
  notes: Note[],
  id: string,
  updater: (note: Note) => Note
): Note[] {
  return notes.map((note) => (note.id === id ? updater(note) : note));
}

export function updateNoteInCollection(notes: Note[], id: string, updates: NoteUpdates): Note[] {
  return replaceNoteInCollection(notes, id, (note) => mergeNotePatch(note, updates));
}

export function removeNoteFromCollection(notes: Note[], id: string): Note[] {
  return notes.filter((note) => note.id !== id);
}

export function mergeNotePatch(note: Note, updates: NoteUpdates, updatedAt = new Date().toISOString()): Note {
  const nextPhotoUri = note.type === 'photo' ? getNotePhotoUri({ ...note, ...updates, type: note.type }) : '';
  const nextIsLivePhoto =
    note.type === 'photo'
      ? updates.isLivePhoto !== undefined
        ? updates.isLivePhoto
        : note.isLivePhoto ?? false
      : false;
  const nextPairedVideoUri =
    note.type === 'photo' && nextIsLivePhoto
      ? getNotePairedVideoUri({
          ...note,
          ...updates,
          type: note.type,
          isLivePhoto: nextIsLivePhoto,
        })
      : '';

  return {
    ...note,
    ...updates,
    content: note.type === 'photo' ? nextPhotoUri : updates.content ?? note.content,
    photoLocalUri: note.type === 'photo' ? nextPhotoUri || null : null,
    photoSyncedLocalUri:
      note.type === 'photo'
        ? updates.photoSyncedLocalUri !== undefined
          ? updates.photoSyncedLocalUri
          : (nextPhotoUri || null) === (note.photoLocalUri ?? null)
            ? note.photoSyncedLocalUri ?? null
            : null
        : null,
    isLivePhoto: note.type === 'photo' ? nextIsLivePhoto : false,
    pairedVideoLocalUri: note.type === 'photo' ? nextPairedVideoUri || null : null,
    pairedVideoSyncedLocalUri:
      note.type === 'photo' && nextIsLivePhoto
        ? updates.pairedVideoSyncedLocalUri !== undefined
          ? updates.pairedVideoSyncedLocalUri
          : (nextPairedVideoUri || null) === (note.pairedVideoLocalUri ?? null)
            ? note.pairedVideoSyncedLocalUri ?? null
            : null
        : null,
    pairedVideoRemotePath:
      note.type === 'photo' && nextIsLivePhoto
        ? resolveNullableValue(updates.pairedVideoRemotePath, note.pairedVideoRemotePath)
        : null,
    promptId: resolveNullableValue(updates.promptId, note.promptId),
    promptTextSnapshot: resolveNullableValue(updates.promptTextSnapshot, note.promptTextSnapshot),
    promptAnswer: resolveNullableValue(updates.promptAnswer, note.promptAnswer),
    moodEmoji: resolveNullableValue(updates.moodEmoji, note.moodEmoji),
    noteColor: resolveNullableValue(updates.noteColor, note.noteColor),
    hasDoodle: resolveBooleanValue(updates.hasDoodle, note.hasDoodle),
    doodleStrokesJson:
      updates.doodleStrokesJson !== undefined ? updates.doodleStrokesJson : note.doodleStrokesJson ?? null,
    hasStickers: updates.hasStickers !== undefined ? updates.hasStickers : note.hasStickers ?? false,
    stickerPlacementsJson:
      updates.stickerPlacementsJson !== undefined ? updates.stickerPlacementsJson : note.stickerPlacementsJson ?? null,
    updatedAt,
  };
}

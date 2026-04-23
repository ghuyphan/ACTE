import type { NoteUpdates } from './database';

const REMINDER_SELECTION_UPDATE_KEYS: ReadonlyArray<keyof NoteUpdates> = [
  'content',
  'locationName',
  'radius',
];

export function doesNoteUpdateAffectReminderSelection(updates: NoteUpdates) {
  return REMINDER_SELECTION_UPDATE_KEYS.some((key) => key in updates);
}

import { getSkipNextEnterKey } from './geofenceKeys';
import { getPersistentItem, removePersistentItem, setPersistentItem } from './appStorage';

const skipNextEnterNoteIds = new Set<string>();

export async function markSkipImmediateReminder(noteId: string): Promise<void> {
  if (!noteId) {
    return;
  }

  skipNextEnterNoteIds.add(noteId);
  await setPersistentItem(getSkipNextEnterKey(noteId), '1');
}

export async function consumeSkippedImmediateReminder(noteId: string): Promise<boolean> {
  if (!noteId) {
    return false;
  }

  if (skipNextEnterNoteIds.delete(noteId)) {
    await removePersistentItem(getSkipNextEnterKey(noteId)).catch(() => undefined);
    return true;
  }

  const skipNextEnterKey = getSkipNextEnterKey(noteId);
  const shouldSkip = await getPersistentItem(skipNextEnterKey);
  if (shouldSkip === '1') {
    await removePersistentItem(skipNextEnterKey);
    return true;
  }

  return false;
}

import { getSkipNextEnterKey, getSkipNextEnterPlaceKey } from './geofenceKeys';
import { getPersistentItem, removePersistentItem, setPersistentItem } from './appStorage';

const skipNextEnterNoteIds = new Set<string>();
const skipNextEnterPlaceKeys = new Set<string>();

type ReminderSkipTarget =
  | string
  | {
      noteId?: string | null;
      placeKey?: string | null;
    };

function normalizeReminderSkipTarget(target: ReminderSkipTarget) {
  if (typeof target === 'string') {
    return {
      noteId: target.trim(),
      placeKey: '',
    };
  }

  return {
    noteId: target.noteId?.trim() ?? '',
    placeKey: target.placeKey?.trim() ?? '',
  };
}

export async function markSkipImmediateReminder(target: ReminderSkipTarget): Promise<void> {
  const { noteId, placeKey } = normalizeReminderSkipTarget(target);

  await Promise.all([
    noteId
      ? (skipNextEnterNoteIds.add(noteId), setPersistentItem(getSkipNextEnterKey(noteId), '1'))
      : Promise.resolve(),
    placeKey
      ? (skipNextEnterPlaceKeys.add(placeKey), setPersistentItem(getSkipNextEnterPlaceKey(placeKey), '1'))
      : Promise.resolve(),
  ]);
}

export async function consumeSkippedImmediateReminder(target: ReminderSkipTarget): Promise<boolean> {
  const { noteId, placeKey } = normalizeReminderSkipTarget(target);

  if (noteId && skipNextEnterNoteIds.delete(noteId)) {
    await removePersistentItem(getSkipNextEnterKey(noteId)).catch(() => undefined);
    return true;
  }

  if (placeKey && skipNextEnterPlaceKeys.delete(placeKey)) {
    await removePersistentItem(getSkipNextEnterPlaceKey(placeKey)).catch(() => undefined);
    return true;
  }

  if (noteId) {
    const skipNextEnterKey = getSkipNextEnterKey(noteId);
    const shouldSkip = await getPersistentItem(skipNextEnterKey);
    if (shouldSkip === '1') {
      await removePersistentItem(skipNextEnterKey);
      return true;
    }
  }

  if (placeKey) {
    const skipNextEnterPlaceKey = getSkipNextEnterPlaceKey(placeKey);
    const shouldSkip = await getPersistentItem(skipNextEnterPlaceKey);
    if (shouldSkip === '1') {
      await removePersistentItem(skipNextEnterPlaceKey);
      return true;
    }
  }

  return false;
}

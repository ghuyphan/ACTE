type DeletedNotesEvent = {
  scope: string;
  noteIds: string[];
};

type DeletedNotesListener = (event: DeletedNotesEvent) => void;

const deletedNotesListeners = new Set<DeletedNotesListener>();

function normalizeDeletedNoteIds(noteIds: string[]) {
  const nextIds = noteIds
    .map((noteId) => noteId.trim())
    .filter((noteId): noteId is string => Boolean(noteId));

  return Array.from(new Set(nextIds));
}

export function emitDeletedNotesEvent(event: DeletedNotesEvent) {
  const scope = event.scope.trim();
  const noteIds = normalizeDeletedNoteIds(event.noteIds);
  if (!scope || noteIds.length === 0) {
    return;
  }

  for (const listener of deletedNotesListeners) {
    listener({
      scope,
      noteIds,
    });
  }
}

export function subscribeToDeletedNotes(
  listener: DeletedNotesListener
) {
  deletedNotesListeners.add(listener);
  return () => {
    deletedNotesListeners.delete(listener);
  };
}

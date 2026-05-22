export type SharedChatThreadChangeEvent = {
  postId?: string | null;
  userUid: string;
};

type SharedChatThreadChangeListener = (event: SharedChatThreadChangeEvent) => void;

const sharedChatThreadChangeListeners = new Set<SharedChatThreadChangeListener>();

export function emitSharedChatThreadChange(event: SharedChatThreadChangeEvent) {
  const userUid = event.userUid.trim();
  const postId = event.postId?.trim() || null;
  if (!userUid) {
    return;
  }

  for (const listener of sharedChatThreadChangeListeners) {
    listener({
      userUid,
      postId,
    });
  }
}

export function subscribeToSharedChatThreadChanges(
  listener: SharedChatThreadChangeListener
) {
  sharedChatThreadChangeListeners.add(listener);
  return () => {
    sharedChatThreadChangeListeners.delete(listener);
  };
}

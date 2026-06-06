type Translate = (key: string, fallback: string, options?: Record<string, unknown>) => string;

export type SharedChatMode = 'direct' | 'memory';

export type SharedChatRenderContext = {
  canSendMessage: boolean;
  composerPlaceholder: string;
  hasPost: boolean;
  isResolvingInitialChat: boolean;
  notFoundBody: string;
  notFoundTitle: string;
  shouldRenderChatShell: boolean;
  shouldRenderPendingThread: boolean;
  shouldShowIdentityHeader: boolean;
};

export type SharedChatTypingUser = {
  displayName?: string | null;
  photoURL?: string | null;
  userId: string;
};

function normalizeTypingUserId(userId: string | null | undefined) {
  return userId?.trim() ?? '';
}

export function getVisibleSharedChatTypingUsers<T extends SharedChatTypingUser>(
  typingUsers: T[],
  currentUserUid: string | null | undefined
) {
  const normalizedCurrentUserUid = normalizeTypingUserId(currentUserUid);
  const seenUserIds = new Set<string>();
  const visibleTypingUsers: T[] = [];

  for (const typingUser of typingUsers) {
    const normalizedTypingUserId = normalizeTypingUserId(typingUser.userId);
    if (
      !normalizedTypingUserId ||
      normalizedTypingUserId === normalizedCurrentUserUid ||
      seenUserIds.has(normalizedTypingUserId)
    ) {
      continue;
    }

    seenUserIds.add(normalizedTypingUserId);
    visibleTypingUsers.push(
      normalizedTypingUserId === typingUser.userId
        ? typingUser
        : { ...typingUser, userId: normalizedTypingUserId }
    );
  }

  return visibleTypingUsers;
}

export function getSharedChatTypingIndicatorLabel({
  getAuthorLabel,
  t,
  visibleTypingUsers,
}: {
  getAuthorLabel: (
    userId: string,
    displayName?: string | null,
    photoURL?: string | null
  ) => string;
  t: Translate;
  visibleTypingUsers: SharedChatTypingUser[];
}) {
  if (visibleTypingUsers.length === 0) {
    return null;
  }

  if (visibleTypingUsers.length === 1) {
    const typingUser = visibleTypingUsers[0];
    return t('shared.chatTypingOne', '{{name}} is typing', {
      name: getAuthorLabel(typingUser.userId, typingUser.displayName, typingUser.photoURL),
    });
  }

  return t('shared.chatTypingMany', '{{count}} people are typing', {
    count: visibleTypingUsers.length,
  });
}

export function buildSharedChatRenderContext({
  chatPostErrorMessage,
  draft,
  isDirectChat,
  isResolvingChatPost,
  isSending,
  normalizedDirectFriendUid,
  hasPost,
  primaryParticipantUid,
  t,
}: {
  chatPostErrorMessage: string | null;
  draft: string;
  isDirectChat: boolean;
  isResolvingChatPost: boolean;
  isSending: boolean;
  normalizedDirectFriendUid: string | null;
  hasPost: boolean;
  primaryParticipantUid: string | null;
  t: Translate;
}): SharedChatRenderContext {
  const mode: SharedChatMode = isDirectChat ? 'direct' : 'memory';
  const canComposePendingDirectChat = Boolean(mode === 'direct' && normalizedDirectFriendUid);
  const isResolvingPendingDirectChat = Boolean(
    !hasPost && canComposePendingDirectChat && isResolvingChatPost
  );
  const isResolvingInitialChat = !hasPost && !canComposePendingDirectChat && isResolvingChatPost;
  const shouldRenderPendingThread =
    mode === 'direct' && (isResolvingInitialChat || isResolvingPendingDirectChat);

  return {
    canSendMessage: Boolean((hasPost || canComposePendingDirectChat) && draft.trim() && !isSending),
    composerPlaceholder:
      mode === 'direct'
        ? t('shared.directChatComposerPlaceholder', 'Message')
        : t('shared.chatComposerPlaceholder', 'Reply to this memory'),
    hasPost,
    isResolvingInitialChat,
    notFoundBody:
      chatPostErrorMessage ??
      t('shared.chatNotFoundBody', 'This chat may no longer be available.'),
    notFoundTitle:
      mode === 'direct'
        ? t('shared.directChatStartFailed', 'Could not start chat.')
        : t('shared.detailNotFound', 'Shared moment not found'),
    shouldRenderChatShell: Boolean(hasPost || shouldRenderPendingThread || canComposePendingDirectChat),
    shouldRenderPendingThread,
    shouldShowIdentityHeader: Boolean(hasPost || primaryParticipantUid),
  };
}

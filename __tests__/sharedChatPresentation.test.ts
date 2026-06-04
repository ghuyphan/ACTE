import {
  buildSharedChatRenderContext,
  getSharedChatTypingIndicatorLabel,
  getVisibleSharedChatTypingUsers,
} from '../components/screens/shared/chatPresentation';

const t = (_key: string, fallback: string, options?: Record<string, unknown>) => {
  const values = options;
  return fallback
    .replace('{{name}}', String(values?.name ?? ''))
    .replace('{{count}}', String(values?.count ?? ''));
};

describe('shared chat presentation helpers', () => {
  it('filters the current user from typing indicators', () => {
    expect(
      getVisibleSharedChatTypingUsers(
        [
          { userId: 'me', displayName: 'Me' },
          { userId: 'friend', displayName: 'Friend' },
        ],
        'me'
      ).map((typingUser) => typingUser.userId)
    ).toEqual(['friend']);
  });

  it('formats one and many typing labels', () => {
    expect(
      getSharedChatTypingIndicatorLabel({
        getAuthorLabel: (_userId, displayName) => displayName ?? 'Friend',
        t,
        visibleTypingUsers: [{ userId: 'friend', displayName: 'Linh' }],
      })
    ).toBe('Linh is typing');

    expect(
      getSharedChatTypingIndicatorLabel({
        getAuthorLabel: () => 'Friend',
        t,
        visibleTypingUsers: [
          { userId: 'a', displayName: 'A' },
          { userId: 'b', displayName: 'B' },
        ],
      })
    ).toBe('2 people are typing');
  });

  it('builds pending direct chat context without an existing post', () => {
    expect(
      buildSharedChatRenderContext({
        chatPostErrorMessage: null,
        draft: 'hello',
        isDirectChat: true,
        isResolvingChatPost: false,
        isSending: false,
        normalizedDirectFriendUid: 'friend',
        hasPost: false,
        primaryParticipantUid: 'friend',
        t,
      })
    ).toEqual(
      expect.objectContaining({
        canSendMessage: true,
        composerPlaceholder: 'Message',
        shouldRenderChatShell: true,
        shouldShowIdentityHeader: true,
      })
    );
  });
});

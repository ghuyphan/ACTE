import {
  buildSharedChatRenderContext,
  getSharedChatTypingIndicatorLabel,
  getVisibleSharedChatTypingUsers,
} from '../components/screens/shared/chatPresentation';
import { isSharedThreadUnread } from '../utils/sharedChatPresentation';

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

  it('normalizes noisy typing presence payloads', () => {
    expect(
      getVisibleSharedChatTypingUsers(
        [
          { userId: ' me ', displayName: 'Me' },
          { userId: ' ', displayName: 'Nobody' },
          { userId: ' friend ', displayName: 'Friend' },
          { userId: 'friend', displayName: 'Duplicate friend' },
          { userId: 'other', displayName: 'Other' },
        ],
        'me'
      )
    ).toEqual([
      { userId: 'friend', displayName: 'Friend' },
      { userId: 'other', displayName: 'Other' },
    ]);
  });

  it('returns no typing label when no visible users remain', () => {
    expect(
      getSharedChatTypingIndicatorLabel({
        getAuthorLabel: (_userId, displayName) => displayName ?? 'Friend',
        t,
        visibleTypingUsers: [],
      })
    ).toBeNull();
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

  it('does not allow empty or in-flight pending direct sends', () => {
    expect(
      buildSharedChatRenderContext({
        chatPostErrorMessage: null,
        draft: '   ',
        isDirectChat: true,
        isResolvingChatPost: false,
        isSending: false,
        normalizedDirectFriendUid: 'friend',
        hasPost: false,
        primaryParticipantUid: 'friend',
        t,
      }).canSendMessage
    ).toBe(false);

    expect(
      buildSharedChatRenderContext({
        chatPostErrorMessage: null,
        draft: 'hello',
        isDirectChat: true,
        isResolvingChatPost: false,
        isSending: true,
        normalizedDirectFriendUid: 'friend',
        hasPost: false,
        primaryParticipantUid: 'friend',
        t,
      }).canSendMessage
    ).toBe(false);
  });

  it('keeps memory chats out of the shell while their post is still resolving', () => {
    expect(
      buildSharedChatRenderContext({
        chatPostErrorMessage: null,
        draft: 'hello',
        isDirectChat: false,
        isResolvingChatPost: true,
        isSending: false,
        normalizedDirectFriendUid: null,
        hasPost: false,
        primaryParticipantUid: null,
        t,
      })
    ).toEqual(
      expect.objectContaining({
        canSendMessage: false,
        isResolvingInitialChat: true,
        shouldRenderChatShell: false,
        shouldRenderPendingThread: false,
        shouldShowIdentityHeader: false,
      })
    );
  });

  it('treats a matching latest response id as read despite timestamp drift', () => {
    expect(
      isSharedThreadUnread(
        {
          postId: 'post-1',
          latestResponseId: 'response-latest',
          latestResponseCreatedAt: '2026-05-20T01:05:00.000Z',
          latestActivityAt: '2026-05-20T01:05:00.000Z',
          latestActivityAuthorUid: 'friend',
          latestActivityAuthorDisplayName: 'Friend',
          latestActivityAuthorPhotoURLSnapshot: null,
          latestActivityText: 'hello',
          latestActivityEmoji: null,
          latestActivityKind: 'response',
          updatedAt: '2026-05-20T01:05:00.000Z',
        },
        {
          postId: 'post-1',
          userUid: 'me',
          lastReadResponseId: 'response-latest',
          lastReadAt: '2026-05-20T01:04:59.000Z',
        },
        'me'
      )
    ).toBe(false);
  });
});

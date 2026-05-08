import {
  formatSharedResponseBody,
  getSharedChatIdentity,
  getSharedChatMemoryPreview,
  getSharedThreadSummaryBody,
  isSharedThreadUnread,
} from '../utils/sharedChatPresentation';

const labels = {
  friendFallback: 'Friend',
  photoMemory: 'Photo memory',
  photoMemoryAtPlace: (place: string) => `Photo memory from ${place}`,
  sharedNote: 'Shared note',
  someone: 'Someone',
  you: 'You',
};

describe('shared chat presentation helpers', () => {
  it('prefers private nicknames while keeping public labels separate', () => {
    expect(
      getSharedChatIdentity(
        {
          currentUserUid: 'user-1',
          friend: {
            userId: 'friend-1',
            username: 'cafe-pal',
            displayNameSnapshot: 'Cafe Pal',
            nickname: 'Bestie',
            photoURLSnapshot: 'https://example.com/avatar.jpg',
          },
          userId: 'friend-1',
        },
        labels
      )
    ).toEqual({
      avatarInitial: 'B',
      avatarUri: 'https://example.com/avatar.jpg',
      label: 'Bestie',
      publicLabel: '@cafe-pal',
    });
  });

  it('labels the current user consistently', () => {
    expect(
      getSharedChatIdentity(
        {
          currentUserUid: 'user-1',
          displayNameSnapshot: 'Huy',
          userId: 'user-1',
        },
        labels
      ).label
    ).toBe('You');
  });

  it('builds compact memory and response previews', () => {
    expect(
      getSharedChatMemoryPreview(
        {
          id: 'post-1',
          authorUid: 'friend-1',
          authorDisplayName: 'Friend',
          authorPhotoURLSnapshot: null,
          audienceUserIds: ['user-1'],
          type: 'photo',
          text: '',
          photoPath: null,
          photoLocalUri: null,
          placeName: 'Cafe',
          sourceNoteId: null,
          createdAt: '2026-05-08T01:00:00.000Z',
          updatedAt: null,
        },
        labels
      )
    ).toBe('Photo memory from Cafe');
    expect(formatSharedResponseBody({ emoji: '💛', text: 'love this' })).toBe('💛 love this');
    expect(
      getSharedThreadSummaryBody({
        postId: 'post-1',
        latestResponseId: 'response-1',
        latestResponseCreatedAt: '2026-05-08T01:00:00.000Z',
        latestActivityAt: '2026-05-08T01:00:00.000Z',
        latestActivityAuthorUid: 'friend-1',
        latestActivityAuthorDisplayName: 'Friend',
        latestActivityAuthorPhotoURLSnapshot: null,
        latestActivityText: null,
        latestActivityEmoji: '✨',
        latestActivityKind: 'reaction',
        updatedAt: '2026-05-08T01:00:00.000Z',
      })
    ).toBe('✨');
  });

  it('does not mark your own latest activity as unread', () => {
    expect(
      isSharedThreadUnread(
        {
          postId: 'post-1',
          latestResponseId: 'response-1',
          latestResponseCreatedAt: '2026-05-08T01:00:00.000Z',
          latestActivityAt: '2026-05-08T01:00:00.000Z',
          latestActivityAuthorUid: 'user-1',
          latestActivityAuthorDisplayName: 'You',
          latestActivityAuthorPhotoURLSnapshot: null,
          latestActivityText: 'hello',
          latestActivityEmoji: null,
          latestActivityKind: 'response',
          updatedAt: '2026-05-08T01:00:00.000Z',
        },
        {
          postId: 'post-1',
          userUid: 'user-1',
          lastReadResponseId: null,
          lastReadAt: '2026-05-07T01:00:00.000Z',
        },
        'user-1'
      )
    ).toBe(false);
  });
});


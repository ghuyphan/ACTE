import {
  areChatResponseListsEqual,
  groupChatResponses,
  mergeChatResponses,
  mergeResponseReactions,
  removeResponseReaction,
  type ChatThreadResponse,
} from '../hooks/shared/useSharedPostChatThread';

function response(overrides: Partial<ChatThreadResponse> = {}): ChatThreadResponse {
  return {
    id: 'response-1',
    postId: 'post-1',
    authorUid: 'friend-1',
    authorDisplayName: 'Friend',
    authorPhotoURLSnapshot: null,
    emoji: null,
    text: 'hello',
    replyToResponseId: null,
    createdAt: '2026-05-01T01:00:00.000Z',
    reactions: [],
    ...overrides,
  };
}

describe('useSharedPostChatThread helpers', () => {
  it('groups consecutive responses by day and author', () => {
    const groups = groupChatResponses(
      [
        response({ id: 'a', authorUid: 'friend-1', createdAt: '2026-05-01T01:00:00.000Z' }),
        response({ id: 'b', authorUid: 'friend-1', createdAt: '2026-05-01T01:01:00.000Z' }),
        response({ id: 'c', authorUid: 'me', createdAt: '2026-05-01T01:02:00.000Z' }),
      ],
      { today: 'Today', yesterday: 'Yesterday' }
    );

    expect(groups.map((group) => group.type)).toEqual(['day', 'group', 'group']);
    expect(groups[1]).toMatchObject({ type: 'group', authorUid: 'friend-1' });
    if (groups[1].type === 'group') {
      expect(groups[1].responses.map((item) => item.id)).toEqual(['a', 'b']);
    }
  });

  it('keeps failed local delivery state when merging snapshots', () => {
    const failed = response({
      id: 'local-shared-response-1',
      authorUid: 'me',
      text: 'will retry',
      deliveryStatus: 'failed',
      failureMessage: 'Server unavailable',
    });

    expect(mergeChatResponses([], [failed])).toEqual([failed]);
    expect(areChatResponseListsEqual([failed], mergeChatResponses([], [failed]))).toBe(true);
  });

  it('replaces optimistic reactions with confirmed reactions from the same author', () => {
    const merged = mergeResponseReactions(
      [
        {
          id: 'local-shared-response-reaction-1',
          postId: 'post-1',
          responseId: 'response-1',
          authorUid: 'me',
          authorDisplayName: 'Me',
          authorPhotoURLSnapshot: null,
          emoji: '💛',
          createdAt: '2026-05-01T01:00:00.000Z',
        },
      ],
      [
        {
          id: 'shared-response-reaction-1',
          postId: 'post-1',
          responseId: 'response-1',
          authorUid: 'me',
          authorDisplayName: 'Me',
          authorPhotoURLSnapshot: null,
          emoji: '💛',
          createdAt: '2026-05-01T01:00:01.000Z',
        },
      ]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('shared-response-reaction-1');
  });

  it('removes a reaction by id without rebuilding unrelated reactions', () => {
    const reactions = [
      {
        id: 'reaction-1',
        postId: 'post-1',
        responseId: 'response-1',
        authorUid: 'me',
        authorDisplayName: 'Me',
        authorPhotoURLSnapshot: null,
        emoji: '💛',
        createdAt: '2026-05-01T01:00:00.000Z',
      },
      {
        id: 'reaction-2',
        postId: 'post-1',
        responseId: 'response-1',
        authorUid: 'friend-1',
        authorDisplayName: 'Friend',
        authorPhotoURLSnapshot: null,
        emoji: '✨',
        createdAt: '2026-05-01T01:00:01.000Z',
      },
    ];

    expect(removeResponseReaction(reactions, { id: 'reaction-1' })).toEqual([reactions[1]]);
  });

  it('prepends older paginated responses in chronological order', () => {
    const merged = mergeChatResponses(
      [
        response({ id: 'newer', createdAt: '2026-05-01T02:00:00.000Z' }),
        response({ id: 'older', createdAt: '2026-05-01T01:00:00.000Z' }),
      ],
      []
    );

    expect(merged.map((item) => item.id)).toEqual(['older', 'newer']);
  });
});

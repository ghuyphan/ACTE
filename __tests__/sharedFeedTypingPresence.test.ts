import { getTypingUsersFromPresenceState } from '../services/sharedFeedService';

jest.mock('../services/socialPushService', () => ({
  sendSocialNotificationEvent: jest.fn(),
}));

describe('shared feed typing presence', () => {
  it('hides your own typing state and stale typing states', () => {
    const now = new Date();
    const stale = new Date(now.getTime() - 20_000).toISOString();
    const fresh = now.toISOString();

    expect(
      getTypingUsersFromPresenceState(
        {
          me: [{ user_id: 'me', is_typing: true, typing_at: fresh }],
          'friend-1': [
            {
              user_id: 'friend-1',
              display_name: 'Friend',
              photo_url: null,
              is_typing: true,
              typing_at: fresh,
            },
          ],
          'friend-2': [
            {
              user_id: 'friend-2',
              display_name: 'Old Friend',
              photo_url: null,
              is_typing: true,
              typing_at: stale,
            },
          ],
        },
        'me'
      )
    ).toEqual([
      {
        userId: 'friend-1',
        displayName: 'Friend',
        photoURL: null,
        updatedAt: fresh,
      },
    ]);
  });
});

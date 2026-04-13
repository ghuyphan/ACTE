import type { FriendInvite } from '../services/sharedFeedService';

const mockSecureStore = new Map<string, string>();
let mockPlatformOS: 'ios' | 'android' | 'web' = 'ios';

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

jest.mock('../utils/secureStorage', () => ({
  getSecureItem: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  setSecureItem: jest.fn(async (key: string, value: string) => {
    mockSecureStore.set(key, value);
  }),
  removeSecureItem: jest.fn(async (key: string) => {
    mockSecureStore.delete(key);
  }),
}));

import {
  clearStoredActiveInvite,
  getStoredActiveInvite,
  setStoredActiveInvite,
} from '../services/activeInviteStorage';

function createInvite(overrides: Partial<FriendInvite> = {}): FriendInvite {
  return {
    id: 'invite-1',
    inviterUid: 'user-1',
    inviterDisplayNameSnapshot: 'Huy',
    inviterPhotoURLSnapshot: null,
    token: 'token-1',
    createdAt: '2026-04-13T10:00:00.000Z',
    revokedAt: null,
    acceptedByUid: null,
    acceptedAt: null,
    expiresAt: '2026-04-20T10:00:00.000Z',
    url: 'noto://friends/join?inviteId=invite-1&invite=token-1',
    ...overrides,
  };
}

describe('activeInviteStorage', () => {
  beforeEach(() => {
    mockSecureStore.clear();
    mockPlatformOS = 'ios';
  });

  it('round-trips an invite from secure storage and rebuilds the join url', async () => {
    await setStoredActiveInvite('user-1', createInvite());

    await expect(getStoredActiveInvite('user-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'invite-1',
        token: 'token-1',
        url: 'noto://friends/join?inviteId=invite-1&invite=token-1',
      })
    );
  });

  it('clears malformed or expired invites instead of returning stale data', async () => {
    await setStoredActiveInvite(
      'user-1',
      createInvite({
        expiresAt: '2026-04-01T10:00:00.000Z',
      })
    );

    await expect(getStoredActiveInvite('user-1')).resolves.toBeNull();
    expect(mockSecureStore.size).toBe(0);
  });

  it('clears every stored invite when the caller requests a full reset', async () => {
    await setStoredActiveInvite('user-1', createInvite());
    await setStoredActiveInvite(
      'user-2',
      createInvite({
        id: 'invite-2',
        inviterUid: 'user-2',
        token: 'token-2',
        url: 'noto://friends/join?inviteId=invite-2&invite=token-2',
      })
    );

    await clearStoredActiveInvite();

    await expect(getStoredActiveInvite('user-1')).resolves.toBeNull();
    await expect(getStoredActiveInvite('user-2')).resolves.toBeNull();
  });

  it('keeps web invites memory-only without relying on secure storage', async () => {
    mockPlatformOS = 'web';

    await setStoredActiveInvite('user-1', createInvite());
    await expect(getStoredActiveInvite('user-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'invite-1',
      })
    );

    await clearStoredActiveInvite('user-1');
    await expect(getStoredActiveInvite('user-1')).resolves.toBeNull();
  });
});

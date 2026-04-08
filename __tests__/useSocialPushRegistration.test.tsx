import { renderHook, waitFor } from '@testing-library/react-native';
import { useSocialPushRegistration } from '../hooks/app/useSocialPushRegistration';

const mockSyncSocialPushRegistration = jest.fn<Promise<void>, [unknown]>(async () => undefined);

const mockAuthState = {
  user: {
    id: 'user-1',
    uid: 'user-1',
    displayName: 'Huy',
    email: 'huy@example.com',
    photoURL: null,
  } as any,
};

const mockConnectivityState = {
  isOnline: false,
};

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('../hooks/useConnectivity', () => ({
  useConnectivity: () => mockConnectivityState,
}));

jest.mock('../services/socialPushService', () => ({
  syncSocialPushRegistration: (user: unknown) => mockSyncSocialPushRegistration(user),
}));

describe('useSocialPushRegistration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectivityState.isOnline = false;
  });

  it('retries registration when connectivity returns', async () => {
    const hook = renderHook(() => useSocialPushRegistration());

    expect(mockSyncSocialPushRegistration).not.toHaveBeenCalled();

    mockConnectivityState.isOnline = true;
    hook.rerender({});

    await waitFor(() => {
      expect(mockSyncSocialPushRegistration).toHaveBeenCalledTimes(1);
      expect(mockSyncSocialPushRegistration).toHaveBeenCalledWith(mockAuthState.user);
    });
  });
});

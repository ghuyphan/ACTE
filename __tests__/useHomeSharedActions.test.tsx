import { act, renderHook } from '@testing-library/react-native';
import { Share } from 'react-native';
import { useHomeSharedActions } from '../hooks/app/useHomeSharedActions';

const mockShowAppAlert = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, options?: Record<string, string>) =>
      options?.url ? (fallback ?? key).replace('{{url}}', options.url) : (fallback ?? key),
  }),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
  },
  NotificationFeedbackType: {
    Success: 'success',
  },
}));

jest.mock('../utils/alert', () => ({
  showAppAlert: (...args: unknown[]) => mockShowAppAlert(...args),
}));

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function createHookOptions(overrides: Partial<Parameters<typeof useHomeSharedActions>[0]> = {}) {
  return {
    user: { uid: 'user-1' },
    sharedEnabled: true,
    isAuthAvailable: true,
    friendsCount: 0,
    activeInvite: null,
    createFriendInvite: jest.fn(),
    revokeFriendInvite: jest.fn(async () => undefined),
    removeFriend: jest.fn(async () => undefined),
    dismissSharedManageSheet: jest.fn(),
    presentSharedManageSheet: jest.fn(),
    openAuthForShare: jest.fn(),
    showSharedUnavailableSheet: jest.fn(),
    setCaptureTarget: jest.fn(),
    ...overrides,
  };
}

describe('useHomeSharedActions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockShowAppAlert.mockReset();
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('creates an invite without dismissing the sheet or opening native share', async () => {
    const options = createHookOptions({
      createFriendInvite: jest.fn().mockResolvedValue({
        id: 'invite-1',
        url: 'https://noto.app/invite-1',
      }),
    });

    const { result } = renderHook(() => useHomeSharedActions(options));

    await act(async () => {
      await result.current.handleCreateInvite();
    });

    expect(options.createFriendInvite).toHaveBeenCalledTimes(1);
    expect(options.dismissSharedManageSheet).not.toHaveBeenCalled();
    expect(Share.share).not.toHaveBeenCalled();
  });

  it('ignores duplicate share taps while invite sharing is already in flight', async () => {
    const inviteDeferred = createDeferred<{ id: string; url: string }>();
    const options = createHookOptions({
      createFriendInvite: jest.fn().mockReturnValue(inviteDeferred.promise),
    });

    const { result } = renderHook(() => useHomeSharedActions(options));

    await act(async () => {
      void result.current.handleShareInvite();
      void result.current.handleShareInvite();
      await Promise.resolve();
    });

    expect(options.createFriendInvite).toHaveBeenCalledTimes(1);
    expect(options.dismissSharedManageSheet).not.toHaveBeenCalled();
    expect(Share.share).not.toHaveBeenCalled();

    await act(async () => {
      inviteDeferred.resolve({
        id: 'invite-1',
        url: 'https://noto.app/invite-1',
      });
      await Promise.resolve();
    });

    expect(options.dismissSharedManageSheet).toHaveBeenCalledTimes(1);
    expect(Share.share).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(220);
      await Promise.resolve();
    });

    expect(Share.share).toHaveBeenCalledTimes(1);
    expect(Share.share).toHaveBeenCalledWith({
      message: 'Join my Noto shared feed: https://noto.app/invite-1',
      url: 'https://noto.app/invite-1',
    });
  });

  it('routes unauthenticated invite creation through auth flow', async () => {
    const options = createHookOptions({
      user: null,
    });

    const { result } = renderHook(() => useHomeSharedActions(options));

    await act(async () => {
      await result.current.handleCreateInvite();
    });

    expect(options.openAuthForShare).toHaveBeenCalledTimes(1);
    expect(options.createFriendInvite).not.toHaveBeenCalled();
    expect(Share.share).not.toHaveBeenCalled();
  });

  it('keeps the sheet open when invite creation fails before sharing', async () => {
    const options = createHookOptions({
      createFriendInvite: jest.fn().mockRejectedValue(new Error('network down')),
    });

    const { result } = renderHook(() => useHomeSharedActions(options));

    await act(async () => {
      await result.current.handleShareInvite();
    });

    expect(options.dismissSharedManageSheet).not.toHaveBeenCalled();
    expect(Share.share).not.toHaveBeenCalled();
    expect(mockShowAppAlert).toHaveBeenCalled();
  });
});

import { renderHook, waitFor } from '@testing-library/react-native';
import type * as Notifications from 'expo-notifications';
import { useAppNotificationRouting } from '../hooks/app/useAppNotificationRouting';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockDismissTo = jest.fn();
const mockRequestFeedFocus = jest.fn();
const mockCloseNoteDetail = jest.fn();
const mockPeekActiveFeedTarget = jest.fn();
let mockPathname = '/shared';
const mockGetLastNotificationResponseAsync = jest.fn<
  Promise<Notifications.NotificationResponse | null>,
  []
>(async () => null);
const mockClearLastNotificationResponseAsync = jest.fn<Promise<void>, []>(async () => undefined);
const mockAddNotificationResponseReceivedListener = jest.fn<
  Notifications.EventSubscription,
  [(response: Notifications.NotificationResponse) => void]
>(() => ({
  remove: jest.fn(),
}));

let mockRootNavigationState: { key?: string } | null = null;

jest.mock('expo-router', () => ({
  useRouter: () => ({
    dismissTo: (...args: unknown[]) => mockDismissTo(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    push: (...args: unknown[]) => mockPush(...args),
  }),
  usePathname: () => mockPathname,
  useRootNavigationState: () => mockRootNavigationState,
}));

jest.mock('expo-notifications', () => ({
  getLastNotificationResponseAsync: () => mockGetLastNotificationResponseAsync(),
  clearLastNotificationResponseAsync: () => mockClearLastNotificationResponseAsync(),
  addNotificationResponseReceivedListener: (listener: (response: Notifications.NotificationResponse) => void) =>
    mockAddNotificationResponseReceivedListener(listener),
}));

jest.mock('../hooks/useFeedFocus', () => ({
  useFeedFocus: () => ({
    requestFeedFocus: (...args: unknown[]) => mockRequestFeedFocus(...args),
  }),
}));

jest.mock('../hooks/useActiveFeedTarget', () => ({
  useActiveFeedTarget: () => ({
    peekActiveFeedTarget: (...args: unknown[]) => mockPeekActiveFeedTarget(...args),
  }),
}));

jest.mock('../hooks/useNoteDetailSheet', () => ({
  useNoteDetailSheet: () => ({
    closeNoteDetail: (...args: unknown[]) => mockCloseNoteDetail(...args),
  }),
}));

describe('useAppNotificationRouting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRootNavigationState = null;
    mockPathname = '/shared';
    mockGetLastNotificationResponseAsync.mockResolvedValue(null);
    mockPeekActiveFeedTarget.mockReturnValue(null);
  });

  it('waits for the root navigation state before processing the last notification response', async () => {
    const notificationResponse = {
      notification: {
        request: {
          identifier: 'notification-1',
          content: {
            data: {
              noteId: 'note-42',
            },
          },
        },
      },
    } as unknown as Notifications.NotificationResponse;

    mockGetLastNotificationResponseAsync.mockResolvedValue(notificationResponse);

    const { rerender } = renderHook(() => useAppNotificationRouting());

    expect(mockGetLastNotificationResponseAsync).not.toHaveBeenCalled();
    expect(mockAddNotificationResponseReceivedListener).not.toHaveBeenCalled();

    mockRootNavigationState = { key: 'root-ready' };
    rerender(undefined);

    await waitFor(() => {
      expect(mockGetLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
      expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
      expect(mockCloseNoteDetail).toHaveBeenCalledTimes(1);
      expect(mockRequestFeedFocus).toHaveBeenCalledWith({ kind: 'note', id: 'note-42' });
      expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)');
      expect(mockClearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
    });
  });

  it('routes friend accepted notifications to the home shared-manage flow', async () => {
    const notificationResponse = {
      notification: {
        request: {
          identifier: 'friend-accepted-1',
          content: {
            data: {
              notificationType: 'friend-accepted',
              route: '/shared',
              friendUserId: 'friend-42',
            },
          },
        },
      },
    } as unknown as Notifications.NotificationResponse;

    mockGetLastNotificationResponseAsync.mockResolvedValue(notificationResponse);
    mockRootNavigationState = { key: 'root-ready' };

    renderHook(() => useAppNotificationRouting());

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/(tabs)?openSharedManageAt=friend-accepted-1');
      expect(mockClearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
    });
  });
});

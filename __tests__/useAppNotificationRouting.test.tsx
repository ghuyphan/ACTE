import { renderHook, waitFor } from '@testing-library/react-native';
import type * as Notifications from 'expo-notifications';
import { useAppNotificationRouting } from '../hooks/app/useAppNotificationRouting';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockRequestFeedFocus = jest.fn();
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
    replace: (...args: unknown[]) => mockReplace(...args),
    push: (...args: unknown[]) => mockPush(...args),
  }),
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

describe('useAppNotificationRouting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRootNavigationState = null;
    mockGetLastNotificationResponseAsync.mockResolvedValue(null);
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
      expect(mockRequestFeedFocus).toHaveBeenCalledWith({ kind: 'note', id: 'note-42' });
      expect(mockReplace).toHaveBeenCalledWith('/widget/note/note-42');
      expect(mockClearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
    });
  });
});

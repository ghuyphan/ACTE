const mockScheduleNotificationAsync = jest.fn();
const mockRegisterTaskAsync = jest.fn();
const mockIsTaskRegisteredAsync = jest.fn();
const mockRefreshSharedFeed = jest.fn();
const mockUpdateWidgetData = jest.fn();
const mockGetSupabaseUser = jest.fn();

(globalThis as any).__mockSocialPushTaskHandler = null;

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
}));

jest.mock('expo-notifications', () => ({
  BackgroundNotificationTaskResult: {
    NewData: 0,
    NoData: 1,
    Failed: 2,
  },
  scheduleNotificationAsync: (...args: unknown[]) => mockScheduleNotificationAsync(...args),
  registerTaskAsync: (...args: unknown[]) => mockRegisterTaskAsync(...args),
}));

jest.mock('expo-task-manager', () => ({
  isTaskDefined: jest.fn(() => false),
  defineTask: (name: string, handler: (payload: unknown) => Promise<unknown>) => {
    (globalThis as any).__mockSocialPushTaskHandler = handler;
  },
  isTaskRegisteredAsync: (...args: unknown[]) => mockIsTaskRegisteredAsync(...args),
}));

jest.mock('../services/notificationService', () => ({
  ANDROID_SOCIAL_CHANNEL_ID: 'social-v2',
}));

jest.mock('../services/sharedFeedService', () => ({
  refreshSharedFeed: (...args: unknown[]) => mockRefreshSharedFeed(...args),
}));

jest.mock('../services/widgetService', () => ({
  updateWidgetData: (...args: unknown[]) => mockUpdateWidgetData(...args),
}));

jest.mock('../utils/supabase', () => ({
  getSupabaseUser: (...args: unknown[]) => mockGetSupabaseUser(...args),
}));

import {
  handleSocialPushNotificationTask,
  registerSocialPushBackgroundTaskAsync,
  SOCIAL_PUSH_NOTIFICATION_TASK_NAME,
} from '../utils/backgroundSocialPush';

beforeEach(() => {
  jest.clearAllMocks();
  mockIsTaskRegisteredAsync.mockResolvedValue(false);
  mockGetSupabaseUser.mockResolvedValue({ id: 'me', uid: 'me' });
  mockRefreshSharedFeed.mockResolvedValue({
    friends: [],
    activeInvite: null,
    sharedPosts: [
      {
        id: 'shared-1',
        authorUid: 'friend-1',
      },
    ],
  });
  mockUpdateWidgetData.mockResolvedValue({
    status: 'updated',
  });
});

describe('backgroundSocialPush', () => {
  it('refreshes the widget and schedules a local Android notification for a headless shared post push', async () => {
    const result = await handleSocialPushNotificationTask({
      notification: null,
      data: {
        notificationType: 'shared-post',
        sharedPostId: 'shared-1',
        route: '/shared/shared-1',
        notificationTitle: 'Bao shared a memory with you',
        notificationBody: 'Open Noto to read the note they shared with you.',
        notificationChannelId: 'social-v2',
      },
    } as any);

    expect(result).toBe(0);
    expect(mockRefreshSharedFeed).toHaveBeenCalledWith({ id: 'me', uid: 'me' });
    expect(mockUpdateWidgetData).toHaveBeenCalledWith({
      includeLocationLookup: false,
      includeSharedRefresh: false,
      preferredNoteId: 'shared-1',
    });
    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: 'Bao shared a memory with you',
        body: 'Open Noto to read the note they shared with you.',
        sound: 'default',
        channelId: 'social-v2',
        data: {
          route: '/shared/shared-1',
          sharedPostId: 'shared-1',
        },
      },
      trigger: null,
    });
  });

  it('ignores unrelated background pushes', async () => {
    const result = await handleSocialPushNotificationTask({
      notification: null,
      data: {
        notificationType: 'friend-accepted',
      },
    } as any);

    expect(result).toBe(1);
    expect(mockRefreshSharedFeed).not.toHaveBeenCalled();
    expect(mockUpdateWidgetData).not.toHaveBeenCalled();
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('registers the background task with expo-notifications', async () => {
    await registerSocialPushBackgroundTaskAsync();

    expect(mockIsTaskRegisteredAsync).toHaveBeenCalledWith(
      SOCIAL_PUSH_NOTIFICATION_TASK_NAME
    );
    expect(mockRegisterTaskAsync).toHaveBeenCalledWith(
      SOCIAL_PUSH_NOTIFICATION_TASK_NAME
    );
  });
});

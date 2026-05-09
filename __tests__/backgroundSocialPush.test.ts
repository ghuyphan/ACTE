const mockScheduleNotificationAsync = jest.fn();
const mockRegisterTaskAsync = jest.fn();
const mockIsTaskRegisteredAsync = jest.fn();
const mockRefreshSharedFeed = jest.fn();
const mockUpdateWidgetData = jest.fn();
const mockGetSupabaseUser = jest.fn();
const mockGetCachedSharedFeedSnapshot = jest.fn();

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

jest.mock('../services/sharedFeedCache', () => ({
  getCachedSharedFeedSnapshot: (...args: unknown[]) => mockGetCachedSharedFeedSnapshot(...args),
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
  require('react-native').Platform.OS = 'android';
  mockIsTaskRegisteredAsync.mockResolvedValue(false);
  mockGetSupabaseUser.mockResolvedValue({ id: 'me', uid: 'me' });
  mockGetCachedSharedFeedSnapshot.mockResolvedValue({
    friends: [],
    activeInvite: null,
    sharedPosts: [
      {
        id: 'shared-1',
        authorUid: 'friend-1',
      },
    ],
    lastUpdatedAt: '2026-04-20T00:00:00.000Z',
  });
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
      sharedPosts: [
        {
          id: 'shared-1',
          authorUid: 'friend-1',
        },
      ],
      preferredNoteId: 'shared-1',
    });
    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
      content: expect.objectContaining({
        title: 'Bao shared a memory with you',
        body: 'Open Noto to read the note they shared with you.',
        sound: 'default',
        channelId: 'social-v2',
        data: expect.objectContaining({
          route: '/shared/shared-1',
          notificationType: 'shared-post',
          notificationTitle: 'Bao shared a memory with you',
          notificationBody: 'Open Noto to read the note they shared with you.',
          sharedPostId: 'shared-1',
        }),
      }),
      trigger: null,
    });
  });

  it('schedules a local iOS notification after a headless shared post refresh', async () => {
    require('react-native').Platform.OS = 'ios';

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
    expect(mockUpdateWidgetData).toHaveBeenCalledWith({
      includeLocationLookup: false,
      includeSharedRefresh: false,
      sharedPosts: [
        {
          id: 'shared-1',
          authorUid: 'friend-1',
        },
      ],
      preferredNoteId: 'shared-1',
    });
    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
      content: expect.objectContaining({
        title: 'Bao shared a memory with you',
        body: 'Open Noto to read the note they shared with you.',
        sound: 'default',
        data: expect.objectContaining({
          route: '/shared/shared-1',
          notificationType: 'shared-post',
          notificationTitle: 'Bao shared a memory with you',
          notificationBody: 'Open Noto to read the note they shared with you.',
          sharedPostId: 'shared-1',
        }),
      }),
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

  it('falls back to cached shared feed data when refresh is unavailable', async () => {
    mockRefreshSharedFeed.mockRejectedValueOnce(new Error('offline'));

    const result = await handleSocialPushNotificationTask({
      notification: null,
      data: {
        notificationType: 'shared-post',
        sharedPostId: 'shared-1',
        route: '/shared/shared-1',
        notificationTitle: 'Bao shared a memory with you',
        notificationBody: 'Open Noto to read the note they shared with you.',
      },
    } as any);

    expect(result).toBe(0);
    expect(mockRefreshSharedFeed).toHaveBeenCalledWith({ id: 'me', uid: 'me' });
    expect(mockGetCachedSharedFeedSnapshot).toHaveBeenCalledWith('me');
    expect(mockUpdateWidgetData).toHaveBeenCalledWith({
      includeLocationLookup: false,
      includeSharedRefresh: false,
      sharedPosts: [
        {
          id: 'shared-1',
          authorUid: 'friend-1',
        },
      ],
      preferredNoteId: 'shared-1',
    });
    expect(mockScheduleNotificationAsync).toHaveBeenCalled();
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

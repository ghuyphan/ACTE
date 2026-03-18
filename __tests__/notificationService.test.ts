const mockSetNotificationChannelAsync = jest.fn(async () => undefined);

function loadNotificationService() {
  jest.resetModules();

  jest.doMock('../constants/i18n', () => ({
    __esModule: true,
    default: {
      t: (_key: string, fallback?: string) => fallback ?? _key,
    },
  }));

  jest.doMock('expo-notifications', () => ({
    __esModule: true,
    AndroidImportance: {
      HIGH: 'high',
    },
    AndroidNotificationVisibility: {
      PUBLIC: 'public',
    },
    setNotificationChannelAsync: mockSetNotificationChannelAsync,
  }));

  return require('../services/notificationService') as typeof import('../services/notificationService');
}

describe('notificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates the Android reminder channel with the expected configuration', async () => {
    const { configureNotificationChannels, ANDROID_REMINDER_CHANNEL_ID } = loadNotificationService();

    await configureNotificationChannels('android');

    expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
      ANDROID_REMINDER_CHANNEL_ID,
      expect.objectContaining({
        name: 'Nearby reminders',
        importance: 'high',
        showBadge: false,
      })
    );

    const firstCall = mockSetNotificationChannelAsync.mock.calls[0] as unknown as
      | [string, Record<string, unknown>]
      | undefined;
    expect(firstCall).toBeDefined();
    expect(firstCall?.[1]).not.toHaveProperty('sound');
  });

  it('skips notification channel setup on non-Android platforms', async () => {
    const { configureNotificationChannels } = loadNotificationService();

    await configureNotificationChannels('ios');

    expect(mockSetNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it('adds the Android channel id to reminder notifications', () => {
    const { buildReminderNotificationContent, ANDROID_REMINDER_CHANNEL_ID } = loadNotificationService();

    expect(
      buildReminderNotificationContent(
        {
          title: 'Nearby reminder',
          body: 'Open Noto',
          noteId: 'note-1',
        },
        'android'
      )
    ).toEqual(
      expect.objectContaining({
        title: 'Nearby reminder',
        body: 'Open Noto',
        channelId: ANDROID_REMINDER_CHANNEL_ID,
        data: { noteId: 'note-1' },
      })
    );
  });
});

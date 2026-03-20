const mockSetNotificationChannelAsync = jest.fn(async () => undefined);
const mockStorage = new Map<string, string>();

function loadNotificationService() {
  jest.resetModules();

  jest.doMock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
      getItem: async (key: string) => mockStorage.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        mockStorage.set(key, value);
      },
    },
  }));

  jest.doMock('../constants/i18n', () => ({
    __esModule: true,
    default: {
      language: 'vi',
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
    mockStorage.clear();
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

  it('rotates nearby reminder titles so the same line does not repeat every time', async () => {
    const { buildNearbyReminderCopy } = loadNotificationService();

    const first = await buildNearbyReminderCopy({
      noteType: 'text',
      locationName: 'District 1',
      noteBody: 'Them hanh phi',
    });
    const second = await buildNearbyReminderCopy({
      noteType: 'text',
      locationName: 'District 1',
      noteBody: 'Them hanh phi',
    });

    expect(first.body).toBe('Them hanh phi');
    expect(second.body).toBe('Them hanh phi');
    expect(first.title).not.toBe(second.title);
  });
});

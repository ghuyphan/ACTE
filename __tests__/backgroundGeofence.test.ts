const mockStorage = new Map<string, string>();
const mockScheduleNotificationAsync = jest.fn();
const mockGetNoteByIdForScope = jest.fn();
const mockGetAllNotesForScope = jest.fn();
const mockGetPersistedActiveNotesScope = jest.fn();
const mockUpdateWidgetData = jest.fn();
const mockBuildNearbyReminderCopy = jest.fn();
const mockBuildReminderNotificationContent = jest.fn();
const mockConfigureNotificationChannels = jest.fn();
const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

(globalThis as any).__mockGeofenceTaskHandler = null;

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => mockStorage.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    mockStorage.set(key, value);
  },
  removeItem: async (key: string) => {
    mockStorage.delete(key);
  },
}));

jest.mock('expo-location', () => ({
  LocationGeofencingEventType: {
    Enter: 'enter',
    Exit: 'exit',
  },
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: (...args: unknown[]) => mockScheduleNotificationAsync(...args),
}));

jest.mock('expo-task-manager', () => ({
  isTaskDefined: jest.fn(() => false),
  defineTask: (name: string, handler: (payload: unknown) => Promise<void>) => {
    (globalThis as any).__mockGeofenceTaskHandler = handler;
  },
}));

jest.mock('../services/database', () => ({
  LOCAL_NOTES_SCOPE: '__local__',
  getNoteByIdForScope: (...args: unknown[]) => mockGetNoteByIdForScope(...args),
  getAllNotesForScope: (...args: unknown[]) => mockGetAllNotesForScope(...args),
  getPersistedActiveNotesScope: (...args: unknown[]) => mockGetPersistedActiveNotesScope(...args),
}));

jest.mock('../services/widgetService', () => ({
  updateWidgetData: (...args: unknown[]) => mockUpdateWidgetData(...args),
}));

jest.mock('../services/notificationService', () => ({
  buildNearbyReminderCopy: (...args: unknown[]) => mockBuildNearbyReminderCopy(...args),
  buildReminderNotificationContent: (...args: unknown[]) => mockBuildReminderNotificationContent(...args),
  configureNotificationChannels: (...args: unknown[]) => mockConfigureNotificationChannels(...args),
}));

jest.mock('../constants/i18n', () => ({
  __esModule: true,
  i18nReady: Promise.resolve(),
  default: {
    language: 'vi',
    t: (key: string, options?: { location?: string }) => {
      if (key === 'notification.textTitle') {
        return options?.location ?? 'Nearby reminder';
      }
      if (key === 'notification.photoTitle') {
        return options?.location ?? 'Nearby reminder';
      }
      if (key === 'notification.photoBody') {
        return 'A memory from here is waiting.';
      }
      if (key === 'notification.title') {
        return 'Nearby reminder';
      }
      if (key === 'notification.body') {
        return 'A note is ready when you open Noto.';
      }
      if (key === 'widget.unknownPlace') {
        return 'Unknown Place';
      }
      return key;
    },
  },
}));

import { getGeofenceCooldownKey, getLocationCooldownId, getSkipNextEnterKey } from '../utils/geofenceKeys';

function buildNote(overrides: Partial<any> = {}) {
  return {
    id: 'note-1',
    type: 'text',
    content: 'Order the iced tea',
    locationName: 'District 1',
    latitude: 10.77,
    longitude: 106.69,
    radius: 150,
    isFavorite: false,
    createdAt: '2026-03-10T10:00:00.000Z',
    updatedAt: null,
    ...overrides,
  };
}

function setMockNotes(notes: Array<any>) {
  mockGetAllNotesForScope.mockResolvedValue(notes);
  mockGetNoteByIdForScope.mockImplementation(async (id: string) => notes.find((note) => note.id === id) ?? null);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  mockStorage.clear();
  (globalThis as any).__mockGeofenceTaskHandler = null;
  mockGetPersistedActiveNotesScope.mockResolvedValue('user-1');
  mockUpdateWidgetData.mockResolvedValue(undefined);
  mockConfigureNotificationChannels.mockResolvedValue(undefined);
  mockBuildNearbyReminderCopy.mockImplementation(
    async ({ locationName, noteBody, noteType }: { locationName?: string | null; noteBody?: string | null; noteType: 'text' | 'photo' }) => ({
      title: locationName?.trim() ? `Này, ${locationName.trim()} quen không?` : 'Nearby reminder',
      body: noteBody?.trim() || (noteType === 'photo'
        ? 'Có một kỷ niệm từ nơi này đang chờ bạn.'
        : 'A note is ready when you open Noto.'),
    })
  );
  mockBuildReminderNotificationContent.mockImplementation(
    ({ title, body, noteId }: { title: string; body: string; noteId?: string | null }) => ({
      title,
      body,
      data: noteId ? { noteId } : {},
    })
  );
  setMockNotes([buildNote()]);
  require('../utils/backgroundGeofence');
});

afterAll(() => {
  consoleInfoSpy.mockRestore();
});

async function runEnterEvent(noteId = 'note-1') {
  const handler = (globalThis as any).__mockGeofenceTaskHandler as
    | ((payload: any) => Promise<void>)
    | null;
  if (!handler) {
    throw new Error('Geofence task was not registered');
  }

  await handler({
    data: {
      eventType: 'enter',
      region: {
        identifier: noteId,
      },
    },
  });
}

async function runEnterEventWithoutIdentifier() {
  const handler = (globalThis as any).__mockGeofenceTaskHandler as
    | ((payload: any) => Promise<void>)
    | null;
  if (!handler) {
    throw new Error('Geofence task was not registered');
  }

  await handler({
    data: {
      eventType: 'enter',
      region: {},
    },
  });
}

describe('backgroundGeofence', () => {
  it('skips the first immediate enter event after a note is saved', async () => {
    mockStorage.set(getSkipNextEnterKey('note-1'), '1');

    await runEnterEvent('note-1');

    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mockStorage.has(getSkipNextEnterKey('note-1'))).toBe(false);
  });

  it('suppresses notifications while the selected reminder note is on cooldown', async () => {
    mockStorage.set(getGeofenceCooldownKey('note', 'note-1'), String(Date.now()));

    await runEnterEvent('note-1');

    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('waits for the widget refresh before finishing when a cooldown suppresses the notification', async () => {
    mockStorage.set(getGeofenceCooldownKey('note', 'note-1'), String(Date.now()));
    let resolveWidgetRefresh!: () => void;
    let widgetRefreshStarted = false;
    let taskFinished = false;
    mockUpdateWidgetData.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          widgetRefreshStarted = true;
          resolveWidgetRefresh = () => resolve();
        })
    );

    const taskPromise = runEnterEvent('note-1').then(() => {
      taskFinished = true;
    });
    for (let attempt = 0; attempt < 10 && !widgetRefreshStarted; attempt += 1) {
      await Promise.resolve();
    }

    expect(widgetRefreshStarted).toBe(true);
    expect(taskFinished).toBe(false);
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();

    resolveWidgetRefresh();
    await taskPromise;

    expect(taskFinished).toBe(true);
  });

  it('suppresses duplicate location notifications and refreshes the selected note cooldown', async () => {
    mockStorage.set(
      getGeofenceCooldownKey('location', getLocationCooldownId('District 1', 10.77, 106.69)),
      String(Date.now())
    );

    await runEnterEvent('note-1');

    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mockStorage.has(getGeofenceCooldownKey('note', 'note-1'))).toBe(true);
  });

  it('selects the best note for the place instead of the raw triggered note', async () => {
    setMockNotes([
      buildNote({
        id: 'photo-note',
        type: 'photo',
        content: 'file:///photos/photo.jpg',
        createdAt: '2026-03-10T11:00:00.000Z',
      }),
      buildNote({
        id: 'preference-note',
        type: 'text',
        content: 'She likes the iced tea here',
        createdAt: '2026-03-10T09:00:00.000Z',
      }),
    ]);

    await runEnterEvent('photo-note');

    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: 'Này, District 1 quen không?',
        body: 'She likes the iced tea here',
        data: { noteId: 'preference-note' },
      },
      trigger: null,
    });
    expect(mockStorage.has(getGeofenceCooldownKey('note', 'preference-note'))).toBe(true);
  });

  it('uses place-led subtle copy for text reminders', async () => {
    await runEnterEvent('note-1');

    expect(mockUpdateWidgetData).toHaveBeenCalledWith({
      notes: [buildNote()],
      includeLocationLookup: false,
      currentLocation: { latitude: 10.77, longitude: 106.69 },
      preferredNoteId: 'note-1',
    });
    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: 'Này, District 1 quen không?',
        body: 'Order the iced tea',
        data: { noteId: 'note-1' },
      },
      trigger: null,
    });
    expect(mockConfigureNotificationChannels).toHaveBeenCalled();
    expect(
      mockStorage.has(
        getGeofenceCooldownKey('location', getLocationCooldownId('District 1', 10.77, 106.69))
      )
    ).toBe(true);
  });

  it('uses photo fallback copy only when there is no usable text reminder', async () => {
    setMockNotes([
      buildNote({
        id: 'blank-text',
        type: 'text',
        content: '   ',
        createdAt: '2026-03-10T12:00:00.000Z',
      }),
      buildNote({
        id: 'photo-note',
        type: 'photo',
        content: 'file:///photos/photo.jpg',
        createdAt: '2026-03-10T09:00:00.000Z',
      }),
    ]);

    await runEnterEvent('blank-text');

    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: 'Này, District 1 quen không?',
        body: 'Có một kỷ niệm từ nơi này đang chờ bạn.',
        data: { noteId: 'photo-note' },
      },
      trigger: null,
    });
  });

  it('omits note routing data when the geofence region identifier is missing', async () => {
    mockGetAllNotesForScope.mockResolvedValue([]);
    mockGetNoteByIdForScope.mockResolvedValue(null);

    await runEnterEventWithoutIdentifier();

    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: 'Nearby reminder',
        body: 'A note is ready when you open Noto.',
        data: {},
      },
      trigger: null,
    });
  });
});

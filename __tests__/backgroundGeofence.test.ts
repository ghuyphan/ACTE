const mockStorage = new Map<string, string>();
const mockScheduleNotificationAsync = jest.fn();
const mockGetNoteById = jest.fn();

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
  defineTask: (name: string, handler: (payload: unknown) => Promise<void>) => {
    (globalThis as any).__mockGeofenceTaskHandler = handler;
  },
}));

jest.mock('../services/database', () => ({
  getNoteById: (...args: unknown[]) => mockGetNoteById(...args),
}));

jest.mock('../constants/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string, options?: { location?: string }) => {
      if (key === 'notification.textTitle') {
        return `Reminder ${options?.location}`;
      }
      if (key === 'notification.photoTitle') {
        return `Photo ${options?.location}`;
      }
      if (key === 'notification.photoBody') {
        return 'You took a photo here';
      }
      if (key === 'notification.title') {
        return 'Remember';
      }
      if (key === 'notification.body') {
        return 'Open the note';
      }
      if (key === 'widget.unknownPlace') {
        return 'Unknown Place';
      }
      return key;
    },
  },
}));

import { getGeofenceCooldownKey, getLocationCooldownId, getSkipNextEnterKey } from '../utils/geofenceKeys';
require('../utils/backgroundGeofence');

beforeEach(() => {
  jest.clearAllMocks();
  mockStorage.clear();
  mockGetNoteById.mockResolvedValue({
    id: 'note-1',
    type: 'text',
    content: 'Order the iced tea',
    locationName: 'District 1',
    latitude: 10.77,
    longitude: 106.69,
  });
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

describe('backgroundGeofence', () => {
  it('skips the first immediate enter event after a note is saved', async () => {
    mockStorage.set(getSkipNextEnterKey('note-1'), '1');

    await runEnterEvent('note-1');

    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mockStorage.has(getSkipNextEnterKey('note-1'))).toBe(false);
  });

  it('suppresses notifications while the note is on cooldown', async () => {
    mockStorage.set(getGeofenceCooldownKey('note', 'note-1'), String(Date.now()));

    await runEnterEvent('note-1');

    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('suppresses duplicate location notifications and refreshes the note cooldown', async () => {
    mockStorage.set(
      getGeofenceCooldownKey('location', getLocationCooldownId('District 1', 10.77, 106.69)),
      String(Date.now())
    );

    await runEnterEvent('note-1');

    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mockStorage.has(getGeofenceCooldownKey('note', 'note-1'))).toBe(true);
  });

  it('schedules a reminder and records cooldowns for a valid enter event', async () => {
    await runEnterEvent('note-1');

    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: 'Reminder District 1',
        body: 'Order the iced tea',
        data: { noteId: 'note-1' },
      },
      trigger: null,
    });
    expect(mockStorage.has(getGeofenceCooldownKey('note', 'note-1'))).toBe(true);
    expect(
      mockStorage.has(
        getGeofenceCooldownKey('location', getLocationCooldownId('District 1', 10.77, 106.69))
      )
    ).toBe(true);
  });
});

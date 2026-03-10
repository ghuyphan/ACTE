const mockStorage = new Map<string, string>();

const mockGetForegroundPermissionsAsync = jest.fn();
const mockGetBackgroundPermissionsAsync = jest.fn();
const mockHasStartedGeofencingAsync = jest.fn();
const mockStartGeofencingAsync = jest.fn();
const mockStopGeofencingAsync = jest.fn();
const mockNotificationsGetPermissionsAsync = jest.fn();
const mockGetAllNotes = jest.fn();

jest.mock('../constants/i18n', () => ({
  __esModule: true,
  default: {
    language: 'en',
    t: (key: string) => key,
  },
}));

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
  getForegroundPermissionsAsync: (...args: unknown[]) => mockGetForegroundPermissionsAsync(...args),
  getBackgroundPermissionsAsync: (...args: unknown[]) => mockGetBackgroundPermissionsAsync(...args),
  hasStartedGeofencingAsync: (...args: unknown[]) => mockHasStartedGeofencingAsync(...args),
  startGeofencingAsync: (...args: unknown[]) => mockStartGeofencingAsync(...args),
  stopGeofencingAsync: (...args: unknown[]) => mockStopGeofencingAsync(...args),
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...args: unknown[]) => mockNotificationsGetPermissionsAsync(...args),
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
}));

jest.mock('../services/database', () => ({
  getAllNotes: (...args: unknown[]) => mockGetAllNotes(...args),
}));

import { clearGeofenceRegions, syncGeofenceRegions } from '../services/geofenceService';

beforeEach(() => {
  mockStorage.clear();
  jest.clearAllMocks();

  mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockGetBackgroundPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true });
  mockNotificationsGetPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true });
  mockHasStartedGeofencingAsync.mockResolvedValue(false);
  mockStartGeofencingAsync.mockResolvedValue(undefined);
  mockStopGeofencingAsync.mockResolvedValue(undefined);
  mockGetAllNotes.mockResolvedValue([
    {
      id: 'note-1',
      latitude: 10.7626,
      longitude: 106.6601,
      radius: 150,
    },
    {
      id: 'note-2',
      latitude: 10.765,
      longitude: 106.665,
      radius: 150,
    },
  ]);
});

describe('geofenceService', () => {
  it('returns false when reminders are not enabled', async () => {
    mockGetBackgroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: true });

    const result = await syncGeofenceRegions();
    expect(result).toBe(false);
    expect(mockStartGeofencingAsync).not.toHaveBeenCalled();
  });

  it('starts geofencing and stores signature when enabled', async () => {
    const result = await syncGeofenceRegions();
    expect(result).toBe(true);
    expect(mockStartGeofencingAsync).toHaveBeenCalledWith(
      'BACKGROUND_GEOFENCE_TASK',
      expect.arrayContaining([
        expect.objectContaining({ identifier: 'note-1' }),
        expect.objectContaining({ identifier: 'note-2' }),
      ])
    );
    expect(mockStorage.get('geofence.signature')).toBeTruthy();
  });

  it('does not restart geofencing when signature is unchanged', async () => {
    await syncGeofenceRegions();
    mockStartGeofencingAsync.mockClear();
    mockHasStartedGeofencingAsync.mockResolvedValue(true);

    const result = await syncGeofenceRegions();
    expect(result).toBe(true);
    expect(mockStartGeofencingAsync).not.toHaveBeenCalled();
  });

  it('clears started geofences and signature', async () => {
    mockStorage.set('geofence.signature', 'old');
    mockHasStartedGeofencingAsync.mockResolvedValue(true);

    await clearGeofenceRegions();
    expect(mockStopGeofencingAsync).toHaveBeenCalledWith('BACKGROUND_GEOFENCE_TASK');
    expect(mockStorage.has('geofence.signature')).toBe(false);
  });
});

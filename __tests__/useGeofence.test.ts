import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useGeofence } from '../hooks/useGeofence';

const mockGetForegroundPermissionsAsync = jest.fn();
const mockRequestForegroundPermissionsAsync = jest.fn();
const mockGetBackgroundPermissionsAsync = jest.fn();
const mockRequestBackgroundPermissionsAsync = jest.fn();
const mockHasServicesEnabledAsync = jest.fn();
const mockGetLastKnownPositionAsync = jest.fn();
const mockGetCurrentPositionAsync = jest.fn();

const mockNotificationsGetPermissionsAsync = jest.fn();
const mockNotificationsRequestPermissionsAsync = jest.fn();
const mockSyncGeofenceRegions = jest.fn();
const mockGetReminderPermissionState = jest.fn();
const mockSyncSocialPushRegistration = jest.fn();
const mockArePlaceRemindersEnabled = jest.fn();

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: (...args: unknown[]) => mockGetForegroundPermissionsAsync(...args),
  requestForegroundPermissionsAsync: (...args: unknown[]) => mockRequestForegroundPermissionsAsync(...args),
  getBackgroundPermissionsAsync: (...args: unknown[]) => mockGetBackgroundPermissionsAsync(...args),
  requestBackgroundPermissionsAsync: (...args: unknown[]) => mockRequestBackgroundPermissionsAsync(...args),
  hasServicesEnabledAsync: (...args: unknown[]) => mockHasServicesEnabledAsync(...args),
  getLastKnownPositionAsync: (...args: unknown[]) => mockGetLastKnownPositionAsync(...args),
  getCurrentPositionAsync: (...args: unknown[]) => mockGetCurrentPositionAsync(...args),
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...args: unknown[]) => mockNotificationsGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockNotificationsRequestPermissionsAsync(...args),
}));

jest.mock('../services/geofenceService', () => ({
  syncGeofenceRegions: (...args: unknown[]) => mockSyncGeofenceRegions(...args),
  getReminderPermissionState: (...args: unknown[]) => mockGetReminderPermissionState(...args),
  arePlaceRemindersEnabled: (...args: unknown[]) => mockArePlaceRemindersEnabled(...args),
}));

jest.mock('../services/socialPushService', () => ({
  syncSocialPushRegistration: (...args: unknown[]) => mockSyncSocialPushRegistration(...args),
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      uid: 'user-1',
    },
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: true });
  mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: true });
  mockGetBackgroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: true });
  mockRequestBackgroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: true });
  mockHasServicesEnabledAsync.mockResolvedValue(true);
  mockGetLastKnownPositionAsync.mockResolvedValue(null);
  mockGetCurrentPositionAsync.mockResolvedValue(null);
  mockNotificationsGetPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: true });
  mockNotificationsRequestPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: true });
  mockGetReminderPermissionState.mockResolvedValue({
    foregroundGranted: false,
    remindersEnabled: false,
  });
  mockSyncGeofenceRegions.mockResolvedValue(true);
  mockSyncSocialPushRegistration.mockResolvedValue(undefined);
  mockArePlaceRemindersEnabled.mockReturnValue(true);
});

describe('useGeofence', () => {
  it('does not auto-request location permission on mount', async () => {
    renderHook(() => useGeofence());

    await waitFor(() => {
      expect(mockGetForegroundPermissionsAsync).toHaveBeenCalled();
      expect(mockGetReminderPermissionState).toHaveBeenCalled();
    });

    expect(mockRequestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns requiresSettings when foreground permission is permanently denied', async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false });
    mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false });

    const { result } = renderHook(() => useGeofence());

    await act(async () => {
      const response = await result.current.requestForegroundLocation();
      expect(response.location).toBeNull();
      expect(response.requiresSettings).toBe(true);
    });
  });

  it('returns requiresSettings when location services are disabled', async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true });
    mockHasServicesEnabledAsync.mockResolvedValue(false);

    const { result } = renderHook(() => useGeofence());

    await act(async () => {
      const response = await result.current.requestForegroundLocation();
      expect(response.location).toBeNull();
      expect(response.requiresSettings).toBe(true);
    });

    expect(mockGetCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('enables reminders and syncs geofences when all permissions are granted', async () => {
    const location = {
      coords: { latitude: 10.7626, longitude: 106.6601 },
    };
    mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true });
    mockGetBackgroundPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true });
    mockNotificationsGetPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true });
    mockGetLastKnownPositionAsync.mockResolvedValue(location);
    mockGetReminderPermissionState.mockResolvedValue({
      foregroundGranted: true,
      remindersEnabled: false,
    });

    const { result } = renderHook(() => useGeofence());

    await act(async () => {
      const permissionResult = await result.current.requestReminderPermissions();
      expect(permissionResult.enabled).toBe(true);
      expect(permissionResult.requiresSettings).toBe(false);
    });

    expect(mockSyncGeofenceRegions).toHaveBeenCalled();
    expect(mockSyncSocialPushRegistration).toHaveBeenCalledWith({
      uid: 'user-1',
    });
  });

  it('can enable reminders without a live location fix', async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true });
    mockGetBackgroundPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true });
    mockNotificationsGetPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true });
    mockGetLastKnownPositionAsync.mockResolvedValue(null);
    mockGetCurrentPositionAsync.mockResolvedValue(null);
    mockGetReminderPermissionState.mockResolvedValue({
      foregroundGranted: true,
      remindersEnabled: false,
    });

    const { result } = renderHook(() => useGeofence());

    await act(async () => {
      const permissionResult = await result.current.requestReminderPermissions();
      expect(permissionResult.enabled).toBe(true);
      expect(permissionResult.requiresSettings).toBe(false);
    });

    expect(mockSyncGeofenceRegions).toHaveBeenCalled();
  });

  it('skips reminder flows entirely when place reminders are disabled in config', async () => {
    mockArePlaceRemindersEnabled.mockReturnValue(false);

    const { result } = renderHook(() => useGeofence());

    await act(async () => {
      const permissionResult = await result.current.requestReminderPermissions();
      expect(permissionResult).toEqual({
        enabled: false,
        requiresSettings: false,
      });
    });

    expect(mockRequestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(mockRequestBackgroundPermissionsAsync).not.toHaveBeenCalled();
    expect(mockNotificationsRequestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockSyncGeofenceRegions).not.toHaveBeenCalled();
  });
});

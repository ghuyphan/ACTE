import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ReactNode } from 'react';
import { useAppStartupBootstrap } from '../hooks/app/useAppStartupBootstrap';

const mockGetDB = jest.fn();
const mockResetLocalDatabase = jest.fn();
const mockConfigureForegroundNotificationPresentation = jest.fn();
const mockConfigureNotificationChannels = jest.fn();
const mockSyncGeofenceRegions = jest.fn();
const mockArePlaceRemindersEnabled = jest.fn();
const mockRunMediaCacheEviction = jest.fn();
const mockScheduleOnIdle = jest.fn();
const mockGetCachedStartupRoute = jest.fn();
const mockLoadStartupRoute = jest.fn();
const mockRegisterSocialPushBackgroundTaskAsync = jest.fn();

jest.mock('../services/database', () => ({
  getDB: () => mockGetDB(),
  resetLocalDatabase: (...args: unknown[]) => mockResetLocalDatabase(...args),
}));

jest.mock('../services/geofenceService', () => ({
  arePlaceRemindersEnabled: (...args: unknown[]) => mockArePlaceRemindersEnabled(...args),
  syncGeofenceRegions: (...args: unknown[]) => mockSyncGeofenceRegions(...args),
}));

jest.mock('../services/mediaCacheManager', () => ({
  runMediaCacheEviction: (...args: unknown[]) => mockRunMediaCacheEviction(...args),
}));

jest.mock('../services/notificationService', () => ({
  configureForegroundNotificationPresentation: (...args: unknown[]) =>
    mockConfigureForegroundNotificationPresentation(...args),
  configureNotificationChannels: (...args: unknown[]) => mockConfigureNotificationChannels(...args),
}));

jest.mock('../constants/i18n', () => ({
  i18nReady: Promise.resolve(),
}));

jest.mock('../services/startupRouting', () => ({
  getCachedStartupRoute: (...args: unknown[]) => mockGetCachedStartupRoute(...args),
  loadStartupRoute: (...args: unknown[]) => mockLoadStartupRoute(...args),
}));

jest.mock('../utils/backgroundSocialPush', () => ({
  registerSocialPushBackgroundTaskAsync: (...args: unknown[]) =>
    mockRegisterSocialPushBackgroundTaskAsync(...args),
}));

jest.mock('../utils/scheduleOnIdle', () => ({
  scheduleOnIdle: (...args: unknown[]) => mockScheduleOnIdle(...args),
}));

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function wrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();

  mockGetCachedStartupRoute.mockReturnValue(null);
  mockLoadStartupRoute.mockResolvedValue('/(tabs)');
  mockResetLocalDatabase.mockResolvedValue(undefined);
  mockScheduleOnIdle.mockImplementation((callback: () => void) => {
    callback();
    return { cancel: jest.fn() };
  });
  mockGetDB.mockResolvedValue({});
  mockConfigureForegroundNotificationPresentation.mockImplementation(() => undefined);
  mockConfigureNotificationChannels.mockResolvedValue(undefined);
  mockRegisterSocialPushBackgroundTaskAsync.mockResolvedValue(undefined);
  mockArePlaceRemindersEnabled.mockReturnValue(true);
  mockSyncGeofenceRegions.mockResolvedValue(undefined);
  mockRunMediaCacheEviction.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('useAppStartupBootstrap', () => {
  it('waits for the database before scheduling startup work and resolves the startup route', async () => {
    const deferredDb = createDeferred<unknown>();
    mockGetDB.mockReturnValueOnce(deferredDb.promise);

    const { result } = renderHook(() => useAppStartupBootstrap(), { wrapper });

    await waitFor(() => {
      expect(mockConfigureNotificationChannels).toHaveBeenCalledTimes(1);
    });

    expect(mockRegisterSocialPushBackgroundTaskAsync).toHaveBeenCalledTimes(1);
    expect(mockConfigureNotificationChannels).toHaveBeenCalledTimes(1);
    expect(mockSyncGeofenceRegions).not.toHaveBeenCalled();
    expect(mockRunMediaCacheEviction).not.toHaveBeenCalled();

    await act(async () => {
      deferredDb.resolve({});
      await deferredDb.promise;
    });

    await waitFor(() => {
      expect(result.current.isDatabaseReady).toBe(true);
      expect(result.current.isStartupRouteReady).toBe(true);
    });

    expect(mockLoadStartupRoute).toHaveBeenCalledWith('entry');

    await waitFor(() => {
      expect(mockScheduleOnIdle).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(mockSyncGeofenceRegions).toHaveBeenCalledTimes(1);
      expect(mockRunMediaCacheEviction).toHaveBeenCalledTimes(1);
    });
  });

  it('skips startup geofence sync when reminders are disabled', async () => {
    mockArePlaceRemindersEnabled.mockReturnValue(false);

    renderHook(() => useAppStartupBootstrap(), { wrapper });

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(mockRunMediaCacheEviction).toHaveBeenCalledTimes(1);
    });

    expect(mockSyncGeofenceRegions).not.toHaveBeenCalled();
  });

  it('surfaces a startup error when database initialization fails', async () => {
    mockGetDB.mockRejectedValueOnce(new Error('db failed'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAppStartupBootstrap(), { wrapper });

    await waitFor(() => {
      expect(result.current.startupError).toBe('database-init-failed');
      expect(result.current.isDatabaseReady).toBe(false);
    });

    consoleErrorSpy.mockRestore();
  });

  it('retries database initialization on demand', async () => {
    mockGetDB.mockRejectedValueOnce(new Error('db failed'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAppStartupBootstrap(), { wrapper });

    await waitFor(() => {
      expect(result.current.startupError).toBe('database-init-failed');
      expect(result.current.isDatabaseReady).toBe(false);
    });

    mockGetDB.mockResolvedValueOnce({});

    await act(async () => {
      result.current.retryStartup();
    });

    await waitFor(() => {
      expect(result.current.startupError).toBeNull();
      expect(result.current.isDatabaseReady).toBe(true);
    });

    expect(mockGetDB).toHaveBeenCalledTimes(2);
    consoleErrorSpy.mockRestore();
  });

  it('resets local data before retrying startup', async () => {
    mockGetDB.mockRejectedValueOnce(new Error('db failed'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAppStartupBootstrap(), { wrapper });

    await waitFor(() => {
      expect(result.current.startupError).toBe('database-init-failed');
      expect(result.current.isDatabaseReady).toBe(false);
    });

    mockGetDB.mockResolvedValueOnce({});

    await act(async () => {
      await result.current.resetStartupData();
    });

    expect(mockResetLocalDatabase).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(result.current.startupError).toBeNull();
      expect(result.current.isDatabaseReady).toBe(true);
    });

    consoleErrorSpy.mockRestore();
  });
});

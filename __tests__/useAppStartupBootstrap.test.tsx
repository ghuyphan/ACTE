import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ReactNode } from 'react';
import { useAppStartupBootstrap } from '../hooks/app/useAppStartupBootstrap';

const mockGetDB = jest.fn();
const mockConfigureNotificationChannels = jest.fn();
const mockSyncGeofenceRegions = jest.fn();
const mockRunMediaCacheEviction = jest.fn();
const mockScheduleOnIdle = jest.fn();
const mockGetInitialURL = jest.fn();
const mockGetCachedStartupRoute = jest.fn();
const mockLoadStartupRoute = jest.fn();

jest.mock('expo-linking', () => ({
  getInitialURL: () => mockGetInitialURL(),
}));

jest.mock('../services/database', () => ({
  getDB: () => mockGetDB(),
}));

jest.mock('../services/geofenceService', () => ({
  syncGeofenceRegions: (...args: unknown[]) => mockSyncGeofenceRegions(...args),
}));

jest.mock('../services/mediaCacheManager', () => ({
  runMediaCacheEviction: (...args: unknown[]) => mockRunMediaCacheEviction(...args),
}));

jest.mock('../services/notificationService', () => ({
  configureNotificationChannels: (...args: unknown[]) => mockConfigureNotificationChannels(...args),
}));

jest.mock('../services/startupRouting', () => ({
  getCachedStartupRoute: (...args: unknown[]) => mockGetCachedStartupRoute(...args),
  loadStartupRoute: (...args: unknown[]) => mockLoadStartupRoute(...args),
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

  mockGetInitialURL.mockResolvedValue(null);
  mockGetCachedStartupRoute.mockReturnValue(null);
  mockLoadStartupRoute.mockResolvedValue('/(tabs)');
  mockScheduleOnIdle.mockImplementation((callback: () => void) => {
    callback();
    return { cancel: jest.fn() };
  });
  mockGetDB.mockResolvedValue({});
  mockConfigureNotificationChannels.mockResolvedValue(undefined);
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

    expect(mockConfigureNotificationChannels).toHaveBeenCalledTimes(1);
    expect(mockSyncGeofenceRegions).not.toHaveBeenCalled();
    expect(mockRunMediaCacheEviction).not.toHaveBeenCalled();
    expect(result.current.initialUrlResolved).toBe(false);

    deferredDb.resolve({});

    await waitFor(() => {
      expect(result.current.initialUrlResolved).toBe(true);
      expect(result.current.startupTarget).toBe('/(tabs)');
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
});

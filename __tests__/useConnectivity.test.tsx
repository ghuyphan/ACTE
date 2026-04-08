import { renderHook, waitFor, act } from '@testing-library/react-native';
import { AppState, AppStateStatus } from 'react-native';
import { ReactNode } from 'react';
import { ConnectivityProvider, useConnectivity } from '../hooks/useConnectivity';

const mockConfigure = jest.fn();
const mockRefresh = jest.fn();
const mockFetch = jest.fn();

let appStateListener: ((state: AppStateStatus) => void) | null = null;

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    configure: (...args: unknown[]) => mockConfigure(...args),
    refresh: (...args: unknown[]) => mockRefresh(...args),
    fetch: (...args: unknown[]) => mockFetch(...args),
    addEventListener: () => jest.fn(),
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  return <ConnectivityProvider>{children}</ConnectivityProvider>;
}

describe('useConnectivity', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockConfigure.mockImplementation(() => undefined);
    mockRefresh.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
    mockFetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener: (state: AppStateStatus) => void) => {
      appStateListener = listener;
      return {
        remove: jest.fn(),
      };
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    appStateListener = null;
  });

  it('refreshes on mount and app foreground', async () => {
    const { result } = renderHook(() => useConnectivity(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe('online');
      expect(mockConfigure).toHaveBeenCalledTimes(1);
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      appStateListener?.('active');
    });

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalledTimes(2);
    });
  });
});

import { renderHook, waitFor, act } from '@testing-library/react-native';
import { AppState, AppStateStatus } from 'react-native';
import { useAppWidgetRefresh } from '../hooks/app/useAppWidgetRefresh';

const mockScheduleWidgetDataUpdate = jest.fn();
const mockUseAuth = jest.fn();
const mockUseConnectivity = jest.fn();

let appStateListener: ((state: AppStateStatus) => void) | null = null;

jest.mock('../services/widgetService', () => ({
  scheduleWidgetDataUpdate: (...args: unknown[]) => mockScheduleWidgetDataUpdate(...args),
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../hooks/useConnectivity', () => ({
  useConnectivity: () => mockUseConnectivity(),
}));

describe('useAppWidgetRefresh', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null });
    mockUseConnectivity.mockReturnValue({ isOnline: false });
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

  it('does a lightweight startup refresh and a richer refresh on foreground', async () => {
    const { rerender } = renderHook(() => useAppWidgetRefresh(), { initialProps: {} });

    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    await waitFor(() => {
      expect(mockScheduleWidgetDataUpdate).toHaveBeenCalledTimes(1);
      expect(mockScheduleWidgetDataUpdate).toHaveBeenLastCalledWith(
        {
          includeLocationLookup: false,
          includeSharedRefresh: false,
        },
        {
          debounceMs: 120,
          throttleKey: undefined,
          throttleMs: undefined,
        }
      );
    });

    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' } });
    mockUseConnectivity.mockReturnValue({ isOnline: true });
    rerender({});

    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    await waitFor(() => {
      expect(mockScheduleWidgetDataUpdate).toHaveBeenCalledTimes(2);
      expect(mockScheduleWidgetDataUpdate).toHaveBeenNthCalledWith(
        2,
        {
          includeLocationLookup: false,
          includeSharedRefresh: true,
        },
        {
          debounceMs: 120,
          throttleKey: undefined,
          throttleMs: undefined,
        }
      );
    });

    await act(async () => {
      appStateListener?.('active');
      jest.runOnlyPendingTimers();
    });

    await waitFor(() => {
      expect(mockScheduleWidgetDataUpdate).toHaveBeenCalledTimes(3);
      expect(mockScheduleWidgetDataUpdate).toHaveBeenNthCalledWith(
        3,
        {
          includeLocationLookup: true,
          includeSharedRefresh: true,
        },
        {
          debounceMs: 120,
          throttleKey: 'foreground',
          throttleMs: 60_000,
        }
      );
    });
  });

  it('waits until enabled before triggering the startup refresh', async () => {
    const { rerender } = renderHook(
      (props) => useAppWidgetRefresh({ enabled: (props as { enabled: boolean }).enabled }),
      { initialProps: { enabled: false } }
    );

    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    expect(mockScheduleWidgetDataUpdate).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    await waitFor(() => {
      expect(mockScheduleWidgetDataUpdate).toHaveBeenCalledTimes(1);
      expect(mockScheduleWidgetDataUpdate).toHaveBeenLastCalledWith(
        {
          includeLocationLookup: false,
          includeSharedRefresh: false,
        },
        {
          debounceMs: 120,
          throttleKey: undefined,
          throttleMs: undefined,
        }
      );
    });
  });

  it('requests throttled scheduling for repeated foreground refreshes', async () => {
    renderHook(() => useAppWidgetRefresh(), { initialProps: {} });

    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    await act(async () => {
      appStateListener?.('active');
      appStateListener?.('active');
      jest.runOnlyPendingTimers();
    });

    expect(mockScheduleWidgetDataUpdate).toHaveBeenCalledTimes(3);
    expect(mockScheduleWidgetDataUpdate).toHaveBeenNthCalledWith(
      2,
      {
        includeLocationLookup: true,
        includeSharedRefresh: false,
      },
      {
        debounceMs: 120,
        throttleKey: 'foreground',
        throttleMs: 60_000,
      }
    );
  });
});

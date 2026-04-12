import { renderHook, waitFor, act } from '@testing-library/react-native';
import { AppState, AppStateStatus } from 'react-native';
import { useAppWidgetRefresh } from '../hooks/app/useAppWidgetRefresh';

const mockUpdateWidgetData = jest.fn();
const mockUseAuth = jest.fn();
const mockUseConnectivity = jest.fn();

let appStateListener: ((state: AppStateStatus) => void) | null = null;

jest.mock('../services/widgetService', () => ({
  updateWidgetData: (...args: unknown[]) => mockUpdateWidgetData(...args),
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
    mockUpdateWidgetData.mockResolvedValue(undefined);
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
      jest.advanceTimersByTime(120);
    });

    await waitFor(() => {
      expect(mockUpdateWidgetData).toHaveBeenCalledTimes(1);
      expect(mockUpdateWidgetData).toHaveBeenLastCalledWith({
        includeLocationLookup: false,
        includeSharedRefresh: false,
      });
    });

    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' } });
    mockUseConnectivity.mockReturnValue({ isOnline: true });
    rerender({});

    await act(async () => {
      appStateListener?.('active');
      jest.advanceTimersByTime(120);
    });

    await waitFor(() => {
      expect(mockUpdateWidgetData).toHaveBeenCalledTimes(2);
      expect(mockUpdateWidgetData).toHaveBeenLastCalledWith({
        includeLocationLookup: true,
        includeSharedRefresh: true,
      });
    });
  });

  it('throttles repeated foreground refreshes', async () => {
    renderHook(() => useAppWidgetRefresh(), { initialProps: {} });

    await act(async () => {
      jest.advanceTimersByTime(120);
    });

    await act(async () => {
      appStateListener?.('active');
      jest.advanceTimersByTime(120);
      appStateListener?.('active');
      jest.advanceTimersByTime(120);
    });

    expect(mockUpdateWidgetData).toHaveBeenCalledTimes(2);
  });
});

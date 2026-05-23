import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAppUpdatePrompt } from '../hooks/app/useAppUpdatePrompt';

let mockIsEnabled = true;
let mockIsUpdatePending = false;
const mockCheckForUpdateAsync = jest.fn();
const mockFetchUpdateAsync = jest.fn();
const mockReloadAsync = jest.fn();

jest.mock('expo-updates', () => ({
  get isEnabled() {
    return mockIsEnabled;
  },
  checkForUpdateAsync: (...args: unknown[]) => mockCheckForUpdateAsync(...args),
  fetchUpdateAsync: (...args: unknown[]) => mockFetchUpdateAsync(...args),
  reloadAsync: (...args: unknown[]) => mockReloadAsync(...args),
  useUpdates: () => ({
    isUpdatePending: mockIsUpdatePending,
  }),
}));

describe('useAppUpdatePrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsEnabled = true;
    mockIsUpdatePending = false;
    mockCheckForUpdateAsync.mockResolvedValue({ isAvailable: true });
    mockFetchUpdateAsync.mockResolvedValue({ isNew: true });
    mockReloadAsync.mockResolvedValue(undefined);
  });

  it('shows an update that expo-updates already downloaded on app launch', async () => {
    mockIsUpdatePending = true;

    const { result } = renderHook(() => useAppUpdatePrompt());

    await waitFor(() => {
      expect(result.current.isUpdateReady).toBe(true);
    });

    expect(mockCheckForUpdateAsync).not.toHaveBeenCalled();
    expect(mockFetchUpdateAsync).not.toHaveBeenCalled();
  });

  it('downloads an available update and marks it ready for restart', async () => {
    const { result } = renderHook(() => useAppUpdatePrompt());

    await waitFor(() => {
      expect(result.current.isUpdateReady).toBe(true);
    });

    expect(mockCheckForUpdateAsync).toHaveBeenCalledTimes(1);
    expect(mockFetchUpdateAsync).toHaveBeenCalledTimes(1);
  });

  it('waits until enabled before checking for updates', async () => {
    const { rerender, result } = renderHook(
      ({ enabled }: { enabled: boolean }) => useAppUpdatePrompt({ enabled }),
      { initialProps: { enabled: false } }
    );

    expect(mockCheckForUpdateAsync).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.isUpdateReady).toBe(true);
    });

    expect(mockCheckForUpdateAsync).toHaveBeenCalledTimes(1);
  });

  it('does not show the prompt when updates are disabled or unavailable', async () => {
    mockIsEnabled = false;

    const { result, unmount } = renderHook(() => useAppUpdatePrompt());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isUpdateReady).toBe(false);
    expect(mockCheckForUpdateAsync).not.toHaveBeenCalled();

    unmount();

    mockIsEnabled = true;
    mockCheckForUpdateAsync.mockResolvedValueOnce({ isAvailable: false });

    const unavailable = renderHook(() => useAppUpdatePrompt());

    await waitFor(() => {
      expect(mockCheckForUpdateAsync).toHaveBeenCalledTimes(1);
    });

    expect(unavailable.result.current.isUpdateReady).toBe(false);
    expect(mockFetchUpdateAsync).not.toHaveBeenCalled();
  });

  it('dismisses a ready update for the current session', async () => {
    const { result } = renderHook(() => useAppUpdatePrompt());

    await waitFor(() => {
      expect(result.current.isUpdateReady).toBe(true);
    });

    act(() => {
      result.current.dismissUpdate();
    });

    expect(result.current.isUpdateReady).toBe(false);
  });

  it('reloads the app when the user accepts the update', async () => {
    const { result } = renderHook(() => useAppUpdatePrompt());

    await waitFor(() => {
      expect(result.current.isUpdateReady).toBe(true);
    });

    await act(async () => {
      await result.current.restartForUpdate();
    });

    expect(mockReloadAsync).toHaveBeenCalledTimes(1);
  });
});

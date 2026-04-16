import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAppSplashGate } from '../hooks/app/useAppSplashGate';

const mockHideAsync = jest.fn(async () => undefined);

jest.mock('expo-router', () => ({
  SplashScreen: {
    hideAsync: () => mockHideAsync(),
  },
}));

jest.mock('../constants/i18n', () => ({
  hasInitializedI18n: () => false,
  i18nReady: Promise.resolve(),
}));

describe('useAppSplashGate', () => {
  const originalRequestAnimationFrame = global.requestAnimationFrame;

  beforeEach(() => {
    jest.clearAllMocks();
    global.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    }) as typeof requestAnimationFrame;
  });

  afterEach(() => {
    global.requestAnimationFrame = originalRequestAnimationFrame;
  });

  it('waits for route, database, theme, and i18n readiness before hiding the splash', async () => {
    const { rerender } = renderHook(
      (props: Parameters<typeof useAppSplashGate>[0]) => useAppSplashGate(props),
      {
        initialProps: {
          authReady: false,
          isDatabaseReady: false,
          isStartupRouteReady: false,
          notesReady: false,
          startupError: null,
          themeReady: false,
        },
      }
    );

    await act(async () => undefined);
    expect(mockHideAsync).not.toHaveBeenCalled();

    rerender({
      authReady: true,
      isDatabaseReady: true,
      isStartupRouteReady: true,
      notesReady: true,
      startupError: null,
      themeReady: true,
    });

    await waitFor(() => {
      expect(mockHideAsync).toHaveBeenCalledTimes(1);
    });
  });

  it('allows the startup error screen to replace the splash without waiting for note hydration', async () => {
    renderHook(() =>
      useAppSplashGate({
        authReady: true,
        isDatabaseReady: false,
        isStartupRouteReady: true,
        notesReady: false,
        startupError: 'database-init-failed',
        themeReady: true,
      })
    );

    await waitFor(() => {
      expect(mockHideAsync).toHaveBeenCalledTimes(1);
    });
  });
});

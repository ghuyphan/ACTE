import { act, renderHook } from '@testing-library/react-native';
import {
  HOME_INITIAL_SHARED_FEED_WAIT_MS,
  useHomeInitialFeedGate,
} from '../hooks/app/useHomeInitialFeedGate';

jest.mock('../utils/startupTrace', () => ({
  logStartupEvent: jest.fn(),
}));

describe('useHomeInitialFeedGate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('releases immediately once notes and shared cache or live data are ready', () => {
    const { result } = renderHook(() =>
      useHomeInitialFeedGate({
        userUid: 'user-1',
        notesPhase: 'hydrating',
        sharedEnabled: true,
        sharedPhase: 'cache-ready',
      })
    );

    expect(result.current.ready).toBe(true);
    expect(result.current.pending).toBe(false);
    expect(result.current.timedOut).toBe(false);
  });

  it('waits briefly for shared feed readiness after notes reach their first usable page', () => {
    const { result } = renderHook(() =>
      useHomeInitialFeedGate({
        userUid: 'user-1',
        notesPhase: 'hydrating',
        sharedEnabled: true,
        sharedPhase: 'bootstrapping',
      })
    );

    expect(result.current.ready).toBe(false);
    expect(result.current.pending).toBe(true);

    act(() => {
      jest.advanceTimersByTime(HOME_INITIAL_SHARED_FEED_WAIT_MS - 1);
    });

    expect(result.current.ready).toBe(false);

    act(() => {
      jest.advanceTimersByTime(1);
    });

    expect(result.current.ready).toBe(true);
    expect(result.current.pending).toBe(false);
    expect(result.current.timedOut).toBe(true);
  });

  it('does not wait for shared feed when the user is signed out', () => {
    const { result } = renderHook(() =>
      useHomeInitialFeedGate({
        userUid: null,
        notesPhase: 'hydrating',
        sharedEnabled: false,
        sharedPhase: 'bootstrapping',
      })
    );

    expect(result.current.ready).toBe(true);
    expect(result.current.pending).toBe(false);
  });

  it('starts a fresh wait window when the active user changes', () => {
    const { result, rerender } = renderHook(
      (userUid: string) =>
        useHomeInitialFeedGate({
          userUid,
          notesPhase: 'hydrating',
          sharedEnabled: true,
          sharedPhase: 'bootstrapping',
        }),
      {
        initialProps: 'user-1',
      }
    );

    act(() => {
      jest.advanceTimersByTime(HOME_INITIAL_SHARED_FEED_WAIT_MS);
    });

    expect(result.current.ready).toBe(true);
    expect(result.current.timedOut).toBe(true);

    rerender('user-2');

    expect(result.current.ready).toBe(false);
    expect(result.current.pending).toBe(true);
    expect(result.current.timedOut).toBe(false);
  });
});

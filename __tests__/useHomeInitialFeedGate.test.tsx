import { renderHook } from '@testing-library/react-native';
import { useHomeInitialFeedGate } from '../hooks/app/useHomeInitialFeedGate';

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

  it('releases immediately once notes have a usable staged page', () => {
    const { result } = renderHook(() =>
      useHomeInitialFeedGate({
        userUid: 'user-1',
        notesCount: 1,
        notesPhase: 'hydrating',
      })
    );

    expect(result.current.ready).toBe(true);
    expect(result.current.pending).toBe(false);
  });

  it('does not wait for shared feed bootstrapping after notes reach their first usable page', () => {
    const { result } = renderHook(() =>
      useHomeInitialFeedGate({
        userUid: 'user-1',
        notesCount: 1,
        notesPhase: 'hydrating',
      })
    );

    expect(result.current.ready).toBe(true);
    expect(result.current.pending).toBe(false);
  });

  it('does not wait for shared feed when the user is signed out', () => {
    const { result } = renderHook(() =>
      useHomeInitialFeedGate({
        userUid: null,
        notesPhase: 'ready',
      })
    );

    expect(result.current.ready).toBe(true);
    expect(result.current.pending).toBe(false);
  });

  it('stays ready across user changes when notes are already usable', () => {
    const { result, rerender } = renderHook(
      (userUid: string) =>
        useHomeInitialFeedGate({
          userUid,
          notesCount: 1,
          notesPhase: 'hydrating',
        }),
      {
        initialProps: 'user-1',
      }
    );

    expect(result.current.ready).toBe(true);

    rerender('user-2');

    expect(result.current.ready).toBe(true);
    expect(result.current.pending).toBe(false);
  });

  it('keeps an empty staged notes load gated until hydration finishes', () => {
    const { result, rerender } = renderHook(
      (notesPhase: 'hydrating' | 'ready') =>
        useHomeInitialFeedGate({
          userUid: 'user-1',
          notesCount: 0,
          notesPhase,
        }),
      {
        initialProps: 'hydrating',
      }
    );

    expect(result.current.ready).toBe(false);
    expect(result.current.pending).toBe(true);

    rerender('ready');

    expect(result.current.ready).toBe(true);
    expect(result.current.pending).toBe(false);
  });
});

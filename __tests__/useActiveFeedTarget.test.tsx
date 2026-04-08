import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ReactNode } from 'react';
import { ActiveFeedTargetProvider, useActiveFeedTarget } from '../hooks/useActiveFeedTarget';

const wrapper = ({ children }: { children: ReactNode }) => (
  <ActiveFeedTargetProvider>{children}</ActiveFeedTargetProvider>
);

describe('useActiveFeedTarget', () => {
  it('stores and clears the active feed target without forcing rerenders', async () => {
    const hook = renderHook(() => useActiveFeedTarget(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.peekActiveFeedTarget()).toBeNull();
    });

    act(() => {
      hook.result.current.setActiveFeedTarget({ kind: 'note', id: 'note-1' });
    });

    expect(hook.result.current.peekActiveFeedTarget()).toEqual({
      kind: 'note',
      id: 'note-1',
    });

    act(() => {
      hook.result.current.clearActiveFeedTarget();
    });

    expect(hook.result.current.peekActiveFeedTarget()).toBeNull();
  });
});

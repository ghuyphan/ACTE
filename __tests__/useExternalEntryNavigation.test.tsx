import { act, renderHook } from '@testing-library/react-native';
import { useExternalEntryNavigation } from '../hooks/app/useExternalEntryNavigation';

const mockDismissTo = jest.fn();
const mockRequestFeedFocus = jest.fn();
const mockCloseNoteDetail = jest.fn();
const mockPeekActiveFeedTarget = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    dismissTo: (...args: unknown[]) => mockDismissTo(...args),
  }),
}));

jest.mock('../hooks/useActiveFeedTarget', () => ({
  useActiveFeedTarget: () => ({
    peekActiveFeedTarget: (...args: unknown[]) => mockPeekActiveFeedTarget(...args),
  }),
}));

jest.mock('../hooks/useFeedFocus', () => ({
  useFeedFocus: () => ({
    requestFeedFocus: (...args: unknown[]) => mockRequestFeedFocus(...args),
  }),
}));

jest.mock('../hooks/useNoteDetailSheet', () => ({
  useNoteDetailSheet: () => ({
    closeNoteDetail: (...args: unknown[]) => mockCloseNoteDetail(...args),
  }),
}));

describe('useExternalEntryNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPeekActiveFeedTarget.mockReturnValue(null);
  });

  it('returns to the tabs route when the user is not already on Home', () => {
    const { result } = renderHook(() => useExternalEntryNavigation());

    act(() => {
      result.current.focusFeedTargetFromExternalEntry({ kind: 'note', id: 'note-42' });
    });

    expect(mockCloseNoteDetail).toHaveBeenCalledTimes(1);
    expect(mockRequestFeedFocus).toHaveBeenCalledWith({ kind: 'note', id: 'note-42' });
    expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)');
  });

  it('stays on Home when the widget target is already the active card', () => {
    mockPeekActiveFeedTarget.mockReturnValue({ kind: 'note', id: 'note-42' });

    const { result } = renderHook(() => useExternalEntryNavigation());

    act(() => {
      result.current.focusFeedTargetFromExternalEntry({ kind: 'note', id: 'note-42' });
    });

    expect(mockCloseNoteDetail).toHaveBeenCalledTimes(1);
    expect(mockRequestFeedFocus).not.toHaveBeenCalled();
    expect(mockDismissTo).not.toHaveBeenCalled();
  });

  it('stays on Home and only updates feed focus when another card is active', () => {
    mockPeekActiveFeedTarget.mockReturnValue({ kind: 'note', id: 'note-7' });

    const { result } = renderHook(() => useExternalEntryNavigation());

    act(() => {
      result.current.focusFeedTargetFromExternalEntry({ kind: 'shared-post', id: 'shared-9' });
    });

    expect(mockCloseNoteDetail).toHaveBeenCalledTimes(1);
    expect(mockRequestFeedFocus).toHaveBeenCalledWith({ kind: 'shared-post', id: 'shared-9' });
    expect(mockDismissTo).not.toHaveBeenCalled();
  });
});

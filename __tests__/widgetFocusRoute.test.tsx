import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import WidgetFocusRoute from '../app/widget/[kind]/[id]';

const mockFocusFeedTargetFromExternalEntry = jest.fn();
const mockResetToHome = jest.fn();
const mockResolveFeedTarget = jest.fn();
let mockParams: { kind?: string; id?: string } = {};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: () => void | (() => void)) => {
    const cleanup = callback();
    return cleanup ?? undefined;
  },
}));

jest.mock('../hooks/app/useExternalEntryNavigation', () => ({
  useExternalEntryNavigation: () => ({
    focusFeedTargetFromExternalEntry: (...args: unknown[]) => mockFocusFeedTargetFromExternalEntry(...args),
    resetToHome: (...args: unknown[]) => mockResetToHome(...args),
  }),
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'me' },
  }),
}));

jest.mock('../services/feedTargetLookup', () => ({
  resolveFeedTarget: (...args: unknown[]) => mockResolveFeedTarget(...args),
}));

describe('WidgetFocusRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
  });

  it('focuses the resolved note target from a widget deep link', async () => {
    mockParams = { kind: 'note', id: 'note-42' };
    mockResolveFeedTarget.mockResolvedValue({ kind: 'note', id: 'note-42' });

    render(<WidgetFocusRoute />);

    await waitFor(() => {
      expect(mockResolveFeedTarget).toHaveBeenCalledWith(
        { kind: 'note', id: 'note-42' },
        { sharedCacheUserUid: 'me' }
      );
      expect(mockFocusFeedTargetFromExternalEntry).toHaveBeenCalledWith({
        kind: 'note',
        id: 'note-42',
      });
    });

    expect(mockResetToHome).not.toHaveBeenCalled();
  });

  it('falls back to Home when the widget target cannot be resolved', async () => {
    mockParams = { kind: 'shared-post', id: 'shared-missing' };
    mockResolveFeedTarget.mockResolvedValue(null);

    render(<WidgetFocusRoute />);

    await waitFor(() => {
      expect(mockResetToHome).toHaveBeenCalledTimes(1);
    });

    expect(mockFocusFeedTargetFromExternalEntry).not.toHaveBeenCalled();
  });
});

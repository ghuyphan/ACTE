import React from 'react';
import { render } from '@testing-library/react-native';
import WidgetFocusRoute from '../app/widget/[kind]/[id]';

const mockFocusFeedTargetFromExternalEntry = jest.fn();
const mockResetToHome = jest.fn();
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

describe('WidgetFocusRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
  });

  it('focuses a note target from a widget deep link immediately', () => {
    mockParams = { kind: 'note', id: 'note-42' };

    render(<WidgetFocusRoute />);

    expect(mockFocusFeedTargetFromExternalEntry).toHaveBeenCalledWith({
      kind: 'note',
      id: 'note-42',
    });
    expect(mockResetToHome).not.toHaveBeenCalled();
  });

  it('focuses a shared post target from a widget deep link immediately', () => {
    mockParams = { kind: 'shared-post', id: 'shared-42' };

    render(<WidgetFocusRoute />);

    expect(mockFocusFeedTargetFromExternalEntry).toHaveBeenCalledWith({
      kind: 'shared-post',
      id: 'shared-42',
    });
    expect(mockResetToHome).not.toHaveBeenCalled();
  });

  it('falls back to Home when the widget target kind is invalid', () => {
    mockParams = { kind: 'unknown', id: 'note-42' };

    render(<WidgetFocusRoute />);

    expect(mockResetToHome).toHaveBeenCalledTimes(1);
    expect(mockFocusFeedTargetFromExternalEntry).not.toHaveBeenCalled();
  });

  it('falls back to Home when the widget target id is missing', () => {
    mockParams = { kind: 'note' };

    render(<WidgetFocusRoute />);

    expect(mockResetToHome).toHaveBeenCalledTimes(1);
    expect(mockFocusFeedTargetFromExternalEntry).not.toHaveBeenCalled();
  });
});

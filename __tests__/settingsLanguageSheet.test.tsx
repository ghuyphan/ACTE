import React from 'react';
import { act, render } from '@testing-library/react-native';
import SettingsLanguageSheet from '../components/settings/SettingsLanguageSheet';
import SettingsLanguageSheetAndroid from '../components/settings/SettingsLanguageSheet.android';

const mockSetAppLanguage = jest.fn();
const mockSelectionSheetIOS = jest.fn();
const mockSelectionSheetAndroid = jest.fn();
const mockI18nState = {
  language: 'en-US',
  resolvedLanguage: 'en-US',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: mockI18nState,
  }),
}));

jest.mock('../constants/i18n', () => ({
  setAppLanguage: (...args: unknown[]) => mockSetAppLanguage(...args),
}));

jest.mock('../components/settings/SettingsSelectionSheetIOS', () => {
  return function MockSettingsSelectionSheetIOS(props: any) {
    mockSelectionSheetIOS(props);
    return null;
  };
});

jest.mock('../components/settings/SettingsSelectionSheet.android', () => {
  return function MockSettingsSelectionSheetAndroid(props: any) {
    mockSelectionSheetAndroid(props);
    return null;
  };
});

describe('Settings language sheets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockI18nState.language = 'en-US';
    mockI18nState.resolvedLanguage = 'en-US';
  });

  it('normalizes regional locales for the iOS selector', () => {
    render(<SettingsLanguageSheet />);

    expect(mockSelectionSheetIOS.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        selectedKey: 'en',
        options: [
          { key: 'en', label: 'English' },
          { key: 'vi', label: 'Tiếng Việt' },
        ],
      })
    );
  });

  it('normalizes regional locales for the Android selector and forwards selections', () => {
    mockI18nState.language = 'vi-VN';
    mockI18nState.resolvedLanguage = 'vi-VN';

    render(<SettingsLanguageSheetAndroid onClose={jest.fn()} />);

    const props = mockSelectionSheetAndroid.mock.calls[0]?.[0];
    expect(props.selectedKey).toBe('vi');

    act(() => {
      props.onSelect('en');
    });

    expect(mockSetAppLanguage).toHaveBeenCalledWith('en');
  });
});

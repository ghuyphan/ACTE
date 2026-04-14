import React from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import AppProviders from '../components/app/AppProviders';
import { showAppAlert } from '../utils/alert';

jest.mock('react-i18next', () => ({
  I18nextProvider: ({ children }: { children?: React.ReactNode }) => children ?? null,
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

jest.mock('../constants/i18n', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModalProvider: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

jest.mock('../hooks', () => {
  const React = require('react');
  const actualTheme = jest.requireActual('../hooks/useTheme');
  const passthrough = ({ children }: { children?: React.ReactNode }) => children ?? null;

  return {
    ThemeProvider: actualTheme.ThemeProvider,
    ActiveFeedTargetProvider: passthrough,
    ActiveNoteProvider: passthrough,
    AuthProvider: passthrough,
    ConnectivityProvider: passthrough,
    FeedFocusProvider: passthrough,
    HapticsProvider: passthrough,
    NoteDetailSheetProvider: passthrough,
    NotesProvider: passthrough,
    SharedFeedProvider: passthrough,
    SubscriptionProvider: passthrough,
    SyncStatusProvider: passthrough,
  };
});

jest.mock('../hooks/app/useHomeStartupReady', () => ({
  HomeStartupReadyProvider: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

jest.mock('../hooks/ui/useSavedNoteRevealUi', () => ({
  SavedNoteRevealUiProvider: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

jest.mock('../components/sheets/AppSheetAlert', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => {
    const React = require('react');
    const { Text } = require('react-native');
    const { useTheme } = require('../hooks/useTheme');
    const { colors } = useTheme();
    return React.createElement(Text, null, `${title}:${colors.text}`);
  },
}));

describe('AppProviders', () => {
  const originalPlatformOs = Platform.OS;

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatformOs,
    });
  });

  it('keeps android alerts inside the theme provider tree', async () => {
    const { getByText } = render(
      <AppProviders>
        <Text>App content</Text>
      </AppProviders>
    );

    expect(getByText('App content')).toBeTruthy();

    await act(async () => {
      showAppAlert('Theme-safe alert', 'Message');
    });

    await waitFor(() => {
      expect(getByText(/Theme-safe alert:/)).toBeTruthy();
    });
  });
});

import React from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import AppProviders from '../components/app/AppProviders';
import { showAppAlert } from '../utils/alert';

const mockRenderedProviders: string[] = [];

jest.mock('react-i18next', () => ({
  I18nextProvider: ({ children }: { children?: React.ReactNode }) => {
    mockRenderedProviders.push('I18nextProvider');
    return children ?? null;
  },
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

jest.mock('../constants/i18n', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModalProvider: ({ children }: { children?: React.ReactNode }) => {
    mockRenderedProviders.push('BottomSheetModalProvider');
    return children ?? null;
  },
}));

jest.mock('../hooks', () => {
  const React = require('react');
  const actualTheme = jest.requireActual('../hooks/useTheme');
  const namedPassthrough = (name: string) =>
    ({ children }: { children?: React.ReactNode }) => {
      mockRenderedProviders.push(name);
      return children ?? null;
    };

  return {
    ThemeProvider: ({ children }: { children?: React.ReactNode }) => {
      mockRenderedProviders.push('ThemeProvider');
      return React.createElement(actualTheme.ThemeProvider, null, children ?? null);
    },
    ActiveFeedTargetProvider: namedPassthrough('ActiveFeedTargetProvider'),
    ActiveNoteProvider: namedPassthrough('ActiveNoteProvider'),
    AuthProvider: namedPassthrough('AuthProvider'),
    ConnectivityProvider: namedPassthrough('ConnectivityProvider'),
    FeedFocusProvider: namedPassthrough('FeedFocusProvider'),
    HapticsProvider: namedPassthrough('HapticsProvider'),
    NoteDetailSheetProvider: namedPassthrough('NoteDetailSheetProvider'),
    NotesProvider: namedPassthrough('NotesProvider'),
    SharedFeedProvider: namedPassthrough('SharedFeedProvider'),
    SubscriptionProvider: namedPassthrough('SubscriptionProvider'),
    SyncStatusProvider: namedPassthrough('SyncStatusProvider'),
  };
});

jest.mock('../hooks/app/useHomeStartupReady', () => ({
  StartupInteractionProvider: ({ children }: { children?: React.ReactNode }) => {
    mockRenderedProviders.push('StartupInteractionProvider');
    return children ?? null;
  },
  HomeStartupReadyProvider: ({ children }: { children?: React.ReactNode }) => {
    mockRenderedProviders.push('HomeStartupReadyProvider');
    return children ?? null;
  },
}));

jest.mock('../hooks/ui/useSavedNoteRevealUi', () => ({
  SavedNoteRevealUiProvider: ({ children }: { children?: React.ReactNode }) => {
    mockRenderedProviders.push('SavedNoteRevealUiProvider');
    return children ?? null;
  },
}));

jest.mock('../components/ui/AppAlertProvider', () => {
  const React = require('react');
  const actual = jest.requireActual('../components/ui/AppAlertProvider');

  return {
    AppAlertProvider: ({ children }: { children?: React.ReactNode }) => {
      mockRenderedProviders.push('AppAlertProvider');
      return React.createElement(actual.AppAlertProvider, null, children ?? null);
    },
  };
});

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

  function getProviderIndex(name: string) {
    const index = mockRenderedProviders.indexOf(name);
    expect(index).toBeGreaterThanOrEqual(0);
    return index;
  }

  beforeEach(() => {
    mockRenderedProviders.length = 0;
  });

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

  it('keeps provider dependency ordering intact', () => {
    render(
      <AppProviders>
        <Text>App content</Text>
      </AppProviders>
    );

    const orderPairs: Array<[string, string]> = [
      ['I18nextProvider', 'ThemeProvider'],
      ['ThemeProvider', 'HapticsProvider'],
      ['ConnectivityProvider', 'AuthProvider'],
      ['AuthProvider', 'SubscriptionProvider'],
      ['ConnectivityProvider', 'SubscriptionProvider'],
      ['AuthProvider', 'NotesProvider'],
      ['AuthProvider', 'SyncStatusProvider'],
      ['ConnectivityProvider', 'SyncStatusProvider'],
      ['NotesProvider', 'SyncStatusProvider'],
      ['AuthProvider', 'SharedFeedProvider'],
      ['ConnectivityProvider', 'SharedFeedProvider'],
    ];

    for (const [before, after] of orderPairs) {
      expect(getProviderIndex(before)).toBeLessThan(getProviderIndex(after));
    }
  });

  it('keeps the android bottom sheet portal below every app-level context it can read', () => {
    render(
      <AppProviders>
        <Text>App content</Text>
      </AppProviders>
    );

    const bottomSheetIndex = getProviderIndex('BottomSheetModalProvider');
    const requiredContextProviders = [
      'I18nextProvider',
      'ThemeProvider',
      'HapticsProvider',
      'ConnectivityProvider',
      'AuthProvider',
      'SubscriptionProvider',
      'ActiveNoteProvider',
      'ActiveFeedTargetProvider',
      'FeedFocusProvider',
      'StartupInteractionProvider',
      'NotesProvider',
      'SyncStatusProvider',
      'SharedFeedProvider',
      'SavedNoteRevealUiProvider',
    ];

    for (const providerName of requiredContextProviders) {
      expect(getProviderIndex(providerName)).toBeLessThan(bottomSheetIndex);
    }

    expect(bottomSheetIndex).toBeLessThan(getProviderIndex('AppAlertProvider'));
    expect(bottomSheetIndex).toBeLessThan(getProviderIndex('NoteDetailSheetProvider'));
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

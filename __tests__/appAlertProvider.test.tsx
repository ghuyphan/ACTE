import React from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { AppAlertProvider } from '../components/ui/AppAlertProvider';
import { showAppAlert } from '../utils/alert';

let latestAppSheetAlertProps: any = null;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

jest.mock('../components/sheets/AppSheetAlert', () => ({
  __esModule: true,
  default: (props: any) => {
    latestAppSheetAlertProps = props;
    return null;
  },
}));

describe('AppAlertProvider', () => {
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

  beforeEach(() => {
    latestAppSheetAlertProps = null;
  });

  it('keeps rendering wrapped app content when no android alert is active', () => {
    const { getByText } = render(
      <AppAlertProvider>
        <Text>App content</Text>
      </AppAlertProvider>
    );

    expect(getByText('App content')).toBeTruthy();
    expect(latestAppSheetAlertProps).toBeNull();
  });

  it('runs the button callback before clearing the active android alert', async () => {
    const { getByText } = render(
      <AppAlertProvider>
        <Text>App content</Text>
      </AppAlertProvider>
    );

    expect(getByText('App content')).toBeTruthy();

    await act(async () => {
      showAppAlert('First alert', 'First message', [
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            showAppAlert('Second alert', 'Second message');
          },
        },
      ]);
    });

    expect(latestAppSheetAlertProps?.title).toBe('First alert');
    expect(latestAppSheetAlertProps?.closeOnAction).toBe(false);

    await act(async () => {
      await latestAppSheetAlertProps.actions[0].onPress();
    });

    await waitFor(() => {
      expect(latestAppSheetAlertProps?.title).toBe('Second alert');
    });
  });
});

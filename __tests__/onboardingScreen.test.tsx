import { fireEvent, render, waitFor } from '@testing-library/react-native';
import OnboardingScreen from '../app/auth/onboarding';

const mockReplace = jest.fn();
const mockGetPersistentItem = jest.fn<Promise<string | null>, [string]>(async () => null);
const mockSetPersistentItem = jest.fn<Promise<void>, [string, string]>(async () => undefined);
const mockRequestSocialPushPermission = jest.fn<
  Promise<'granted' | 'denied' | 'blocked' | 'skipped'>,
  []
>(async () => 'granted');
const mockSyncSocialPushRegistration = jest.fn<
  Promise<'registered' | 'denied' | 'blocked' | 'skipped'>,
  [unknown]
>(async () => 'registered');

const mockAuthState = {
  user: null as { id: string; uid?: string } | null,
};

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const React = require('react');

    React.useEffect(() => callback(), [callback]);
  },
  useRouter: () => ({
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => {
    const React = require('react');
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

jest.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    isDark: false,
    colors: {
      background: '#F7F2EB',
      surface: '#FCF9F5',
      card: '#FFFDFC',
      text: '#2B2621',
      secondaryText: '#85786A',
      primary: '#E0B15B',
      border: '#EBE1D6',
    },
  }),
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('../utils/appStorage', () => ({
  getPersistentItem: (key: string) => mockGetPersistentItem(key),
  setPersistentItem: (key: string, value: string) => mockSetPersistentItem(key, value),
}));

jest.mock('../components/ui/GlassView', () => ({
  GlassView: ({ children }: { children?: React.ReactNode }) => {
    const React = require('react');
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('../components/ui/PrimaryButton', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');

  return ({ label, onPress, disabled, testID }: { label: string; onPress?: () => void; disabled?: boolean; testID?: string }) => (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} testID={testID ?? label}>
      <Text>{label}</Text>
    </Pressable>
  );
});

jest.mock('../utils/platform', () => ({
  isOlderIOS: false,
}));

jest.mock('../services/socialPushService', () => ({
  requestSocialPushPermission: () => mockRequestSocialPushPermission(),
  syncSocialPushRegistration: (user: unknown) => mockSyncSocialPushRegistration(user),
}));

describe('OnboardingScreen', () => {
  const originalRequestAnimationFrame = global.requestAnimationFrame;

  beforeAll(() => {
    global.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 0 as never;
    }) as typeof global.requestAnimationFrame;
  });

  afterAll(() => {
    global.requestAnimationFrame = originalRequestAnimationFrame;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.user = null;
    mockGetPersistentItem.mockResolvedValue(null);
    mockSetPersistentItem.mockResolvedValue(undefined);
    mockRequestSocialPushPermission.mockResolvedValue('granted');
    mockSyncSocialPushRegistration.mockResolvedValue('registered');
  });

  it('redirects away when a signed-in user lands on onboarding', async () => {
    mockAuthState.user = { id: 'user-1' };

    render(<OnboardingScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    });

    expect(mockGetPersistentItem).not.toHaveBeenCalled();
  });

  it('redirects away when onboarding was already completed', async () => {
    mockGetPersistentItem.mockResolvedValue('true');

    render(<OnboardingScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });

  it('persists onboarding completion before navigating home', async () => {
    const { getByText } = render(<OnboardingScreen />);

    fireEvent.press(getByText('Skip'));

    await waitFor(() => {
      expect(mockSetPersistentItem).toHaveBeenCalledWith('settings.hasLaunched', 'true');
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    });

    expect(mockSetPersistentItem.mock.invocationCallOrder[0]).toBeLessThan(
      mockReplace.mock.invocationCallOrder[0]
    );
  });

  it('requests notification permission on the final onboarding step before navigating home', async () => {
    const { getByText } = render(<OnboardingScreen />);

    fireEvent.press(getByText('Next'));
    fireEvent.press(getByText('Next'));
    fireEvent.press(getByText('Next'));
    fireEvent.press(getByText('Allow notifications'));

    await waitFor(() => {
      expect(mockRequestSocialPushPermission).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    });
  });
});

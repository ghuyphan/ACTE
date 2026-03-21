import { act, fireEvent, render } from '@testing-library/react-native';
import LoginScreen from '../app/auth/index';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockUseLocalSearchParams = jest.fn(() => ({}));
const mockUsePreventRemove = jest.fn();
const mockSignInWithGoogle = jest.fn<Promise<{ status: 'success' }>, []>(async () => ({ status: 'success' }));
const mockSignInWithEmail = jest.fn<Promise<{ status: 'success' }>, [string, string]>(
  async () => ({ status: 'success' })
);
const mockRegisterWithEmail = jest.fn<Promise<{ status: 'success' }>, [unknown]>(
  async () => ({ status: 'success' })
);
const mockSendPasswordReset = jest.fn<Promise<{ status: 'success' }>, [string]>(
  async () => ({ status: 'success' })
);

const mockAuthState = {
  user: null,
  isReady: true,
  isAuthAvailable: true,
  isGoogleAvailable: true,
};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: (...args: unknown[]) => mockReplace(...args),
    push: (...args: unknown[]) => mockPush(...args),
  }),
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('@react-navigation/native', () => ({
  usePreventRemove: (...args: unknown[]) => mockUsePreventRemove(...args),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('@expo/ui/swift-ui', () => ({
  BottomSheet: ({ children, isPresented }: { children?: React.ReactNode; isPresented: boolean }) => {
    const React = require('react');
    const { View } = require('react-native');
    return isPresented ? <View>{children}</View> : null;
  },
  Group: ({ children }: { children?: React.ReactNode }) => {
    const React = require('react');
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
  Host: ({ children }: { children?: React.ReactNode }) => {
    const React = require('react');
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
  RNHostView: ({ children }: { children?: React.ReactNode }) => {
    const React = require('react');
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  environment: jest.fn(),
  presentationDetents: jest.fn(),
  presentationDragIndicator: jest.fn(),
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
    t: (_key: string, fallback?: string, options?: { email?: string }) => {
      if (fallback && options?.email) {
        return fallback.replace('{{email}}', options.email);
      }
      return fallback ?? _key;
    },
    i18n: { language: 'en' },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
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
      primarySoft: 'rgba(224, 177, 91, 0.18)',
      accent: '#B77845',
      border: '#EBE1D6',
      danger: '#FF3B30',
      success: '#34C759',
      gradient: ['#F2DEC0', '#E0B15B'],
      captureButtonBg: '#1C1C1E',
      tabBarBg: 'rgba(247,242,235,0.94)',
      captureCardText: '#1C1C1E',
      captureCardPlaceholder: 'rgba(28,28,30,0.48)',
      captureCardBorder: 'rgba(255,255,255,0.22)',
      captureGlassFill: 'rgba(255,252,246,0.62)',
      captureGlassBorder: 'rgba(255,255,255,0.3)',
      captureGlassText: '#2B2621',
      captureGlassIcon: 'rgba(43,38,33,0.52)',
      captureGlassPlaceholder: 'rgba(43,38,33,0.34)',
      captureGlassColorScheme: 'light',
      captureCameraOverlay: 'rgba(28,28,30,0.48)',
      captureCameraOverlayBorder: 'rgba(255,255,255,0.16)',
      captureCameraOverlayText: '#FFFDFC',
      captureFlashOverlay: 'rgba(255,250,242,0.96)',
    },
  }),
}));

jest.mock('../hooks/useConnectivity', () => ({
  useConnectivity: () => ({
    status: 'online',
    isOnline: true,
    isInternetReachable: true,
    lastChangedAt: null,
  }),
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    ...mockAuthState,
    signInWithGoogle: () => mockSignInWithGoogle(),
    signInWithEmail: (email: string, password: string) => mockSignInWithEmail(email, password),
    registerWithEmail: (input: unknown) => mockRegisterWithEmail(input),
    sendPasswordReset: (email: string) => mockSendPasswordReset(email),
  }),
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocalSearchParams.mockReturnValue({});
    mockAuthState.user = null;
    mockAuthState.isReady = true;
    mockAuthState.isAuthAvailable = true;
    mockAuthState.isGoogleAvailable = true;
  });

  it('renders the landing design with Google and email actions', () => {
    const { getByText, getByTestId } = render(<LoginScreen />);

    expect(getByText('Noto')).toBeTruthy();
    expect(getByTestId('auth-google-button')).toBeTruthy();
    expect(getByTestId('auth-continue-email')).toBeTruthy();
    expect(getByTestId('auth-continue-local')).toBeTruthy();
  });

  it('opens the slide-up email form from the landing screen', () => {
    const { getByTestId, getByText } = render(<LoginScreen />);

    fireEvent.press(getByTestId('auth-continue-email'));

    expect(getByTestId('auth-form-panel')).toBeTruthy();
    expect(getByTestId('auth-email-input')).toBeTruthy();
    expect(getByTestId('auth-password-input')).toBeTruthy();
    expect(getByText('Sign in to keep your notes backed up and synced automatically.')).toBeTruthy();
  });

  it('switches between sign-in, register, and reset-password modes', () => {
    const { getByTestId, queryByTestId } = render(<LoginScreen />);

    fireEvent.press(getByTestId('auth-continue-email'));
    fireEvent.press(getByTestId('auth-switch-register'));

    expect(getByTestId('auth-display-name-input')).toBeTruthy();
    expect(getByTestId('auth-confirm-password-input')).toBeTruthy();

    fireEvent.press(getByTestId('auth-switch-signin'));
    fireEvent.press(getByTestId('auth-forgot-password'));

    expect(getByTestId('auth-email-input')).toBeTruthy();
    expect(queryByTestId('auth-password-input')).toBeNull();
    expect(getByTestId('auth-back-to-signin')).toBeTruthy();
  });

  it('steps back through the auth flow when navigation back is prevented', () => {
    const { getByTestId } = render(<LoginScreen />);

    fireEvent.press(getByTestId('auth-continue-email'));
    fireEvent.press(getByTestId('auth-switch-register'));

    const latestCall = mockUsePreventRemove.mock.calls[mockUsePreventRemove.mock.calls.length - 1];
    expect(latestCall[0]).toBe(true);

    act(() => {
      latestCall[1]();
    });

    expect(getByTestId('auth-password-input')).toBeTruthy();
    expect(getByTestId('auth-forgot-password')).toBeTruthy();

    const nextCall = mockUsePreventRemove.mock.calls[mockUsePreventRemove.mock.calls.length - 1];
    expect(nextCall[0]).toBe(true);

    act(() => {
      nextCall[1]();
    });

    const finalCall = mockUsePreventRemove.mock.calls[mockUsePreventRemove.mock.calls.length - 1];
    expect(finalCall[0]).toBe(false);
  });

  it('shows share-specific copy when opened from a Home share action', () => {
    mockUseLocalSearchParams.mockReturnValue({ intent: 'share-note' });

    const { getByText, getByTestId, queryByText } = render(<LoginScreen />);

    expect(getByText('Sign in to share this note')).toBeTruthy();
    expect(queryByText('Choose the easiest way to keep your notes backed up and ready everywhere.')).toBeNull();

    fireEvent.press(getByTestId('auth-continue-email'));

    expect(getByText('Sign in to share this note.')).toBeTruthy();
  });
});

import { act, renderHook } from '@testing-library/react-native';
import { useProfileScreenModel } from '../components/screens/profile/useProfileScreenModel';

const mockRouterReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockRouterReplace,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  }),
}));

jest.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      surface: '#fafafa',
      card: '#fff',
      text: '#111',
      secondaryText: '#666',
      primary: '#f4b942',
      primarySoft: 'rgba(244,185,66,0.15)',
      border: '#ddd',
      danger: '#f00',
    },
    isDark: false,
  }),
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    isAuthAvailable: true,
    deleteAccount: jest.fn(async () => ({ status: 'success' })),
    signOut: jest.fn(async () => undefined),
    updateAvatar: jest.fn(async () => ({ status: 'success' })),
    updateUsername: jest.fn(async () => ({ status: 'success' })),
  }),
}));

jest.mock('../hooks/useNotes', () => ({
  useNotes: () => ({
    refreshNotes: jest.fn(async () => undefined),
  }),
}));

jest.mock('../hooks/useSubscription', () => ({
  useSubscription: () => ({
    tier: 'free',
  }),
}));

jest.mock('../hooks/useHaptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  NotificationFeedbackType: {
    Success: 'success',
  },
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

jest.mock('../services/profileAvatar', () => ({
  pickCompressedProfileAvatarDataUri: jest.fn(async () => null),
}));

jest.mock('../services/publicProfileService', () => ({
  normalizeUsernameInput: (value: string) => value.trim().toLowerCase(),
  validateUsernameInput: () => null,
}));

jest.mock('../utils/alert', () => ({
  showAppAlert: jest.fn(),
}));

jest.mock('../services/legalLinks', () => ({
  hasAccountDeletionLink: () => false,
  hasPrivacyPolicyLink: () => false,
  hasSupportLink: () => false,
  openAccountDeletionHelp: jest.fn(),
  openPrivacyPolicy: jest.fn(),
  openSupport: jest.fn(),
}));

describe('useProfileScreenModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes signed-out profile auth back to the profile screen', () => {
    const { result } = renderHook(() => useProfileScreenModel());

    act(() => {
      result.current.openSignIn();
    });

    expect(mockRouterReplace).toHaveBeenCalledWith({
      pathname: '/auth',
      params: {
        returnTo: '/auth/profile',
      },
    });
  });
});

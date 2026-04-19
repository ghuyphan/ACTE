import { act, renderHook } from '@testing-library/react-native';
import { buildProfileSections } from '../components/screens/profile/profileScreenSections';
import { useProfileScreenModel } from '../components/screens/profile/useProfileScreenModel';

const mockRouterReplace = jest.fn();
const mockClipboardSetStringAsync = jest.fn(async (_value: string) => undefined);
const mockAuthState = {
  user: null as null | {
    id: string;
    uid: string;
    displayName: string | null;
    username: string | null;
    usernameSetAt: string | null;
    email: string | null;
    photoURL: string | null;
  },
  isAuthAvailable: true,
  deleteAccount: jest.fn(async () => ({ status: 'success' })),
  signOut: jest.fn(async () => undefined),
  updateAvatar: jest.fn(async () => ({ status: 'success' })),
  updateUsername: jest.fn(async () => ({ status: 'success' })),
};

jest.mock('expo-clipboard', () => ({
  setStringAsync: (value: string) => mockClipboardSetStringAsync(value),
}));

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
  useAuth: () => mockAuthState,
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
    mockAuthState.user = null;
    mockAuthState.isAuthAvailable = true;
  });

  afterEach(() => {
    jest.useRealTimers();
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

  it('copies the signed-in Noto ID from the profile row action', async () => {
    jest.useFakeTimers();
    mockAuthState.user = {
      id: 'user-1',
      uid: 'user-1',
      displayName: 'Huy',
      username: 'huyphan',
      usernameSetAt: '2026-04-11T08:00:00.000Z',
      email: 'huy@example.com',
      photoURL: null,
    };

    const { result } = renderHook(() => useProfileScreenModel());
    const { signedInSections } = buildProfileSections(result.current);
    const usernameRow = signedInSections
      .flatMap((section) => section.items)
      .find((row) => row.key === 'username');

    expect(usernameRow?.trailingAction?.icon).toBe('copy');

    await act(async () => {
      await usernameRow?.trailingAction?.onPress();
    });

    expect(mockClipboardSetStringAsync).toHaveBeenCalledWith('huyphan');
    expect(result.current.isUsernameCopied).toBe(true);

    const copiedSections = buildProfileSections(result.current).signedInSections;
    const copiedUsernameRow = copiedSections
      .flatMap((section) => section.items)
      .find((row) => row.key === 'username');

    expect(copiedUsernameRow?.trailingAction?.icon).toBe('check');

    act(() => {
      jest.advanceTimersByTime(1600);
    });
    expect(result.current.isUsernameCopied).toBe(false);
  });

  it('keeps username editing reachable when the username is missing', () => {
    mockAuthState.user = {
      id: 'user-1',
      uid: 'user-1',
      displayName: 'Huy',
      username: null,
      usernameSetAt: null,
      email: 'huy@example.com',
      photoURL: null,
    };

    const { result } = renderHook(() => useProfileScreenModel());
    const { signedInSections } = buildProfileSections(result.current);
    const usernameRow = signedInSections
      .flatMap((section) => section.items)
      .find((row) => row.key === 'username');
    const emailRow = signedInSections
      .flatMap((section) => section.items)
      .find((row) => row.key === 'email');

    expect(usernameRow).toMatchObject({
      title: 'Username',
      subtitle: 'Choose your permanent username',
      trailingAction: undefined,
    });
    expect(usernameRow?.onPress).toBe(result.current.openUsernameEditor);
    expect(emailRow?.value).toBe('huy@example.com');
  });
});

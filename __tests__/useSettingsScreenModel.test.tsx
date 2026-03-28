import { act, renderHook } from '@testing-library/react-native';
import { useSettingsScreenModel } from '../components/screens/useSettingsScreenModel';

const mockRouterPush = jest.fn();
const mockShowAlert = jest.fn();

const mockThemeState = {
  theme: 'system' as 'system' | 'light' | 'dark',
  setTheme: jest.fn(),
  colors: {
    background: '#ffffff',
    text: '#111111',
    secondaryText: '#666666',
    primary: '#f4b942',
    surface: '#f8f5ef',
    border: '#e5dccf',
    danger: '#ff3b30',
  },
  isDark: false,
};

const mockNotesState = {
  notes: [] as Array<{ id: string }>,
  deleteAllNotes: jest.fn(async () => undefined),
};

const mockSharedFeedState = {
  deleteSharedNotes: jest.fn(async () => undefined),
};

const mockAuthState = {
  user: null as null | {
    id: string;
    uid: string;
    displayName: string | null;
    email: string | null;
  },
  isAuthAvailable: true,
};

const mockSyncState = {
  status: 'idle' as 'idle' | 'syncing' | 'success' | 'error',
  lastSyncedAt: null as string | null,
  lastMessage: null as string | null,
  pendingCount: 0,
  failedCount: 0,
  blockedCount: 0,
  isEnabled: true,
  setSyncEnabled: jest.fn(),
};

const mockSubscriptionState = {
  tier: 'free' as 'free' | 'plus',
  isPurchaseAvailable: false,
  plusPriceLabel: null as string | null,
  photoNoteLimit: 10 as number | null,
};

jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '1.0.0',
  },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string, options?: { count?: number; date?: string }) => {
      if (typeof fallback === 'string') {
        if (options?.count !== undefined) {
          return fallback.replace('{{count}}', String(options.count));
        }

        if (options?.date) {
          return fallback.replace('{{date}}', options.date);
        }

        return fallback;
      }

      return _key;
    },
    i18n: {
      language: 'en',
      resolvedLanguage: 'en',
    },
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

jest.mock('../hooks/useAppSheetAlert', () => ({
  useAppSheetAlert: () => ({
    alertProps: null,
    showAlert: mockShowAlert,
  }),
}));

jest.mock('../hooks/useTheme', () => ({
  useTheme: () => mockThemeState,
}));

jest.mock('../hooks/useConnectivity', () => ({
  useConnectivity: () => ({
    isOnline: true,
  }),
}));

jest.mock('../hooks/useNotes', () => ({
  useNotes: () => mockNotesState,
}));

jest.mock('../hooks/useSharedFeed', () => ({
  useSharedFeedStore: () => mockSharedFeedState,
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('../hooks/useSyncStatus', () => ({
  useSyncStatus: () => mockSyncState,
}));

jest.mock('../hooks/useSubscription', () => ({
  useSubscription: () => mockSubscriptionState,
}));

jest.mock('../services/legalLinks', () => ({
  hasAccountDeletionLink: () => false,
  hasPrivacyPolicyLink: () => false,
  hasSupportLink: () => false,
  openAccountDeletionHelp: jest.fn(),
  openPrivacyPolicy: jest.fn(),
  openSupport: jest.fn(),
}));

describe('useSettingsScreenModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.user = null;
    mockAuthState.isAuthAvailable = true;
    mockSyncState.status = 'idle';
    mockSyncState.lastSyncedAt = null;
    mockSyncState.lastMessage = null;
    mockSyncState.pendingCount = 0;
    mockSyncState.failedCount = 0;
    mockSyncState.blockedCount = 0;
    mockSyncState.isEnabled = true;
  });

  it('shows not signed in for cloud sync when there is no signed-in user', () => {
    const { result } = renderHook(() => useSettingsScreenModel());

    expect(result.current.syncValue).toBe('Not signed in');
  });

  it('opens auth instead of the sync sheet when signed out', () => {
    const { result } = renderHook(() => useSettingsScreenModel());

    act(() => {
      result.current.openSyncScreen();
    });

    expect(mockRouterPush).toHaveBeenCalledWith('/auth');
    expect(result.current.showSync).toBe(false);
  });

  it('shows off only when a signed-in user has sync disabled', () => {
    mockAuthState.user = {
      id: 'user-1',
      uid: 'user-1',
      displayName: 'Huy',
      email: 'huy@example.com',
    };
    mockSyncState.isEnabled = false;

    const { result } = renderHook(() => useSettingsScreenModel());

    expect(result.current.syncValue).toBe('Off');
  });

  it('opens the sync sheet for signed-in users', () => {
    mockAuthState.user = {
      id: 'user-1',
      uid: 'user-1',
      displayName: 'Huy',
      email: 'huy@example.com',
    };

    const { result } = renderHook(() => useSettingsScreenModel());

    act(() => {
      result.current.openSyncScreen();
    });

    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(result.current.showSync).toBe(true);
  });

  it('shows unavailable when auth is not available in the build', () => {
    mockAuthState.isAuthAvailable = false;

    const { result } = renderHook(() => useSettingsScreenModel());

    expect(result.current.syncValue).toBe('Unavailable');
  });
});

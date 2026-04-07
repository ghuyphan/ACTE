import { act, renderHook } from '@testing-library/react-native';
import { useSettingsScreenModel } from '../components/screens/settings/useSettingsScreenModel';

const mockRouterPush = jest.fn();
const mockShowAlert = jest.fn();
const mockConnectivityState = {
  isOnline: true,
};

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
  notes: [] as { id: string }[],
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
    isOnline: mockConnectivityState.isOnline,
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
    mockConnectivityState.isOnline = true;
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

    expect(result.current.showSyncEntry).toBe(false);
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

    expect(result.current.showSyncEntry).toBe(true);
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

  it('falls back to the signed-in email when there is no display name', () => {
    mockAuthState.user = {
      id: 'user-1',
      uid: 'user-1',
      displayName: null,
      email: 'huy@example.com',
    };

    const { result } = renderHook(() => useSettingsScreenModel());

    expect(result.current.accountValue).toBe('huy@example.com');
    expect(result.current.showSyncEntry).toBe(true);
  });

  it('shows pending sync while offline with queued changes', () => {
    mockAuthState.user = {
      id: 'user-1',
      uid: 'user-1',
      displayName: 'Huy',
      email: 'huy@example.com',
    };
    mockConnectivityState.isOnline = false;
    mockSyncState.pendingCount = 3;

    const { result } = renderHook(() => useSettingsScreenModel());

    expect(result.current.syncValue).toBe('Pending');
    expect(result.current.accountHint).toBe(
      'Your notes are saved locally and will sync when you are back online.'
    );
  });

  it('surfaces the latest sync error message when sync fails', () => {
    mockAuthState.user = {
      id: 'user-1',
      uid: 'user-1',
      displayName: 'Huy',
      email: 'huy@example.com',
    };
    mockSyncState.status = 'error';
    mockSyncState.lastMessage = 'Token expired. Sign in again.';

    const { result } = renderHook(() => useSettingsScreenModel());

    expect(result.current.accountHint).toBe('Token expired. Sign in again.');
  });

  it('describes blocked and retrying sync states when there is no success or error banner', () => {
    mockAuthState.user = {
      id: 'user-1',
      uid: 'user-1',
      displayName: 'Huy',
      email: 'huy@example.com',
    };
    mockSyncState.blockedCount = 1;

    const blockedResult = renderHook(() => useSettingsScreenModel());
    expect(blockedResult.result.current.accountHint).toBe(
      'Some notes need your attention before they can finish syncing.'
    );

    blockedResult.unmount();
    mockSyncState.blockedCount = 0;
    mockSyncState.failedCount = 2;

    const retryResult = renderHook(() => useSettingsScreenModel());
    expect(retryResult.result.current.accountHint).toBe(
      'Some notes are queued to retry syncing automatically.'
    );
  });

  it('updates the plus hint for unlimited and capped free plans', () => {
    mockSubscriptionState.photoNoteLimit = null;

    const unlimitedResult = renderHook(() => useSettingsScreenModel());
    expect(unlimitedResult.result.current.plusHint).toBe(
      'Upgrade to Noto Plus to unlock unlimited photo notes, interactive hologram cards, premium finishes, and import from your photo library.'
    );

    unlimitedResult.unmount();
    mockSubscriptionState.photoNoteLimit = 10;

    const cappedResult = renderHook(() => useSettingsScreenModel());
    expect(cappedResult.result.current.plusHint).toBe(
      'Free plan includes up to 10 photo notes. Upgrade to Noto Plus for unlimited photo notes, interactive hologram cards, premium finishes, and library import.'
    );
  });
});

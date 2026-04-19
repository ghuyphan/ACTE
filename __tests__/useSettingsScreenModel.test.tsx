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
  enabled: false,
  deleteSharedNotes: jest.fn(async () => undefined),
};

const mockAuthState = {
  user: null as null | {
    id: string;
    uid: string;
    displayName: string | null;
    username?: string | null;
    email: string | null;
  },
  isAuthAvailable: true,
};

const mockSyncState = {
  status: 'idle' as 'idle' | 'syncing' | 'success' | 'error',
  bootstrapState: 'complete' as 'idle' | 'preparing' | 'syncing' | 'disabled' | 'offline' | 'error' | 'complete',
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
const mockSocialPushState = {
  status: 'denied' as 'skipped' | 'denied' | 'blocked' | 'granted',
  enableFromPrompt: jest.fn(async () => undefined),
  openSystemSettings: jest.fn(async () => undefined),
};

const mockHapticsState = {
  isEnabled: true,
  setIsEnabled: jest.fn(async () => undefined),
  preferenceReady: true,
};
const mockI18nState = {
  language: 'en',
  resolvedLanguage: 'en',
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
    i18n: mockI18nState,
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

jest.mock('../hooks/useHaptics', () => ({
  useHaptics: () => mockHapticsState,
}));

jest.mock('../hooks/useSocialPushPermission', () => ({
  useSocialPushPermission: () => mockSocialPushState,
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
    mockSharedFeedState.enabled = false;
    mockSyncState.status = 'idle';
    mockSyncState.bootstrapState = 'complete';
    mockSyncState.lastSyncedAt = null;
    mockSyncState.lastMessage = null;
    mockSyncState.pendingCount = 0;
    mockSyncState.failedCount = 0;
    mockSyncState.blockedCount = 0;
    mockSyncState.isEnabled = true;
    mockHapticsState.isEnabled = true;
    mockI18nState.language = 'en';
    mockI18nState.resolvedLanguage = 'en';
    mockSocialPushState.status = 'denied';
  });

  it('shows not signed in for cloud sync when there is no signed-in user', () => {
    const { result } = renderHook(() => useSettingsScreenModel());

    expect(result.current.showSyncEntry).toBe(false);
    expect(result.current.syncValue).toBe('Not signed in');
    expect(result.current.accountHint).toBe(
      'Sign in to back up your notes and keep them synced across your devices.'
    );
  });

  it('opens auth instead of the sync sheet when signed out', () => {
    const { result } = renderHook(() => useSettingsScreenModel());

    act(() => {
      result.current.openSyncScreen();
    });

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/auth',
      params: {
        returnTo: '/(tabs)/settings',
      },
    });
    expect(result.current.showSync).toBe(false);
  });

  it('routes signed-out account entry back to settings after auth', () => {
    const { result } = renderHook(() => useSettingsScreenModel());

    act(() => {
      result.current.openAccountScreen();
    });

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/auth',
      params: {
        returnTo: '/(tabs)/settings',
      },
    });
  });

  it('shows paused when a signed-in user has sync disabled', () => {
    mockAuthState.user = {
      id: 'user-1',
      uid: 'user-1',
      displayName: 'Huy',
      email: 'huy@example.com',
    };
    mockSyncState.isEnabled = false;

    const { result } = renderHook(() => useSettingsScreenModel());

    expect(result.current.showSyncEntry).toBe(true);
    expect(result.current.syncValue).toBe('Paused');
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

  it('prefers the username over email when there is no display name', () => {
    mockAuthState.user = {
      id: 'user-1',
      uid: 'user-1',
      displayName: null,
      username: 'huyphan',
      email: 'huy@example.com',
    };

    const { result } = renderHook(() => useSettingsScreenModel());

    expect(result.current.accountValue).toBe('@huyphan');
  });

  it('shows offline pending sync status without a signed-in account subtitle', () => {
    mockAuthState.user = {
      id: 'user-1',
      uid: 'user-1',
      displayName: 'Huy',
      email: 'huy@example.com',
    };
    mockConnectivityState.isOnline = false;
    mockSyncState.pendingCount = 3;

    const { result } = renderHook(() => useSettingsScreenModel());

    expect(result.current.syncValue).toBe('Offline, 3 pending');
    expect(result.current.accountHint).toBeNull();
  });

  it('shows preparing during the first sync bootstrap', () => {
    mockAuthState.user = {
      id: 'user-1',
      uid: 'user-1',
      displayName: 'Huy',
      email: 'huy@example.com',
    };
    mockSyncState.bootstrapState = 'preparing';

    const { result } = renderHook(() => useSettingsScreenModel());

    expect(result.current.syncValue).toBe('Preparing');
  });

  it('keeps sync error details out of the signed-in account row', () => {
    mockAuthState.user = {
      id: 'user-1',
      uid: 'user-1',
      displayName: 'Huy',
      email: 'huy@example.com',
    };
    mockSyncState.status = 'error';
    mockSyncState.lastMessage = 'Token expired. Sign in again.';

    const { result } = renderHook(() => useSettingsScreenModel());

    expect(result.current.syncValue).toBe('Attention');
    expect(result.current.accountHint).toBeNull();
  });

  it('shows a short synced status instead of the full last synced timestamp in the row', () => {
    mockAuthState.user = {
      id: 'user-1',
      uid: 'user-1',
      displayName: 'Huy',
      email: 'huy@example.com',
    };
    mockSyncState.status = 'success';
    mockSyncState.lastSyncedAt = '2026-04-14T05:12:00.000Z';

    const { result } = renderHook(() => useSettingsScreenModel());

    expect(result.current.syncValue).toBe('Synced');
    expect(result.current.accountHint).toBeNull();
  });

  it('keeps blocked and retrying sync details out of the signed-in account row', () => {
    mockAuthState.user = {
      id: 'user-1',
      uid: 'user-1',
      displayName: 'Huy',
      email: 'huy@example.com',
    };
    mockSyncState.blockedCount = 1;

    const blockedResult = renderHook(() => useSettingsScreenModel());
    expect(blockedResult.result.current.syncValue).toBe('Attention');
    expect(blockedResult.result.current.accountHint).toBeNull();

    blockedResult.unmount();
    mockSyncState.blockedCount = 0;
    mockSyncState.failedCount = 2;

    const retryResult = renderHook(() => useSettingsScreenModel());
    expect(retryResult.result.current.syncValue).toBe('Attention');
    expect(retryResult.result.current.accountHint).toBeNull();
  });

  it('updates the plus hint for unlimited and capped free plans', () => {
    mockSubscriptionState.photoNoteLimit = null;

    const unlimitedResult = renderHook(() => useSettingsScreenModel());
    expect(unlimitedResult.result.current.plusHint).toBe(
      'Upgrade to Noto Plus to unlock unlimited photo notes, premium photo filters, interactive hologram cards, and premium finishes.'
    );

    unlimitedResult.unmount();
    mockSubscriptionState.photoNoteLimit = 5;

    const cappedResult = renderHook(() => useSettingsScreenModel());
    expect(cappedResult.result.current.plusHint).toBe(
      'Free plan includes 5 photo memories per day. Upgrade to Noto Plus for unlimited photo saves, premium photo filters, interactive hologram cards, and premium finishes.'
    );
  });

  it('normalizes the language label from regional locale variants', () => {
    mockI18nState.language = 'vi-VN';
    mockI18nState.resolvedLanguage = 'vi-VN';

    const { result } = renderHook(() => useSettingsScreenModel());

    expect(result.current.languageLabel).toBe('Tiếng Việt');
  });

  it('keeps friend activity notifications visible after permission is granted', () => {
    mockAuthState.user = {
      id: 'user-1',
      uid: 'user-1',
      displayName: 'Huy',
      email: 'huy@example.com',
    };
    mockSharedFeedState.enabled = true;
    mockSocialPushState.status = 'granted';

    const { result } = renderHook(() => useSettingsScreenModel());

    expect(result.current.showSocialPushEntry).toBe(true);
    expect(result.current.socialPushValue).toBe('On');
    expect(result.current.socialPushHint).toBe(
      'Get alerts when friends accept invites or share moments with you.'
    );
  });

  it('opens system settings instead of showing the prompt when social push permission is blocked', async () => {
    mockAuthState.user = {
      id: 'user-1',
      uid: 'user-1',
      displayName: 'Huy',
      email: 'huy@example.com',
    };
    mockSharedFeedState.enabled = true;
    mockSocialPushState.status = 'blocked';

    const { result } = renderHook(() => useSettingsScreenModel());

    await act(async () => {
      await result.current.openSocialPushSettings();
    });

    expect(mockSocialPushState.openSystemSettings).toHaveBeenCalled();
    expect(mockSocialPushState.enableFromPrompt).not.toHaveBeenCalled();
  });
});

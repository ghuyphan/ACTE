import { renderHook } from '@testing-library/react-native';
import { useSyncSheetDetails } from '../hooks/useSyncSheetDetails';

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
  blockedCount: 0,
  failedCount: 0,
  isEnabled: true,
  lastMessage: null as string | null,
  pendingCount: 0,
  recentQueueItems: [] as unknown[],
  requestSync: jest.fn(),
  setSyncEnabled: jest.fn(),
  status: 'idle' as 'idle' | 'syncing' | 'success' | 'error',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string, options?: Record<string, string | number>) => {
      if (typeof fallback !== 'string') {
        return _key;
      }

      if (!options) {
        return fallback;
      }

      return Object.entries(options).reduce(
        (message, [key, value]) => message.replace(`{{${key}}}`, String(value)),
        fallback
      );
    },
  }),
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('../hooks/useSyncStatus', () => ({
  useSyncStatus: () => mockSyncState,
}));

describe('useSyncSheetDetails', () => {
  beforeEach(() => {
    mockAuthState.user = null;
    mockAuthState.isAuthAvailable = true;
    mockSyncState.blockedCount = 0;
    mockSyncState.failedCount = 0;
    mockSyncState.isEnabled = true;
    mockSyncState.lastMessage = null;
    mockSyncState.pendingCount = 0;
    mockSyncState.recentQueueItems = [];
    mockSyncState.requestSync.mockClear();
    mockSyncState.setSyncEnabled.mockClear();
    mockSyncState.status = 'idle';
  });

  it('prefers the current sync hint when one is available', () => {
    mockAuthState.user = {
      id: 'user-1',
      uid: 'user-1',
      displayName: 'Huy',
      email: 'huy@example.com',
    };

    const { result } = renderHook(() => useSyncSheetDetails('Last synced today'));

    expect(result.current.description).toBe('Last synced today');
    expect(result.current.statusLabel).toBe('On');
    expect(result.current.queueSummary).toBeNull();
    expect(result.current.showDiagnostics).toBe(false);
  });

  it('explains the local-only state when cloud sync is turned off', () => {
    mockAuthState.user = {
      id: 'user-1',
      uid: 'user-1',
      displayName: 'Huy',
      email: 'huy@example.com',
    };
    mockSyncState.isEnabled = false;

    const { result } = renderHook(() => useSyncSheetDetails(null));

    expect(result.current.description).toBe(
      'Your notes stay on this device until you turn cloud sync back on.'
    );
    expect(result.current.statusLabel).toBe('Off');
  });

  it('falls back to the signed-out account message when no user is available', () => {
    const { result } = renderHook(() => useSyncSheetDetails(null));

    expect(result.current.canManageSync).toBe(false);
    expect(result.current.description).toBe(
      'Sign in to back up your notes and keep them synced across your devices.'
    );
    expect(result.current.statusLabel).toBe('Not signed in');
  });
});

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
  bootstrapState: 'complete' as 'idle' | 'preparing' | 'syncing' | 'disabled' | 'offline' | 'error' | 'complete',
  blockedCount: 0,
  failedCount: 0,
  isEnabled: true,
  lastSyncedAt: null as string | null,
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

jest.mock('../hooks/useConnectivity', () => ({
  useConnectivity: () => ({
    isOnline: mockConnectivityState.isOnline,
  }),
}));

const mockConnectivityState = {
  isOnline: true,
};

describe('useSyncSheetDetails', () => {
  beforeEach(() => {
    mockAuthState.user = null;
    mockAuthState.isAuthAvailable = true;
    mockConnectivityState.isOnline = true;
    mockSyncState.bootstrapState = 'complete';
    mockSyncState.blockedCount = 0;
    mockSyncState.failedCount = 0;
    mockSyncState.isEnabled = true;
    mockSyncState.lastSyncedAt = null;
    mockSyncState.lastMessage = null;
    mockSyncState.pendingCount = 0;
    mockSyncState.recentQueueItems = [];
    mockSyncState.requestSync.mockClear();
    mockSyncState.setSyncEnabled.mockClear();
    mockSyncState.status = 'idle';
  });

  it('shows the detailed last synced status in the sync sheet', () => {
    mockAuthState.user = {
      id: 'user-1',
      uid: 'user-1',
      displayName: 'Huy',
      email: 'huy@example.com',
    };
    mockSyncState.lastSyncedAt = '2026-04-14T05:12:00.000Z';

    const { result } = renderHook(() => useSyncSheetDetails(null));

    expect(result.current.description).toBe('Your notes sync automatically while you are signed in.');
    expect(result.current.statusLabel.startsWith('Last synced ')).toBe(true);
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
    expect(result.current.statusLabel).toBe('Sync paused');
  });

  it('surfaces preparing and offline states in the sync sheet', () => {
    mockAuthState.user = {
      id: 'user-1',
      uid: 'user-1',
      displayName: 'Huy',
      email: 'huy@example.com',
    };
    mockSyncState.bootstrapState = 'preparing';

    const preparingResult = renderHook(() => useSyncSheetDetails(null));
    expect(preparingResult.result.current.statusLabel).toBe('Preparing first sync');
    expect(preparingResult.result.current.canRequestSync).toBe(false);
    expect(preparingResult.result.current.description).toBe(
      'Keep Noto open a little longer so your first backup can finish safely.'
    );

    preparingResult.unmount();
    mockSyncState.bootstrapState = 'offline';
    mockConnectivityState.isOnline = false;
    mockSyncState.pendingCount = 2;

    const offlineResult = renderHook(() => useSyncSheetDetails(null));
    expect(offlineResult.result.current.statusLabel).toBe('Offline, 2 pending');
    expect(offlineResult.result.current.canRequestSync).toBe(false);
    expect(offlineResult.result.current.description).toBe(
      'Your notes are saved locally and will sync when you are back online.'
    );
  });

  it('shows attention when sync needs help', () => {
    mockAuthState.user = {
      id: 'user-1',
      uid: 'user-1',
      displayName: 'Huy',
      email: 'huy@example.com',
    };
    mockSyncState.blockedCount = 1;

    const { result } = renderHook(() => useSyncSheetDetails(null));

    expect(result.current.statusLabel).toBe('Needs attention');
    expect(result.current.description).toBe(
      'Some memories need your attention before they can be safely stored.'
    );
    expect(result.current.showDiagnostics).toBe(true);
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

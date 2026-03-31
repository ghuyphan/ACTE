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
  isEnabled: true,
  setSyncEnabled: jest.fn(),
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
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
    mockSyncState.isEnabled = true;
    mockSyncState.setSyncEnabled.mockClear();
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

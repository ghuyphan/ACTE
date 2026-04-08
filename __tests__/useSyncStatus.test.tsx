import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, AppStateStatus } from 'react-native';
import { ReactNode } from 'react';
import i18n from '../constants/i18n';
import { SyncStatusProvider, useSyncStatus } from '../hooks/useSyncStatus';

const mockSyncNotes = jest.fn<Promise<unknown>, [unknown, unknown, unknown?]>();
const mockRefreshNotes = jest.fn<Promise<void>, [boolean?]>(async () => undefined);
const mockQueueStats = {
  pendingCount: 0,
  failedCount: 0,
  blockedCount: 0,
};

let appStateListener: ((state: AppStateStatus) => void) | null = null;

const mockAuthState = {
  user: null as null | {
    uid: string;
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
  },
  isReady: true,
  isAuthAvailable: true,
};

const mockNotesState = {
  notes: [] as Array<{
    id: string;
    type: 'text';
    content: string;
    photoLocalUri: null;
    photoRemoteBase64: null;
    locationName: string | null;
    latitude: number;
    longitude: number;
    radius: number;
    isFavorite: boolean;
    createdAt: string;
    updatedAt: string | null;
  }>,
  loading: false,
  refreshNotes: (showLoading?: boolean) => mockRefreshNotes(showLoading),
};
const mockConnectivityState = {
  status: 'online' as 'online' | 'offline' | 'unknown',
  isOnline: true,
  isInternetReachable: true as boolean | null,
  lastChangedAt: null as string | null,
};

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('../hooks/useConnectivity', () => ({
  useConnectivity: () => mockConnectivityState,
}));

jest.mock('../hooks/useNotes', () => ({
  useNotes: () => mockNotesState,
}));

jest.mock('../services/syncService', () => ({
  syncNotes: (user: unknown, notes: unknown, options?: unknown) =>
    mockSyncNotes(user, notes, options),
  getSyncRepository: () => ({
    getStats: async () => ({
      pendingCount: mockQueueStats.pendingCount,
      failedCount: mockQueueStats.failedCount,
      blockedCount: mockQueueStats.blockedCount,
    }),
    listRecent: async () => [],
  }),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <SyncStatusProvider>{children}</SyncStatusProvider>;
}

function createNote(id: string) {
  return {
    id,
    type: 'text' as const,
    content: `note ${id}`,
    photoLocalUri: null,
    photoRemoteBase64: null,
    locationName: 'Saigon',
    latitude: 10.77,
    longitude: 106.69,
    radius: 150,
    isFavorite: false,
    createdAt: '2026-03-10T00:00:00.000Z',
    updatedAt: null,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue('true');
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  mockAuthState.user = null;
  mockAuthState.isReady = true;
  mockAuthState.isAuthAvailable = true;
  mockNotesState.notes = [];
  mockNotesState.loading = false;
  mockConnectivityState.status = 'online';
  mockConnectivityState.isOnline = true;
  mockConnectivityState.isInternetReachable = true;
  mockConnectivityState.lastChangedAt = null;
  mockQueueStats.pendingCount = 0;
  mockQueueStats.failedCount = 0;
  mockQueueStats.blockedCount = 0;
  mockSyncNotes.mockResolvedValue({
    status: 'success',
    syncedCount: 0,
    importedCount: 0,
    uploadedCount: 0,
    failedCount: 0,
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener: (state: AppStateStatus) => void) => {
    appStateListener = listener;
    return {
      remove: jest.fn(),
    };
  });
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
  appStateListener = null;
});

async function flushSyncPref() {
  await act(async () => {
    jest.runOnlyPendingTimers();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useSyncStatus', () => {
  it('does not sync while signed out', async () => {
    renderHook(() => useSyncStatus(), { wrapper });
    await flushSyncPref();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockSyncNotes).not.toHaveBeenCalled();
  });

  it('triggers an initial sync after auth restoration', async () => {
    mockAuthState.user = {
      uid: 'user-1',
      displayName: 'Huy',
      email: 'huy@example.com',
      photoURL: null,
    };

    const { result } = renderHook(() => useSyncStatus(), { wrapper });
    await flushSyncPref();

    await waitFor(() => {
      expect(mockSyncNotes).toHaveBeenCalledTimes(1);
      expect(result.current.status).toBe('success');
    });
  });

  it('debounces sync after note mutations', async () => {
    mockAuthState.user = {
      uid: 'user-1',
      displayName: 'Huy',
      email: 'huy@example.com',
      photoURL: null,
    };

    const { rerender } = renderHook(({ marker }: { marker: number }) => {
      void marker;
      return useSyncStatus();
    }, { wrapper, initialProps: { marker: 0 } });
    await flushSyncPref();

    await waitFor(() => {
      expect(mockSyncNotes).toHaveBeenCalledTimes(1);
    });

    mockSyncNotes.mockClear();
    mockNotesState.notes = [createNote('note-1')];
    rerender({ marker: 1 });

    act(() => {
      jest.advanceTimersByTime(1100);
    });

    expect(mockSyncNotes).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(mockSyncNotes).toHaveBeenCalledTimes(1);
    });
  });

  it('retries sync when the app becomes active', async () => {
    mockAuthState.user = {
      uid: 'user-1',
      displayName: 'Huy',
      email: 'huy@example.com',
      photoURL: null,
    };

    renderHook(() => useSyncStatus(), { wrapper });
    await flushSyncPref();

    await waitFor(() => {
      expect(mockSyncNotes).toHaveBeenCalledTimes(1);
    });

    mockSyncNotes.mockClear();

    await act(async () => {
      appStateListener?.('active');
    });

    await waitFor(() => {
      expect(mockSyncNotes).toHaveBeenCalledTimes(1);
    });
  });

  it('coalesces concurrent sync attempts into a single follow-up run', async () => {
    mockAuthState.user = {
      uid: 'user-1',
      displayName: 'Huy',
      email: 'huy@example.com',
      photoURL: null,
    };

    let resolveSync!: (value: unknown) => void;
    mockSyncNotes.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSync = resolve;
        })
    );

    const { rerender } = renderHook(({ marker }: { marker: number }) => {
      void marker;
      return useSyncStatus();
    }, { wrapper, initialProps: { marker: 0 } });
    await flushSyncPref();

    await waitFor(() => {
      expect(mockSyncNotes).toHaveBeenCalledTimes(1);
    });

    mockNotesState.notes = [createNote('note-1')];
    rerender({ marker: 1 });

    act(() => {
      jest.advanceTimersByTime(1300);
    });

    expect(mockSyncNotes).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSync({
        status: 'success',
        syncedCount: 1,
        importedCount: 0,
        uploadedCount: 1,
        failedCount: 0,
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockSyncNotes).toHaveBeenCalledTimes(2);
    });
  });

  it('uses refreshed queue stats when composing the post-sync status message', async () => {
    mockAuthState.user = {
      uid: 'user-1',
      displayName: 'Huy',
      email: 'huy@example.com',
      photoURL: null,
    };
    mockQueueStats.pendingCount = 2;
    mockSyncNotes.mockResolvedValue({
      status: 'success',
      message: 'Everything synced.',
      syncedCount: 1,
      importedCount: 0,
      uploadedCount: 1,
      failedCount: 0,
    });

    const { result } = renderHook(() => useSyncStatus(), { wrapper });
    await flushSyncPref();

    await waitFor(() => {
      expect(mockSyncNotes).toHaveBeenCalled();
      expect(result.current.lastMessage).toBe(
        i18n.t(
          'settings.syncPendingOffline',
          'Your notes are saved locally and will sync when you are back online.'
        )
      );
    });
  });

  it('surfaces the offline pending message for a manual sync request', async () => {
    mockAuthState.user = {
      uid: 'user-1',
      displayName: 'Huy',
      email: 'huy@example.com',
      photoURL: null,
    };
    mockConnectivityState.status = 'offline';
    mockConnectivityState.isOnline = false;
    mockConnectivityState.isInternetReachable = false;
    mockQueueStats.pendingCount = 1;

    const { result } = renderHook(() => useSyncStatus(), { wrapper });
    await flushSyncPref();

    await act(async () => {
      result.current.requestSync();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.lastMessage).toBe(
        i18n.t(
          'settings.syncPendingOffline',
          'Your notes are saved locally and will sync when you are back online.'
        )
      );
    });
    expect(mockSyncNotes).not.toHaveBeenCalled();
  });
});

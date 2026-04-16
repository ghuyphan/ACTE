import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import HomeScreen from '../app/(tabs)/index';

const mockPush = jest.fn();
const mockShowAlert = jest.fn();
const mockGetPersistentItem = jest.fn<Promise<string | null>, [string]>(async () => null);
const mockSetPersistentItem = jest.fn<Promise<void>, [string, string]>(async () => undefined);
const mockTranslate = (key: string, fallback?: string) => fallback ?? key;

function buildNote(overrides: Record<string, unknown> = {}) {
  return {
    id: 'note-1',
    type: 'text',
    content: 'Remember this place',
    locationName: 'District 1',
    latitude: 10.7626,
    longitude: 106.6601,
    radius: 150,
    isFavorite: false,
    createdAt: '2026-03-10T10:00:00.000Z',
    updatedAt: null,
    ...overrides,
  };
}

let mockAuthState = {
  user: { uid: 'user-1' },
  isAuthAvailable: true,
};

let mockNotesStoreState = {
  loading: false,
  notes: [] as Array<Record<string, unknown>>,
  refreshNotes: jest.fn(async () => undefined),
  createNote: jest.fn(async () => undefined),
  initialLoadComplete: true,
};

let mockSharedFeedStoreState = {
  enabled: true,
  loading: false,
  ready: true,
  initialLoadComplete: true,
  friends: [] as Array<Record<string, unknown>>,
  sharedPosts: [] as Array<Record<string, unknown>>,
  activeInvite: null,
  refreshSharedFeed: jest.fn(async () => undefined),
  createFriendInvite: jest.fn(async () => undefined),
  revokeFriendInvite: jest.fn(async () => undefined),
  removeFriend: jest.fn(async () => undefined),
  createSharedPost: jest.fn(async () => undefined),
};

let mockSyncStatusState = {
  bootstrapState: 'complete' as
    | 'idle'
    | 'preparing'
    | 'syncing'
    | 'disabled'
    | 'offline'
    | 'error'
    | 'complete',
  status: 'idle' as 'idle' | 'syncing' | 'success' | 'error',
  isInitialSyncPending: false,
  requestSync: jest.fn(),
};

let mockGeofenceState = {
  location: null as null,
  remindersEnabled: false,
  requestForegroundLocation: jest.fn(async () => ({ location: null, requiresSettings: false })),
  requestReminderPermissions: jest.fn(async () => ({ enabled: false, requiresSettings: false })),
  openAppSettings: jest.fn(async () => undefined),
};

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useFocusEffect: (callback: () => void | (() => void)) => {
    const cleanup = callback();
    return cleanup ?? undefined;
  },
  useScrollToTop: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockTranslate,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => mockPush(...args),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
  },
  NotificationFeedbackType: {
    Success: 'success',
  },
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    isDark: false,
    colors: {
      background: '#FAF9F6',
      surface: '#FFFFFF',
      card: '#FFFFFF',
      text: '#1C1C1E',
      secondaryText: '#8E8E93',
      primary: '#FFC107',
      primarySoft: 'rgba(255,193,7,0.15)',
      accent: '#FF9F0A',
      border: '#E5E5EA',
      danger: '#FF3B30',
      success: '#34C759',
      gradient: ['#FFC107', '#FF9F0A'],
      captureButtonBg: '#1C1C1E',
      tabBarBg: 'rgba(250,249,246,0.92)',
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
      androidTabShellMutedBorder: 'rgba(0,0,0,0.1)',
      androidTabShellMutedBackground: 'rgba(255,255,255,0.8)',
      androidTabShellActive: '#1C1C1E',
    },
  }),
}));

jest.mock('../hooks/app/useHomeStartupReady', () => ({
  useHomeStartupReady: () => ({
    homeFeedReady: false,
    markHomeFeedReady: jest.fn(),
    resetHomeFeedReady: jest.fn(),
  }),
}));

jest.mock('../hooks/app/useHomeSharedActions', () => ({
  useHomeSharedActions: () => ({
    handleCaptureTargetChange: jest.fn(),
    handleCreateInvite: jest.fn(),
    handleOpenSharedManage: jest.fn(),
    handleRemoveFriend: jest.fn(),
    handleRevokeInvite: jest.fn(),
    handleShareInvite: jest.fn(),
    inviteActionInFlight: false,
  }),
}));

jest.mock('../hooks/useAppSheetAlert', () => ({
  useAppSheetAlert: () => ({
    alertProps: {},
    showAlert: mockShowAlert,
  }),
}));

jest.mock('../hooks/useActiveFeedTarget', () => ({
  useActiveFeedTarget: () => ({
    setActiveFeedTarget: jest.fn(),
    clearActiveFeedTarget: jest.fn(),
  }),
}));

jest.mock('../hooks/useBottomTabVisualInset', () => ({
  useBottomTabVisualInset: () => 0,
}));

jest.mock('../hooks/useCaptureFlow', () => ({
  useCaptureFlow: () => {
    const createSharedValue = (value: number) => ({ value } as any);
    return {
      captureMode: 'text',
      cameraSessionKey: 0,
      noteText: '',
      setNoteText: jest.fn(),
      capturedPhoto: null,
      setCapturedPhoto: jest.fn(),
      capturedPairedVideo: null,
      setCapturedPairedVideo: jest.fn(),
      radius: 150,
      setRadius: jest.fn(),
      facing: 'back',
      setFacing: jest.fn(),
      selectedPhotoFilterId: null,
      setSelectedPhotoFilterId: jest.fn(),
      cameraDevice: null,
      permission: { granted: true, canAskAgain: true },
      requestPermission: jest.fn(),
      cameraRef: { current: null },
      captureScale: createSharedValue(1),
      captureTranslateY: createSharedValue(0),
      shutterScale: createSharedValue(1),
      isModeSwitchAnimating: false,
      toggleCaptureMode: jest.fn(),
      handleShutterPressIn: jest.fn(),
      handleShutterPressOut: jest.fn(),
      takePicture: jest.fn(),
      startLivePhotoCapture: jest.fn(),
      isStillPhotoCaptureInProgress: false,
      isLivePhotoCaptureInProgress: false,
      isLivePhotoCaptureSettling: false,
      isLivePhotoSaveGuardActive: false,
      needsCameraPermission: false,
      resetCapture: jest.fn(),
    };
  },
}));

jest.mock('../hooks/useFeedFocus', () => ({
  useFeedFocus: () => ({
    clearFeedFocus: jest.fn(),
    peekFeedFocus: jest.fn(() => null),
  }),
}));

jest.mock('../hooks/useGeofence', () => ({
  useGeofence: () => mockGeofenceState,
}));

jest.mock('../hooks/useNoteDetailSheet', () => ({
  useNoteDetailSheet: () => ({
    openNoteDetail: jest.fn(),
  }),
}));

jest.mock('../hooks/useNotes', () => ({
  useNotesStore: () => mockNotesStoreState,
}));

jest.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

jest.mock('../hooks/useSharedFeed', () => ({
  useSharedFeedStore: () => mockSharedFeedStoreState,
}));

jest.mock('../hooks/useSubscription', () => ({
  useSubscription: () => ({
    tier: 'free',
    isConfigured: false,
    isPurchaseAvailable: false,
    plusPriceLabel: null,
    remotePhotoNoteCount: 0,
    isRemotePhotoNoteCountReady: true,
    presentPaywallIfNeeded: jest.fn(async () => ({ action: 'not-presented' })),
    restorePurchases: jest.fn(async () => ({ status: 'unavailable' })),
  }),
}));

jest.mock('../hooks/useSyncStatus', () => ({
  useSyncStatus: () => mockSyncStatusState,
}));

jest.mock('../hooks/ui/useSavedNoteRevealUi', () => ({
  useSavedNoteRevealUi: () => ({
    setSavedNoteRevealActive: jest.fn(),
  }),
}));

jest.mock('../components/home/CaptureCard', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: React.forwardRef(function MockCaptureCard(_props: any, _ref: any) {
      return <View testID="capture-card" />;
    }),
  };
});

jest.mock('../components/home/HomeHeaderSearch', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockHomeHeaderSearch() {
    return <View testID="home-header-search" />;
  };
});

jest.mock('../components/home/NotesFeed', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockNotesFeed(props: { emptyState?: React.ReactNode }) {
    return <View testID="notes-feed">{props.emptyState ?? null}</View>;
  };
});

jest.mock('../components/home/SavedNotePolaroidReveal', () => {
  return function MockSavedNotePolaroidReveal() {
    return null;
  };
});

jest.mock('../components/home/SharedManageSheet', () => {
  return function MockSharedManageSheet() {
    return null;
  };
});

jest.mock('../components/sheets/AppSheetAlert', () => {
  return function MockAppSheetAlert() {
    return null;
  };
});

jest.mock('../services/sharedFeedService', () => ({
  getSharedFeedErrorMessage: jest.fn(() => 'Shared feed unavailable'),
}));

jest.mock('../utils/appStorage', () => ({
  getPersistentItem: (key: string) => mockGetPersistentItem(key),
  setPersistentItem: (key: string, value: string) => mockSetPersistentItem(key, value),
  removePersistentItem: jest.fn(async () => undefined),
}));

describe('HomeScreen empty state', () => {
  async function renderHomeScreen() {
    const screen = render(<HomeScreen />);

    await act(async () => {
      await Promise.resolve();
    });

    return screen;
  }

  beforeEach(() => {
    mockPush.mockReset();
    mockShowAlert.mockReset();
    mockGetPersistentItem.mockReset();
    mockSetPersistentItem.mockReset();
    mockGetPersistentItem.mockResolvedValue(null);
    mockSetPersistentItem.mockResolvedValue(undefined);
    mockAuthState = {
      user: { uid: 'user-1' },
      isAuthAvailable: true,
    };
    mockNotesStoreState = {
      loading: false,
      notes: [],
      refreshNotes: jest.fn(async () => undefined),
      createNote: jest.fn(async () => undefined),
      initialLoadComplete: true,
    };
    mockSharedFeedStoreState = {
      enabled: true,
      loading: false,
      ready: true,
      initialLoadComplete: true,
      friends: [],
      sharedPosts: [],
      activeInvite: null,
      refreshSharedFeed: jest.fn(async () => undefined),
      createFriendInvite: jest.fn(async () => undefined),
      revokeFriendInvite: jest.fn(async () => undefined),
      removeFriend: jest.fn(async () => undefined),
      createSharedPost: jest.fn(async () => undefined),
    };
    mockSyncStatusState = {
      bootstrapState: 'complete',
      status: 'idle',
      isInitialSyncPending: false,
      requestSync: jest.fn(),
    };
    mockGeofenceState = {
      location: null,
      remindersEnabled: false,
      requestForegroundLocation: jest.fn(async () => ({ location: null, requiresSettings: false })),
      requestReminderPermissions: jest.fn(async () => ({ enabled: false, requiresSettings: false })),
      openAppSettings: jest.fn(async () => undefined),
    };
  });

  it('keeps the first-note empty state visible during background shared refreshes', async () => {
    const screen = await renderHomeScreen();

    expect(screen.getByText('Your journal is waiting')).toBeTruthy();
    expect(screen.queryByText('Importing your cloud notes')).toBeNull();

    mockSharedFeedStoreState = {
      ...mockSharedFeedStoreState,
      loading: true,
    };

    await act(async () => {
      screen.rerender(<HomeScreen />);
      await Promise.resolve();
    });

    expect(screen.getByText('Your journal is waiting')).toBeTruthy();
    expect(screen.queryByText('Importing your cloud notes')).toBeNull();
  });

  it('still shows the syncing state while the initial sync is actively running', async () => {
    mockSyncStatusState = {
      bootstrapState: 'syncing',
      status: 'syncing',
      isInitialSyncPending: true,
      requestSync: jest.fn(),
    };

    const screen = await renderHomeScreen();

    expect(screen.getByText('Importing your cloud notes')).toBeTruthy();
    expect(screen.queryByText('Your journal is waiting')).toBeNull();
  });

  it('keeps the syncing state visible while the first account sync is still pending', async () => {
    mockSyncStatusState = {
      bootstrapState: 'offline',
      status: 'idle',
      isInitialSyncPending: true,
      requestSync: jest.fn(),
    };
    mockSharedFeedStoreState = {
      ...mockSharedFeedStoreState,
      initialLoadComplete: false,
    };

    const screen = await renderHomeScreen();

    expect(screen.getByText('Loading shared memories')).toBeTruthy();
    expect(screen.queryByText('Cloud sync is turned off')).toBeNull();
    expect(screen.queryByText('You are offline right now')).toBeNull();
    expect(screen.queryByText('Your journal is waiting')).toBeNull();
  });

  it('keeps the importing copy visible while signed-in notes are still hydrating', async () => {
    mockSyncStatusState = {
      bootstrapState: 'syncing',
      status: 'syncing',
      isInitialSyncPending: true,
      requestSync: jest.fn(),
    };
    mockNotesStoreState = {
      ...mockNotesStoreState,
      loading: true,
      initialLoadComplete: false,
    };

    const screen = await renderHomeScreen();

    expect(screen.getByText('Importing your cloud notes')).toBeTruthy();
    expect(screen.queryByText('Loading your notes')).toBeNull();
  });

  it('shows an explicit blocked state when the first cloud sync cannot run offline', async () => {
    mockSyncStatusState = {
      bootstrapState: 'offline',
      status: 'idle',
      isInitialSyncPending: true,
      requestSync: jest.fn(),
    };

    const screen = await renderHomeScreen();

    expect(screen.getByText('You are offline right now')).toBeTruthy();
    expect(screen.queryByText('Your journal is waiting')).toBeNull();
  });

  it('prompts once to enable reminders when existing saved places load without reminder permissions', async () => {
    mockNotesStoreState = {
      ...mockNotesStoreState,
      notes: [buildNote()],
    };

    await renderHomeScreen();

    await waitFor(() => {
      expect(mockGetPersistentItem).toHaveBeenCalledWith(
        'noto.home.reminder-recovery-prompt.v1.user-1'
      );
    });
  });

  it('waits until the first account sync settles before checking reminder recovery for restored notes', async () => {
    mockNotesStoreState = {
      ...mockNotesStoreState,
      notes: [buildNote()],
    };
    mockSyncStatusState = {
      ...mockSyncStatusState,
      bootstrapState: 'syncing',
      isInitialSyncPending: true,
    };

    const screen = await renderHomeScreen();

    expect(mockGetPersistentItem).not.toHaveBeenCalledWith(
      'noto.home.reminder-recovery-prompt.v1.user-1'
    );

    mockSyncStatusState = {
      ...mockSyncStatusState,
      bootstrapState: 'complete',
      isInitialSyncPending: false,
    };

    await act(async () => {
      screen.rerender(<HomeScreen />);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockGetPersistentItem).toHaveBeenCalledWith(
        'noto.home.reminder-recovery-prompt.v1.user-1'
      );
    });
  });

  it('does not show the reminder recovery prompt when reminders are already enabled', async () => {
    mockNotesStoreState = {
      ...mockNotesStoreState,
      notes: [buildNote()],
    };
    mockGeofenceState = {
      ...mockGeofenceState,
      remindersEnabled: true,
    };

    await renderHomeScreen();

    expect(mockShowAlert).not.toHaveBeenCalled();
  });
});

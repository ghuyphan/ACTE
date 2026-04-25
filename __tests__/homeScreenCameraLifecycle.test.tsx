import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, Platform } from 'react-native';
let mockCaptureCardProps: any = null;
let mockCaptureCardHandle: any = null;
const mockNotes: any[] = [];
let mockNotesLoading = false;
let mockNotesInitialLoadComplete = true;
let mockUser: any = null;
let mockSharedLoading = false;
let mockSharedReady = true;
const mockSharedPosts: any[] = [];
const mockFriends: any[] = [];
const mockOpenAppSettings = jest.fn(async () => undefined);
const mockRequestPermission = jest.fn(async () => ({ granted: true, canAskAgain: true }));
const mockShowAlert = jest.fn();
const mockUseCaptureFlow = jest.fn();
const mockGetPersistentItem = jest.fn<Promise<string | null>, [string]>(async (_key: string) => null);
const mockRemovePersistentItem = jest.fn(async (_key: string) => undefined);
const mockSetPersistentItem = jest.fn(async (_key: string, _value: string) => undefined);
const mockScrollToOffset = jest.fn();
const mockCaptureCardResetStickers = jest.fn();
const mockCaptureCardRestoreStickers = jest.fn();
const mockCaptureCardGetStickerSnapshot = jest.fn<{ enabled: boolean; placements: any[] }, []>(
  () => ({ enabled: false, placements: [] })
);
let mockSyncBootstrapState:
  | 'complete'
  | 'preparing'
  | 'syncing'
  | 'disabled'
  | 'offline'
  | 'error' = 'complete';
const originalRequestAnimationFrame = global.requestAnimationFrame;
const originalRequestIdleCallback = (global as any).requestIdleCallback;
const originalCancelIdleCallback = (global as any).cancelIdleCallback;

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
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
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
  useAuth: () => ({
    user: mockUser,
    isAuthAvailable: true,
  }),
}));

jest.mock('../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    phase: 'idle',
    bootstrapState: mockSyncBootstrapState,
    status: 'idle',
    isInitialSyncPending: false,
    requestSync: jest.fn(),
  }),
}));

jest.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
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

jest.mock('../hooks/useGeofence', () => ({
  useGeofence: () => ({
    location: null,
    remindersEnabled: false,
    requestForegroundLocation: jest.fn(async () => ({ location: null, requiresSettings: false })),
    requestReminderPermissions: jest.fn(async () => ({ enabled: false, requiresSettings: false })),
    openAppSettings: mockOpenAppSettings,
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

jest.mock('../hooks/useNoteDetailSheet', () => ({
  useNoteDetailSheet: () => ({
    openNoteDetail: jest.fn(),
  }),
}));

jest.mock('../hooks/useFeedFocus', () => ({
  useFeedFocus: () => ({
    consumeFeedFocus: jest.fn(() => null),
  }),
}));

jest.mock('../hooks/useCaptureFlow', () => ({
  useCaptureFlow: (...args: any[]) => mockUseCaptureFlow(...args),
}));

jest.mock('../utils/appStorage', () => ({
  getPersistentItem: (key: string) => mockGetPersistentItem(key),
  getPersistentItemSync: () => undefined,
  removePersistentItem: (key: string) => mockRemovePersistentItem(key),
  setPersistentItem: (key: string, value: string) => mockSetPersistentItem(key, value),
}));

jest.mock('../services/dualCamera', () => ({
  getDualCameraAvailability: jest.fn(async () => ({
    available: false,
    supported: false,
    reason: 'unsupported',
  })),
}));

jest.mock('../hooks/useNotes', () => ({
  useNotesStore: () => ({
    loading: mockNotesLoading,
    notes: mockNotes,
    refreshNotes: jest.fn(async () => undefined),
    createNote: jest.fn(async () => undefined),
    searchNotes: jest.fn(async () => mockNotes),
    initialLoadComplete: mockNotesInitialLoadComplete,
  }),
}));

jest.mock('../hooks/useSubscription', () => ({
  useSubscription: () => ({
    tier: 'free',
    isConfigured: false,
    isPurchaseAvailable: false,
    isPurchaseInFlight: false,
    plusPriceLabel: null,
    canImportFromLibrary: false,
    remotePhotoNoteCount: 0,
    isRemotePhotoNoteCountReady: true,
    purchasePlus: jest.fn(async () => ({ status: 'unavailable' })),
    restorePurchases: jest.fn(async () => ({ status: 'unavailable' })),
  }),
}));

jest.mock('../hooks/useSharedFeed', () => ({
  useSharedFeedStore: () => ({
    enabled: true,
    loading: mockSharedLoading,
    ready: mockSharedReady,
    friends: mockFriends,
    sharedPosts: mockSharedPosts,
    activeInvite: null,
    refreshSharedFeed: jest.fn(async () => undefined),
    createFriendInvite: jest.fn(async () => undefined),
    revokeFriendInvite: jest.fn(async () => undefined),
    acceptFriendInvite: jest.fn(async () => undefined),
    removeFriend: jest.fn(async () => undefined),
    createSharedPost: jest.fn(async () => undefined),
  }),
}));

jest.mock('../services/sharedFeedService', () => ({
  getSharedFeedErrorMessage: jest.fn(() => 'Shared moments are unavailable right now.'),
}));

jest.mock('../components/sheets/AppSheetAlert', () => {
  return function MockAppSheetAlert() {
    return null;
  };
});

jest.mock('../components/home/CaptureCard', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: React.forwardRef(function MockCaptureCard(props: any, ref: any) {
      mockCaptureCardProps = props;
      mockCaptureCardHandle = {
        getDoodleSnapshot: jest.fn(() => ({ enabled: false, strokes: [] })),
        getStickerSnapshot: mockCaptureCardGetStickerSnapshot,
        resetDoodle: jest.fn(),
        resetStickers: mockCaptureCardResetStickers,
        restoreStickers: mockCaptureCardRestoreStickers,
        closeDecorateControls: jest.fn(() => {
          props.onTextEntryFocusChange?.(false);
          props.onDoodleModeChange?.(false);
          props.onGestureActiveChange?.(false);
        }),
      };
      React.useImperativeHandle(ref, () => mockCaptureCardHandle, [props]);
      return <Text testID="camera-preview-state">{String(props.isCameraPreviewActive)}</Text>;
    }),
  };
});

jest.mock('../components/ui/CatBoxIcon', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockCatBoxIcon() {
    return <View testID="cat-box-empty-icon" />;
  };
});

jest.mock('../components/home/HomeHeaderSearch', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');
  return function MockHomeHeaderSearch(props: any) {
    return (
      <View>
        <View testID="home-header-search" />
        <Pressable testID="toggle-capture-mode" onPress={() => props.onToggleCaptureMode?.()} />
      </View>
    );
  };
});

jest.mock('../components/home/NotesFeed', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  return function MockNotesFeed(props: any) {
    if (props.flatListRef) {
      props.flatListRef.current = {
        scrollToOffset: mockScrollToOffset,
      };
    }

    return (
      <View>
        {props.captureHeader}
        <Text testID="capture-scroll-enabled">{String(props.scrollEnabled)}</Text>
        <Text testID="notes-feed-has-empty-state">{String(Boolean(props.emptyState))}</Text>
        {props.emptyState}
        <Pressable testID="hide-capture" onPress={() => props.onCaptureVisibilityChange?.(false)} />
        <Pressable testID="show-capture" onPress={() => props.onCaptureVisibilityChange?.(true)} />
        <Pressable
          testID="unsettle-capture"
          onPress={() => props.onCaptureScrollSettledChange?.(false)}
        />
        <Pressable
          testID="settle-capture"
          onPress={() => props.onCaptureScrollSettledChange?.(true)}
        />
      </View>
    );
  };
});

jest.mock('../components/home/SavedNotePolaroidReveal', () => {
  return function MockSavedNotePolaroidReveal() {
    return null;
  };
});

jest.mock('../components/home/SharedManageSheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockSharedManageSheet() {
    return <View testID="shared-manage-sheet" />;
  };
});

jest.mock('../utils/platform', () => ({
  isIOS26OrNewer: false,
}));

import HomeScreen from '../app/(tabs)/index';

describe('HomeScreen camera lifecycle', () => {
  beforeEach(() => {
    (global as any).requestIdleCallback = jest.fn((callback: any) => {
      callback({ didTimeout: false, timeRemaining: () => 50 });
      return 1;
    });
    (global as any).cancelIdleCallback = jest.fn();
    global.requestAnimationFrame = ((callback: any) => {
      callback(0);
      return 0;
    }) as typeof requestAnimationFrame;
    AppState.currentState = 'active';
    mockNotesLoading = false;
    mockNotesInitialLoadComplete = true;
    mockUser = null;
    mockSharedLoading = false;
    mockSharedReady = true;
    mockNotes.splice(0, mockNotes.length);
    mockSharedPosts.splice(0, mockSharedPosts.length);
    mockFriends.splice(0, mockFriends.length);
    mockCaptureCardProps = null;
    mockCaptureCardHandle = null;
    mockOpenAppSettings.mockClear();
    mockRequestPermission.mockClear();
    mockShowAlert.mockClear();
    mockGetPersistentItem.mockReset();
    mockRemovePersistentItem.mockClear();
    mockSetPersistentItem.mockClear();
    mockScrollToOffset.mockClear();
    mockCaptureCardResetStickers.mockClear();
    mockCaptureCardRestoreStickers.mockClear();
    mockCaptureCardGetStickerSnapshot.mockReset();
    mockCaptureCardGetStickerSnapshot.mockReturnValue({ enabled: false, placements: [] });
    mockSyncBootstrapState = 'complete';
    mockRequestPermission.mockResolvedValue({ granted: true, canAskAgain: true });
    mockGetPersistentItem.mockResolvedValue(null);
    mockUseCaptureFlow.mockImplementation(() => {
      const createSharedValue = (value: number) => ({ value } as any);
      return {
        captureScale: createSharedValue(1),
        captureTranslateY: createSharedValue(0),
        shutterScale: createSharedValue(1),
        captureMode: 'camera',
        cameraSubmode: 'single',
        cameraSessionKey: 1,
        setCaptureMode: jest.fn(),
        setCameraSubmode: jest.fn(),
        noteText: '',
        setNoteText: jest.fn(),
        capturedPhoto: null,
        setCapturedPhoto: jest.fn(),
        capturedPairedVideo: null,
        setCapturedPairedVideo: jest.fn(),
        dualPrimaryPhoto: null,
        setDualPrimaryPhoto: jest.fn(),
        dualSecondaryPhoto: null,
        setDualSecondaryPhoto: jest.fn(),
        dualPrimaryFacing: null,
        setDualPrimaryFacing: jest.fn(),
        dualSecondaryFacing: null,
        setDualSecondaryFacing: jest.fn(),
        radius: 150,
        setRadius: jest.fn(),
        facing: 'back',
        setFacing: jest.fn(),
        selectedPhotoFilterId: 'original',
        setSelectedPhotoFilterId: jest.fn(),
        cameraDevice: undefined,
        permission: { granted: true, canAskAgain: true },
        requestPermission: mockRequestPermission,
        cameraRef: { current: null },
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
        restoreCaptureState: jest.fn(),
        clearDualCaptureState: jest.fn(),
      };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.requestAnimationFrame = originalRequestAnimationFrame;
    (global as any).requestIdleCallback = originalRequestIdleCallback;
    (global as any).cancelIdleCallback = originalCancelIdleCallback;
  });

  it('pauses the camera preview when the capture card scrolls out of view', async () => {
    const { getByTestId } = render(<HomeScreen />);

    expect(getByTestId('camera-preview-state')).toHaveTextContent('true');
    expect(mockCaptureCardProps?.isCameraPreviewActive).toBe(true);

    fireEvent.press(getByTestId('hide-capture'));

    await waitFor(() => {
      expect(getByTestId('camera-preview-state')).toHaveTextContent('false');
      expect(mockCaptureCardProps?.isCameraPreviewActive).toBe(false);
    });

    fireEvent.press(getByTestId('show-capture'));

    await waitFor(() => {
      expect(getByTestId('camera-preview-state')).toHaveTextContent('true');
      expect(mockCaptureCardProps?.isCameraPreviewActive).toBe(true);
    });
  });

  it('keeps the preview mounted but blocks reveal until the capture scroll settles again', async () => {
    const { getByTestId } = render(<HomeScreen />);

    expect(mockCaptureCardProps?.isCameraPreviewActive).toBe(true);
    expect(mockCaptureCardProps?.isCameraRevealAllowed).toBe(true);

    fireEvent.press(getByTestId('unsettle-capture'));

    await waitFor(() => {
      expect(mockCaptureCardProps?.isCameraPreviewActive).toBe(true);
      expect(mockCaptureCardProps?.isCameraRevealAllowed).toBe(false);
    });

    fireEvent.press(getByTestId('settle-capture'));

    await waitFor(() => {
      expect(mockCaptureCardProps?.isCameraPreviewActive).toBe(true);
      expect(mockCaptureCardProps?.isCameraRevealAllowed).toBe(true);
    });
  });

  it('pauses the live preview while the app is temporarily inactive', () => {
    AppState.currentState = 'inactive';

    render(<HomeScreen />);

    expect(mockCaptureCardProps).toBeTruthy();
    expect(mockCaptureCardProps?.isCameraPreviewActive).toBe(false);
  });

  it('releases active capture locks before switching modes', () => {
    const { getByTestId } = render(<HomeScreen />);

    expect(getByTestId('capture-scroll-enabled')).toHaveTextContent('true');

    act(() => {
      mockCaptureCardProps?.onGestureActiveChange?.(true);
    });
    expect(getByTestId('capture-scroll-enabled')).toHaveTextContent('false');

    act(() => {
      fireEvent.press(getByTestId('toggle-capture-mode'));
    });

    expect(getByTestId('capture-scroll-enabled')).toHaveTextContent('true');
  });

  it('keeps photo import available on the free plan while locking premium filters', () => {
    render(<HomeScreen />);

    expect(mockCaptureCardProps?.libraryImportLocked).toBe(false);
    expect(mockCaptureCardProps?.lockedPhotoFilterIds).toEqual(
      expect.arrayContaining(['warm', 'cool', 'mono', 'vivid', 'vintage'])
    );
  });

  it('allows the capture share target to toggle back without a transition lock', async () => {
    mockUser = { uid: 'me' };
    mockFriends.push({ userId: 'friend-1', displayName: 'Friend' });

    render(<HomeScreen />);

    act(() => {
      mockCaptureCardProps?.onChangeShareTarget?.('shared');
    });

    await waitFor(() => {
      expect(mockCaptureCardProps?.shareTarget).toBe('shared');
    });

    act(() => {
      mockCaptureCardProps?.onChangeShareTarget?.('private');
    });

    await waitFor(() => {
      expect(mockCaptureCardProps?.shareTarget).toBe('private');
    });
  });

  it('keeps capture controls locked while a sequential dual capture advances state', async () => {
    const originalPlatform = Platform.OS;
    let resolveCapture: ((uri: string | null) => void) | null = null;
    const capturePhotoFile = jest.fn(
      () => new Promise<string | null>((resolve) => {
        resolveCapture = resolve;
      })
    );
    Platform.OS = 'android';
    mockUseCaptureFlow.mockImplementation(() => {
      const createSharedValue = (value: number) => ({ value } as any);
      return {
        captureScale: createSharedValue(1),
        captureTranslateY: createSharedValue(0),
        shutterScale: createSharedValue(1),
        captureMode: 'camera',
        cameraSubmode: 'dual',
        cameraSessionKey: 1,
        setCaptureMode: jest.fn(),
        setCameraSubmode: jest.fn(),
        noteText: '',
        setNoteText: jest.fn(),
        capturedPhoto: null,
        setCapturedPhoto: jest.fn(),
        capturedPairedVideo: null,
        setCapturedPairedVideo: jest.fn(),
        dualPrimaryPhoto: null,
        setDualPrimaryPhoto: jest.fn(),
        dualSecondaryPhoto: null,
        setDualSecondaryPhoto: jest.fn(),
        dualPrimaryFacing: null,
        setDualPrimaryFacing: jest.fn(),
        dualSecondaryFacing: null,
        setDualSecondaryFacing: jest.fn(),
        radius: 150,
        setRadius: jest.fn(),
        facing: 'back',
        setFacing: jest.fn(),
        selectedPhotoFilterId: 'original',
        setSelectedPhotoFilterId: jest.fn(),
        cameraDevice: undefined,
        backCameraDeviceId: 'back-camera',
        frontCameraDeviceId: 'front-camera',
        permission: { granted: true, canAskAgain: true },
        requestPermission: mockRequestPermission,
        cameraRef: { current: null },
        isModeSwitchAnimating: false,
        toggleCaptureMode: jest.fn(),
        handleShutterPressIn: jest.fn(),
        handleShutterPressOut: jest.fn(),
        takePicture: jest.fn(),
        capturePhotoFile,
        startLivePhotoCapture: jest.fn(),
        isStillPhotoCaptureInProgress: false,
        isLivePhotoCaptureInProgress: false,
        isLivePhotoCaptureSettling: false,
        isLivePhotoSaveGuardActive: false,
        needsCameraPermission: false,
        resetCapture: jest.fn(),
        restoreCaptureState: jest.fn(),
        clearDualCaptureState: jest.fn(),
      };
    });

    try {
      render(<HomeScreen />);

      act(() => {
        mockCaptureCardProps?.onTakePicture?.();
      });

      await waitFor(() => {
        expect(capturePhotoFile).toHaveBeenCalledTimes(1);
        expect(mockCaptureCardProps?.isStillPhotoCaptureInProgress).toBe(true);
      });

      await act(async () => {
        resolveCapture?.('file:///tmp/dual-first.jpg');
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(mockCaptureCardProps?.isStillPhotoCaptureInProgress).toBe(false);
      });
    } finally {
      Platform.OS = originalPlatform;
    }
  });

  it('locks capture scrolling while a text input session is active', () => {
    const { getByTestId } = render(<HomeScreen />);

    expect(getByTestId('capture-scroll-enabled')).toHaveTextContent('true');

    act(() => {
      mockCaptureCardProps?.onTextEntryFocusChange?.(true);
    });
    expect(getByTestId('capture-scroll-enabled')).toHaveTextContent('false');

    act(() => {
      mockCaptureCardProps?.onTextEntryFocusChange?.(false);
    });
    expect(getByTestId('capture-scroll-enabled')).toHaveTextContent('true');
  });

  it('locks capture scrolling while decorate mode is open', () => {
    const { getByTestId } = render(<HomeScreen />);

    expect(getByTestId('capture-scroll-enabled')).toHaveTextContent('true');

    act(() => {
      mockCaptureCardProps?.onDoodleModeChange?.(true);
    });
    expect(getByTestId('capture-scroll-enabled')).toHaveTextContent('false');

    act(() => {
      mockCaptureCardProps?.onDoodleModeChange?.(false);
    });
    expect(getByTestId('capture-scroll-enabled')).toHaveTextContent('true');
  });

  it('locks capture scrolling while a capture gesture is active', () => {
    const { getByTestId } = render(<HomeScreen />);

    expect(getByTestId('capture-scroll-enabled')).toHaveTextContent('true');

    act(() => {
      mockCaptureCardProps?.onGestureActiveChange?.(true);
    });
    expect(getByTestId('capture-scroll-enabled')).toHaveTextContent('false');

    act(() => {
      mockCaptureCardProps?.onGestureActiveChange?.(false);
    });
    expect(getByTestId('capture-scroll-enabled')).toHaveTextContent('true');
  });

  it('shows a camera permission prompt before requesting camera access', async () => {
    render(<HomeScreen />);

    await mockCaptureCardProps.onRequestCameraPermission();

    expect(mockShowAlert).toHaveBeenCalledTimes(1);
    expect(mockShowAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Allow camera access?',
      })
    );

    await mockShowAlert.mock.calls[0][0].primaryAction.onPress();

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(mockOpenAppSettings).not.toHaveBeenCalled();
  });

  it('shows a settings prompt when camera permission is blocked', async () => {
    mockUseCaptureFlow.mockImplementation(() => {
      const createSharedValue = (value: number) => ({ value } as any);
      return {
        captureScale: createSharedValue(1),
        captureTranslateY: createSharedValue(0),
        shutterScale: createSharedValue(1),
        captureMode: 'camera',
        cameraSubmode: 'single',
        cameraSessionKey: 1,
        setCaptureMode: jest.fn(),
        setCameraSubmode: jest.fn(),
        noteText: '',
        setNoteText: jest.fn(),
        capturedPhoto: null,
        setCapturedPhoto: jest.fn(),
        capturedPairedVideo: null,
        setCapturedPairedVideo: jest.fn(),
        dualPrimaryPhoto: null,
        setDualPrimaryPhoto: jest.fn(),
        dualSecondaryPhoto: null,
        setDualSecondaryPhoto: jest.fn(),
        dualPrimaryFacing: null,
        setDualPrimaryFacing: jest.fn(),
        dualSecondaryFacing: null,
        setDualSecondaryFacing: jest.fn(),
        radius: 150,
        setRadius: jest.fn(),
        facing: 'back',
        setFacing: jest.fn(),
        selectedPhotoFilterId: 'original',
        setSelectedPhotoFilterId: jest.fn(),
        cameraDevice: undefined,
        permission: { granted: false, canAskAgain: false },
        requestPermission: mockRequestPermission,
        cameraRef: { current: null },
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
        needsCameraPermission: true,
        resetCapture: jest.fn(),
        restoreCaptureState: jest.fn(),
        clearDualCaptureState: jest.fn(),
      };
    });

    render(<HomeScreen />);

    expect(mockCaptureCardProps?.cameraPermissionRequiresSettings).toBe(true);

    await mockCaptureCardProps.onRequestCameraPermission();

    expect(mockShowAlert).toHaveBeenCalledTimes(1);
    expect(mockShowAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Camera access is blocked',
      })
    );

    await mockShowAlert.mock.calls[0][0].primaryAction.onPress();

    expect(mockOpenAppSettings).toHaveBeenCalledTimes(1);
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('shows a stable loading empty state while the first notes load is empty', () => {
    mockNotesLoading = true;

    const { getByTestId, getByText } = render(<HomeScreen />);

    expect(getByTestId('notes-feed-has-empty-state')).toHaveTextContent('true');
    expect(getByText('Loading your notes')).toBeTruthy();
  });

  it('shows a polished first-note empty state once loading finishes with no content', () => {
    const { getByTestId, getByText } = render(<HomeScreen />);

    expect(getByTestId('notes-feed-has-empty-state')).toHaveTextContent('true');
    expect(getByText('Your journal is waiting')).toBeTruthy();
    expect(getByText('Save your first note or photo to start filling this space.')).toBeTruthy();
    expect(getByText('Write')).toBeTruthy();
    expect(getByText('Photo')).toBeTruthy();
  });

  it('scrolls back to the capture page from the first-note empty state CTA', () => {
    const { getByText } = render(<HomeScreen />);

    fireEvent.press(getByText('Write'));

    expect(mockScrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: true });
  });

  it('shows a syncing empty state after login while content is still hydrating', () => {
    mockUser = { uid: 'me' };
    mockSyncBootstrapState = 'preparing';
    mockNotesLoading = true;
    mockNotesInitialLoadComplete = false;
    mockSharedLoading = true;
    mockSharedReady = false;

    const { getByTestId, getByText } = render(<HomeScreen />);

    expect(getByTestId('notes-feed-has-empty-state')).toHaveTextContent('true');
    expect(getByText('Importing your cloud notes')).toBeTruthy();
  });

  it('keeps the first-time live photo hint visible until a capture exists', async () => {
    jest.useFakeTimers();
    let currentCapturedPhoto: string | null = null;

    mockUseCaptureFlow.mockImplementation(() => {
      const createSharedValue = (value: number) => ({ value } as any);
      return {
        captureScale: createSharedValue(1),
        captureTranslateY: createSharedValue(0),
        shutterScale: createSharedValue(1),
        captureMode: 'camera',
        cameraSubmode: 'single',
        cameraSessionKey: 1,
        setCaptureMode: jest.fn(),
        setCameraSubmode: jest.fn(),
        noteText: '',
        setNoteText: jest.fn(),
        capturedPhoto: currentCapturedPhoto,
        setCapturedPhoto: jest.fn(),
        capturedPairedVideo: null,
        setCapturedPairedVideo: jest.fn(),
        dualPrimaryPhoto: null,
        setDualPrimaryPhoto: jest.fn(),
        dualSecondaryPhoto: null,
        setDualSecondaryPhoto: jest.fn(),
        dualPrimaryFacing: null,
        setDualPrimaryFacing: jest.fn(),
        dualSecondaryFacing: null,
        setDualSecondaryFacing: jest.fn(),
        radius: 150,
        setRadius: jest.fn(),
        facing: 'back',
        setFacing: jest.fn(),
        selectedPhotoFilterId: 'original',
        setSelectedPhotoFilterId: jest.fn(),
        cameraDevice: undefined,
        permission: { granted: true, canAskAgain: true },
        requestPermission: mockRequestPermission,
        cameraRef: { current: null },
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
        restoreCaptureState: jest.fn(),
        clearDualCaptureState: jest.fn(),
      };
    });

    const { rerender } = render(<HomeScreen />);

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      jest.advanceTimersByTime(160);
    });

    await waitFor(() => {
      expect(mockCaptureCardProps?.cameraInstructionText).toBe(
        'Tap for a photo. Hold for a live photo.'
      );
    });

    expect(mockSetPersistentItem).not.toHaveBeenCalled();

    currentCapturedPhoto = 'file:///documents/captured-photo.jpg';
    rerender(<HomeScreen />);

    await waitFor(() => {
      expect(mockSetPersistentItem).toHaveBeenCalledWith(
        'noto.capture.live-photo-hint-seen.v1',
        '1'
      );
      expect(mockCaptureCardProps?.cameraInstructionText).toBeNull();
    });

    jest.useRealTimers();
  });

  it('restores a sticker-only capture draft once without replaying over later sticker edits', async () => {
    const persistedSticker = {
      id: 'placement-1',
      assetId: 'asset-1',
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
      zIndex: 1,
      opacity: 1,
      outlineEnabled: true,
      motionLocked: false,
      renderMode: 'default',
      asset: {
        id: 'asset-1',
        localUri: 'file:///sticker.png',
        mimeType: 'image/png',
      },
    };
    const persistedDraft = {
      version: 1,
      captureMode: 'text',
      cameraSubmode: 'single',
      noteText: '',
      capturedPhoto: null,
      capturedPairedVideo: null,
      dualPrimaryPhoto: null,
      dualSecondaryPhoto: null,
      dualPrimaryFacing: null,
      dualSecondaryFacing: null,
      facing: 'back',
      radius: 150,
      selectedPhotoFilterId: 'original',
      noteColor: null,
      captureTarget: 'private',
      selectedSharedAudienceUserId: null,
      stickerPlacements: [persistedSticker],
    };

    mockGetPersistentItem.mockImplementation(async (key: string) => (
      key === 'noto.capture.home-draft.v1' ? JSON.stringify(persistedDraft) : null
    ));
    mockCaptureCardGetStickerSnapshot.mockReturnValue({
      enabled: true,
      placements: [persistedSticker],
    });

    render(<HomeScreen />);

    await waitFor(() => {
      expect(mockCaptureCardRestoreStickers).toHaveBeenCalledTimes(1);
    });
    expect(mockCaptureCardResetStickers).toHaveBeenCalledTimes(1);
    expect(mockCaptureCardRestoreStickers).toHaveBeenCalledWith([persistedSticker]);

    act(() => {
      mockCaptureCardProps?.onDraftChange?.();
    });

    await waitFor(() => {
      expect(mockSetPersistentItem).toHaveBeenCalledWith(
        'noto.capture.home-draft.v1',
        expect.any(String)
      );
    });
    expect(mockCaptureCardResetStickers).toHaveBeenCalledTimes(1);
    expect(mockCaptureCardRestoreStickers).toHaveBeenCalledTimes(1);
  });
});

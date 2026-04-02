import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
let mockCaptureCardProps: any = null;
let mockCaptureCardHandle: any = null;
const mockOpenAppSettings = jest.fn(async () => undefined);
const mockRequestPermission = jest.fn(async () => ({ granted: true, canAskAgain: true }));
const mockShowAlert = jest.fn();
const mockUseCaptureFlow = jest.fn();
const mockGetPersistentItem = jest.fn(async (_key: string) => null);
const mockSetPersistentItem = jest.fn(async (_key: string, _value: string) => undefined);
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
    user: null,
    isAuthAvailable: true,
  }),
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

jest.mock('../hooks/useGeofence', () => ({
  useGeofence: () => ({
    location: null,
    remindersEnabled: false,
    requestForegroundLocation: jest.fn(async () => ({ location: null, requiresSettings: false })),
    requestReminderPermissions: jest.fn(async () => ({ enabled: false, requiresSettings: false })),
    openAppSettings: mockOpenAppSettings,
  }),
}));

jest.mock('../hooks/ui/useAppSheetAlert', () => ({
  useAppSheetAlert: () => ({
    alertProps: {},
    showAlert: mockShowAlert,
  }),
}));

jest.mock('../hooks/state/useActiveFeedTarget', () => ({
  useActiveFeedTarget: () => ({
    setActiveFeedTarget: jest.fn(),
    clearActiveFeedTarget: jest.fn(),
  }),
}));

jest.mock('../hooks/ui/useNoteDetailSheet', () => ({
  useNoteDetailSheet: () => ({
    openNoteDetail: jest.fn(),
  }),
}));

jest.mock('../hooks/state/useFeedFocus', () => ({
  useFeedFocus: () => ({
    consumeFeedFocus: jest.fn(() => null),
  }),
}));

jest.mock('../hooks/useCaptureFlow', () => ({
  useCaptureFlow: (...args: any[]) => mockUseCaptureFlow(...args),
}));

jest.mock('../utils/appStorage', () => ({
  getPersistentItem: (key: string) => mockGetPersistentItem(key),
  setPersistentItem: (key: string, value: string) => mockSetPersistentItem(key, value),
}));

jest.mock('../hooks/useNotes', () => ({
  useNotesStore: () => ({
    loading: false,
    notes: [],
    refreshNotes: jest.fn(async () => undefined),
    createNote: jest.fn(async () => undefined),
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
    purchasePlus: jest.fn(async () => ({ status: 'unavailable' })),
    restorePurchases: jest.fn(async () => ({ status: 'unavailable' })),
  }),
}));

jest.mock('../hooks/useSharedFeed', () => ({
  useSharedFeedStore: () => ({
    enabled: true,
    loading: false,
    ready: true,
    friends: [],
    sharedPosts: [],
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
        getStickerSnapshot: jest.fn(() => ({ enabled: false, placements: [] })),
        resetDoodle: jest.fn(),
        resetStickers: jest.fn(),
        closeDecorateControls: jest.fn(() => props.onDoodleModeChange?.(false)),
      };
      React.useImperativeHandle(ref, () => mockCaptureCardHandle, [props]);
      return <Text testID="camera-preview-state">{String(props.isCameraPreviewActive)}</Text>;
    }),
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
    return (
      <View>
        {props.captureHeader}
        <Text testID="capture-scroll-enabled">{String(props.scrollEnabled)}</Text>
        <Pressable testID="hide-capture" onPress={() => props.onCaptureVisibilityChange?.(false)} />
        <Pressable testID="show-capture" onPress={() => props.onCaptureVisibilityChange?.(true)} />
      </View>
    );
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
    mockCaptureCardProps = null;
    mockCaptureCardHandle = null;
    mockOpenAppSettings.mockClear();
    mockRequestPermission.mockClear();
    mockShowAlert.mockClear();
    mockGetPersistentItem.mockReset();
    mockSetPersistentItem.mockClear();
    mockRequestPermission.mockResolvedValue({ granted: true, canAskAgain: true });
    mockGetPersistentItem.mockResolvedValue(null);
    mockUseCaptureFlow.mockImplementation(() => {
      const createSharedValue = (value: number) => ({ value } as any);
      return {
        captureScale: createSharedValue(1),
        captureTranslateY: createSharedValue(0),
        flashAnim: createSharedValue(0),
        shutterScale: createSharedValue(1),
        captureMode: 'camera',
        cameraSessionKey: 1,
        setCaptureMode: jest.fn(),
        restaurantName: '',
        setRestaurantName: jest.fn(),
        noteText: '',
        setNoteText: jest.fn(),
        capturedPhoto: null,
        setCapturedPhoto: jest.fn(),
        selectedPromptId: 'photo-moment',
        setSelectedPromptId: jest.fn(),
        selectedPromptText: 'What made this moment worth keeping?',
        setSelectedPromptText: jest.fn(),
        promptAnswer: '',
        setPromptAnswer: jest.fn(),
        moodEmoji: null,
        setMoodEmoji: jest.fn(),
        promptExpanded: false,
        setPromptExpanded: jest.fn(),
        hasShuffledPrompt: false,
        setHasShuffledPrompt: jest.fn(),
        radius: 150,
        setRadius: jest.fn(),
        facing: 'back',
        setFacing: jest.fn(),
        permission: { granted: true, canAskAgain: true },
        requestPermission: mockRequestPermission,
        cameraRef: { current: null },
        animateModeSwitch: jest.fn(),
        toggleCaptureMode: jest.fn(),
        handleShutterPressIn: jest.fn(),
        handleShutterPressOut: jest.fn(),
        takePicture: jest.fn(),
        needsCameraPermission: false,
        resetCapture: jest.fn(),
      };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.requestAnimationFrame = originalRequestAnimationFrame;
    (global as any).requestIdleCallback = originalRequestIdleCallback;
    (global as any).cancelIdleCallback = originalCancelIdleCallback;
  });

  it('keeps the camera preview mounted while capture visibility changes', async () => {
    const { getByTestId } = render(<HomeScreen />);

    expect(getByTestId('camera-preview-state')).toHaveTextContent('true');
    expect(mockCaptureCardProps?.isCameraPreviewActive).toBe(true);

    fireEvent.press(getByTestId('hide-capture'));

    await waitFor(() => {
      expect(getByTestId('camera-preview-state')).toHaveTextContent('true');
      expect(mockCaptureCardProps?.isCameraPreviewActive).toBe(true);
    });

    fireEvent.press(getByTestId('show-capture'));

    await waitFor(() => {
      expect(getByTestId('camera-preview-state')).toHaveTextContent('true');
      expect(mockCaptureCardProps?.isCameraPreviewActive).toBe(true);
    });
  });

  it('pauses the live preview while the app is temporarily inactive', () => {
    AppState.currentState = 'inactive';

    render(<HomeScreen />);

    expect(mockCaptureCardProps).toBeTruthy();
    expect(mockCaptureCardProps?.isCameraPreviewActive).toBe(false);
  });

  it('releases capture scroll lock before switching modes', () => {
    const { getByTestId } = render(<HomeScreen />);

    expect(getByTestId('capture-scroll-enabled')).toHaveTextContent('true');

    act(() => {
      mockCaptureCardProps?.onDoodleModeChange?.(true);
    });
    expect(getByTestId('capture-scroll-enabled')).toHaveTextContent('false');

    act(() => {
      fireEvent.press(getByTestId('toggle-capture-mode'));
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
        flashAnim: createSharedValue(0),
        shutterScale: createSharedValue(1),
        captureMode: 'camera',
        cameraSessionKey: 1,
        setCaptureMode: jest.fn(),
        restaurantName: '',
        setRestaurantName: jest.fn(),
        noteText: '',
        setNoteText: jest.fn(),
        capturedPhoto: null,
        setCapturedPhoto: jest.fn(),
        selectedPromptId: 'photo-moment',
        setSelectedPromptId: jest.fn(),
        selectedPromptText: 'What made this moment worth keeping?',
        setSelectedPromptText: jest.fn(),
        promptAnswer: '',
        setPromptAnswer: jest.fn(),
        moodEmoji: null,
        setMoodEmoji: jest.fn(),
        promptExpanded: false,
        setPromptExpanded: jest.fn(),
        hasShuffledPrompt: false,
        setHasShuffledPrompt: jest.fn(),
        radius: 150,
        setRadius: jest.fn(),
        facing: 'back',
        setFacing: jest.fn(),
        permission: { granted: false, canAskAgain: false },
        requestPermission: mockRequestPermission,
        cameraRef: { current: null },
        animateModeSwitch: jest.fn(),
        toggleCaptureMode: jest.fn(),
        handleShutterPressIn: jest.fn(),
        handleShutterPressOut: jest.fn(),
        takePicture: jest.fn(),
        needsCameraPermission: true,
        resetCapture: jest.fn(),
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

  it('keeps the first-time live photo hint visible until a capture exists', async () => {
    let currentCapturedPhoto: string | null = null;

    mockUseCaptureFlow.mockImplementation(() => {
      const createSharedValue = (value: number) => ({ value } as any);
      return {
        captureScale: createSharedValue(1),
        captureTranslateY: createSharedValue(0),
        flashAnim: createSharedValue(0),
        shutterScale: createSharedValue(1),
        captureMode: 'camera',
        cameraSessionKey: 1,
        setCaptureMode: jest.fn(),
        restaurantName: '',
        setRestaurantName: jest.fn(),
        noteText: '',
        setNoteText: jest.fn(),
        capturedPhoto: currentCapturedPhoto,
        setCapturedPhoto: jest.fn(),
        selectedPromptId: 'photo-moment',
        setSelectedPromptId: jest.fn(),
        selectedPromptText: 'What made this moment worth keeping?',
        setSelectedPromptText: jest.fn(),
        promptAnswer: '',
        setPromptAnswer: jest.fn(),
        moodEmoji: null,
        setMoodEmoji: jest.fn(),
        promptExpanded: false,
        setPromptExpanded: jest.fn(),
        hasShuffledPrompt: false,
        setHasShuffledPrompt: jest.fn(),
        radius: 150,
        setRadius: jest.fn(),
        facing: 'back',
        setFacing: jest.fn(),
        permission: { granted: true, canAskAgain: true },
        requestPermission: mockRequestPermission,
        cameraRef: { current: null },
        animateModeSwitch: jest.fn(),
        toggleCaptureMode: jest.fn(),
        handleShutterPressIn: jest.fn(),
        handleShutterPressOut: jest.fn(),
        takePicture: jest.fn(),
        needsCameraPermission: false,
        resetCapture: jest.fn(),
      };
    });

    const { rerender } = render(<HomeScreen />);

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
  });
});

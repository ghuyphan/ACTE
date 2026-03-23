import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { Dimensions, InteractionManager } from 'react-native';
import HomeScreen from '../app/(tabs)/index';

const mockConsumeFeedFocus = jest.fn();
const mockScrollToOffset = jest.fn();

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
    user: { uid: 'me' },
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
    openAppSettings: jest.fn(async () => undefined),
  }),
}));

jest.mock('../hooks/useAppSheetAlert', () => ({
  useAppSheetAlert: () => ({
    alertProps: {},
    showAlert: jest.fn(),
  }),
}));

jest.mock('../hooks/useFeedFocus', () => ({
  useFeedFocus: () => ({
    consumeFeedFocus: (...args: unknown[]) => mockConsumeFeedFocus(...args),
  }),
}));

jest.mock('../hooks/useNoteDetailSheet', () => ({
  useNoteDetailSheet: () => ({
    openNoteDetail: jest.fn(),
  }),
}));

jest.mock('../hooks/useCaptureFlow', () => ({
  useCaptureFlow: () => ({
    ...(() => {
      const { Animated } = require('react-native');
      return {
        captureScale: new Animated.Value(1),
        captureTranslateY: new Animated.Value(0),
        flashAnim: new Animated.Value(0),
        shutterScale: new Animated.Value(1),
      };
    })(),
    captureMode: 'text',
    cameraSessionKey: 0,
    setCaptureMode: jest.fn(),
    restaurantName: '',
    setRestaurantName: jest.fn(),
    noteText: '',
    setNoteText: jest.fn(),
    capturedPhoto: null,
    setCapturedPhoto: jest.fn(),
    radius: 150,
    setRadius: jest.fn(),
    facing: 'back',
    setFacing: jest.fn(),
    permission: { granted: true },
    requestPermission: jest.fn(),
    cameraRef: { current: null },
    toggleCaptureMode: jest.fn(),
    handleShutterPressIn: jest.fn(),
    handleShutterPressOut: jest.fn(),
    takePicture: jest.fn(),
    needsCameraPermission: false,
    resetCapture: jest.fn(),
  }),
}));

jest.mock('../hooks/useNotes', () => ({
  useNotesStore: () => ({
    loading: false,
    notes: [
      {
        id: 'note-new',
        type: 'text',
        content: 'Newest note',
        locationName: 'District 1',
        latitude: 10.7,
        longitude: 106.6,
        radius: 150,
        isFavorite: false,
        createdAt: '2026-03-11T00:00:00.000Z',
        updatedAt: null,
      },
      {
        id: 'note-old',
        type: 'text',
        content: 'Older note',
        locationName: 'District 3',
        latitude: 10.8,
        longitude: 106.7,
        radius: 150,
        isFavorite: false,
        createdAt: '2026-03-10T00:00:00.000Z',
        updatedAt: null,
      },
    ],
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
    remotePhotoNoteCount: null,
    presentPaywallIfNeeded: jest.fn(async () => 'not_presented'),
    restorePurchases: jest.fn(async () => ({ status: 'unavailable' })),
  }),
}));

jest.mock('../hooks/useSharedFeed', () => ({
  useSharedFeedStore: () => ({
    enabled: true,
    loading: false,
    ready: true,
    friends: [],
    sharedPosts: [
      {
        id: 'shared-friend',
        authorUid: 'friend-1',
        authorDisplayName: 'Lan',
        type: 'text',
        text: 'Friend memory',
        placeName: 'District 5',
        createdAt: '2026-03-12T00:00:00.000Z',
      },
      {
        id: 'shared-owned',
        authorUid: 'me',
        authorDisplayName: 'You',
        type: 'text',
        text: 'Owned shared memory',
        placeName: 'District 4',
        createdAt: '2026-03-13T00:00:00.000Z',
      },
    ],
    activeInvite: null,
    refreshSharedFeed: jest.fn(async () => undefined),
    createFriendInvite: jest.fn(async () => undefined),
    revokeFriendInvite: jest.fn(async () => undefined),
    removeFriend: jest.fn(async () => undefined),
    createSharedPost: jest.fn(async () => undefined),
  }),
}));

jest.mock('../services/sharedFeedService', () => ({
  getSharedFeedErrorMessage: jest.fn(() => 'Shared moments are unavailable right now.'),
}));

jest.mock('../components/AppSheetAlert', () => {
  return function MockAppSheetAlert() {
    return null;
  };
});

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
  return function MockNotesFeed({ flatListRef }: { flatListRef: React.MutableRefObject<any> }) {
    React.useEffect(() => {
      flatListRef.current = {
        scrollToOffset: (...args: unknown[]) => mockScrollToOffset(...args),
      };

      return () => {
        flatListRef.current = null;
      };
    }, [flatListRef]);

    return <View testID="notes-feed" />;
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

describe('HomeScreen archive focus', () => {
  const runAfterInteractionsSpy = jest.spyOn(InteractionManager, 'runAfterInteractions');
  const snapHeight = Dimensions.get('window').height - 90;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    runAfterInteractionsSpy.mockImplementation((task: any) => {
      task?.();
      return { cancel: jest.fn() } as any;
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  afterAll(() => {
    runAfterInteractionsSpy.mockRestore();
  });

  it('scrolls to the matching note card when a pending note focus exists', async () => {
    mockConsumeFeedFocus.mockReturnValueOnce({ kind: 'note', id: 'note-old' });

    render(<HomeScreen />);

    act(() => {
      jest.runAllTimers();
    });

    await waitFor(() => {
      expect(mockScrollToOffset).toHaveBeenCalledWith({
        offset: snapHeight * 3,
        animated: true,
      });
    });
  });

  it('scrolls to the matching shared post card when a pending shared focus exists', async () => {
    mockConsumeFeedFocus.mockReturnValueOnce({ kind: 'shared-post', id: 'shared-friend' });

    render(<HomeScreen />);

    act(() => {
      jest.runAllTimers();
    });

    await waitFor(() => {
      expect(mockScrollToOffset).toHaveBeenCalledWith({
        offset: snapHeight,
        animated: true,
      });
    });
  });

  it('clears a missing focus target without opening a fallback scroll', async () => {
    mockConsumeFeedFocus.mockReturnValueOnce({ kind: 'note', id: 'missing-note' });

    render(<HomeScreen />);

    act(() => {
      jest.runAllTimers();
    });

    await waitFor(() => {
      expect(mockConsumeFeedFocus).toHaveBeenCalled();
    });
    expect(mockScrollToOffset).not.toHaveBeenCalled();
  });
});

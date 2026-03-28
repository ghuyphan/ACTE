import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';

const mockCreateFriendInvite = jest.fn();
let mockSharedManageSheetProps: any = null;

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
    t: (key: string, fallback?: string, options?: Record<string, string>) =>
      options?.url ? (fallback ?? key).replace('{{url}}', options.url) : (fallback ?? key),
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
    user: { uid: 'user-1' },
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
  useCaptureFlow: () => {
    const createSharedValue = (value: number) => ({ value } as any);
    return {
      captureScale: createSharedValue(1),
      captureTranslateY: createSharedValue(0),
      flashAnim: createSharedValue(0),
      shutterScale: createSharedValue(1),
      captureMode: 'text',
      cameraSessionKey: 0,
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
    };
  },
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
    remotePhotoNoteCount: 0,
    presentPaywallIfNeeded: jest.fn(async () => ({ action: 'not-presented' })),
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
    createFriendInvite: mockCreateFriendInvite,
    revokeFriendInvite: jest.fn(async () => undefined),
    acceptFriendInvite: jest.fn(async () => undefined),
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
  const { Pressable, Text, View } = require('react-native');
  return function MockHomeHeaderSearch(props: any) {
    return (
      <View>
        <Pressable testID="home-open-shared" onPress={props.onOpenShared}>
          <Text>Open shared</Text>
        </Pressable>
      </View>
    );
  };
});

jest.mock('../components/home/NotesFeed', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockNotesFeed(props: any) {
    return <View>{props.captureHeader}</View>;
  };
});

jest.mock('../components/home/SharedManageSheet', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  return function MockSharedManageSheet(props: any) {
    mockSharedManageSheetProps = props;
    return (
      <View>
        <Text testID="shared-manage-visible">{props.visible ? 'visible' : 'hidden'}</Text>
        {props.visible ? (
          <Pressable testID="shared-manage-share" onPress={props.onShareInvite}>
            <Text>Share invite</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };
});

jest.mock('../utils/platform', () => ({
  isIOS26OrNewer: false,
}));

import HomeScreen from '../app/(tabs)/index';

describe('HomeScreen share invite handoff', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSharedManageSheetProps = null;
    mockCreateFriendInvite.mockReset();
    mockCreateFriendInvite.mockResolvedValue({
      id: 'invite-1',
      url: 'https://noto.app/invite-1',
    });
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('dismisses the friends sheet before opening the native share dialog', async () => {
    const { getByTestId } = render(<HomeScreen />);

    fireEvent.press(getByTestId('home-open-shared'));

    await waitFor(() => {
      expect(getByTestId('shared-manage-visible').props.children).toBe('visible');
    });

    fireEvent.press(getByTestId('shared-manage-share'));

    await waitFor(() => {
      expect(getByTestId('shared-manage-visible').props.children).toBe('hidden');
    });

    expect(Share.share).not.toHaveBeenCalled();
    expect(mockCreateFriendInvite).not.toHaveBeenCalled();
    expect(mockSharedManageSheetProps.visible).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(220);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockCreateFriendInvite).toHaveBeenCalledTimes(1);
      expect(Share.share).toHaveBeenCalledWith({
        message: 'Join my Noto shared feed: https://noto.app/invite-1',
        url: 'https://noto.app/invite-1',
      });
    });
  });
});

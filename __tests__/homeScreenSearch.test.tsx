import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

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
  useCaptureFlow: () => ({
    // Build Animated values inside the factory to satisfy Jest's hoisting rules.
    ...(() => {
      const createSharedValue = (value: number) => ({ value } as any);
      return {
        captureOpacity: createSharedValue(1),
        captureScale: createSharedValue(1),
        captureTranslateY: createSharedValue(0),
        flashAnim: createSharedValue(0),
        shutterScale: createSharedValue(1),
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
    selectedPromptId: 'future-notice',
    setSelectedPromptId: jest.fn(),
    selectedPromptText: 'What should future-you notice here?',
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
    permission: { granted: true },
    requestPermission: jest.fn(),
    cameraRef: { current: null },
    animateModeSwitch: jest.fn(),
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
        id: 'photo-1',
        type: 'photo',
        content: 'file:///private/photo-1.jpg',
        photoLocalUri: 'file:///private/photo-1.jpg',
        locationName: 'District 3',
        latitude: 10.8,
        longitude: 106.7,
        radius: 150,
        isFavorite: false,
        createdAt: '2026-03-11T00:00:00.000Z',
        updatedAt: null,
      },
      {
        id: 'text-1',
        type: 'text',
        content: 'Best iced coffee',
        locationName: 'District 1',
        latitude: 10.7,
        longitude: 106.6,
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
  const { Pressable, Text, TextInput, View } = require('react-native');
  return function MockHomeHeaderSearch(props: any) {
    return (
      <View>
        <Pressable testID="home-open-search" onPress={props.onOpenSearch}>
          <Text>Open search</Text>
        </Pressable>
        <TextInput
          testID="home-search-input"
          value={props.searchQuery}
          onChangeText={props.onSearchChange}
        />
      </View>
    );
  };
});

jest.mock('../components/home/NotesFeed', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return function MockNotesFeed({ notes }: { notes: Array<{ id: string }> }) {
    return (
      <View>
        <Text testID="home-notes-count">{String(notes.length)}</Text>
        {notes.map((note) => (
          <Text key={note.id}>{note.id}</Text>
        ))}
      </View>
    );
  };
});

jest.mock('../components/home/SharedMomentsStrip', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockSharedMomentsStrip() {
    return <View testID="shared-moments-strip" />;
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

describe('HomeScreen search', () => {
  it('filters with shared search logic and ignores photo file uris', async () => {
    const { getByTestId, queryByText } = render(<HomeScreen />);

    fireEvent.press(getByTestId('home-open-search'));
    fireEvent.changeText(getByTestId('home-search-input'), 'photo-1.jpg');

    await waitFor(() => {
      expect(getByTestId('home-notes-count').props.children).toBe('0');
      expect(queryByText('photo-1')).toBeNull();
    });

    fireEvent.changeText(getByTestId('home-search-input'), 'District 3');

    await waitFor(() => {
      expect(getByTestId('home-notes-count').props.children).toBe('1');
      expect(queryByText('photo-1')).toBeTruthy();
    });
  });
});

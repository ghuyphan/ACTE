import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { InteractionManager } from 'react-native';

const mockCreateNote = jest.fn(async (input?: any) => {
  const createdNote = {
    id: input?.id ?? 'note-1',
    type: input?.type ?? 'text',
    content: input?.content ?? 'A doodled note',
    locationName: input?.locationName ?? 'Mock Place',
    latitude: input?.latitude ?? 10.77,
    longitude: input?.longitude ?? 106.69,
    radius: input?.radius ?? 150,
    isFavorite: false,
    hasDoodle: input?.hasDoodle ?? false,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: null,
  };
  mockNotes = [createdNote, ...mockNotes];
  return createdNote;
});
const mockRefreshNotes = jest.fn(async () => undefined);
const mockResetCapture = jest.fn();
const mockSaveNoteDoodle = jest.fn<Promise<void>, [string, string]>(async () => undefined);
const mockResetDoodle = jest.fn();
const mockResetStickers = jest.fn();
const mockShowAlert = jest.fn();
const mockScrollToOffset = jest.fn();
let mockRemindersEnabled = false;
let mockNoteText = 'A doodled note';
let mockNotes: any[] = [];
const mockGetDoodleSnapshot = jest.fn(() => ({
  enabled: true,
  strokes: [{ color: '#1C1C1E', points: [0.1, 0.1, 0.2, 0.2] }],
}));
const originalRequestAnimationFrame = global.requestAnimationFrame;

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

jest.mock('expo-location', () => ({
  reverseGeocodeAsync: jest.fn(async () => [{ name: 'Mock Place', street: 'Mock Street', city: 'Ho Chi Minh City' }]),
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
    location: {
      coords: {
        latitude: 10.77,
        longitude: 106.69,
      },
    },
    remindersEnabled: mockRemindersEnabled,
    requestForegroundLocation: jest.fn(async () => ({ location: null, requiresSettings: false })),
    requestReminderPermissions: jest.fn(async () => ({ enabled: false, requiresSettings: false })),
    openAppSettings: jest.fn(async () => undefined),
  }),
}));

jest.mock('../hooks/useAppSheetAlert', () => ({
  useAppSheetAlert: () => ({
    alertProps: {},
    showAlert: mockShowAlert,
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
    cameraSessionKey: 1,
    setCaptureMode: jest.fn(),
    restaurantName: '',
    setRestaurantName: jest.fn(),
    noteText: mockNoteText,
    setNoteText: jest.fn(),
    capturedPhoto: null,
    setCapturedPhoto: jest.fn(),
    selectedPromptId: null,
    setSelectedPromptId: jest.fn(),
    selectedPromptText: null,
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
    resetCapture: mockResetCapture,
  }),
}));

jest.mock('../hooks/useNotes', () => ({
  useNotesStore: () => ({
    loading: false,
    notes: mockNotes,
    refreshNotes: mockRefreshNotes,
    createNote: mockCreateNote,
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

jest.mock('../services/noteDoodles', () => ({
  saveNoteDoodle: (noteId: string, strokesJson: string) => mockSaveNoteDoodle(noteId, strokesJson),
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
  const { Pressable, View } = require('react-native');

  return {
    __esModule: true,
    default: React.forwardRef(function MockCaptureCard(props: any, ref: any) {
      React.useImperativeHandle(
        ref,
        () => ({
          getDoodleSnapshot: () => mockGetDoodleSnapshot(),
          getStickerSnapshot: () => ({ enabled: false, placements: [] }),
          resetDoodle: () => mockResetDoodle(),
          resetStickers: () => mockResetStickers(),
        }),
        []
      );

      return (
        <View>
          <Pressable testID="capture-save-button" onPress={props.onSaveNote} />
        </View>
      );
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
  const { Text, View } = require('react-native');
  return function MockNotesFeed(props: any) {
    props.flatListRef.current = {
      scrollToOffset: (...args: unknown[]) => mockScrollToOffset(...args),
    };
    return (
      <View>
        {props.captureHeader}
        {props.notes.map((note: { id: string }) => (
          <Text key={note.id}>{note.id}</Text>
        ))}
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

describe('HomeScreen doodle save flow', () => {
  beforeEach(() => {
    jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation((task: any) => {
      task?.();
      return { cancel: jest.fn() } as any;
    });
    global.requestAnimationFrame = ((callback: any) => {
      callback(0);
      return 0;
    }) as typeof requestAnimationFrame;
    jest.clearAllMocks();
    mockRemindersEnabled = false;
    mockNoteText = 'A doodled note';
    mockNotes = [];
    mockGetDoodleSnapshot.mockImplementation(() => ({
      enabled: true,
      strokes: [{ color: '#1C1C1E', points: [0.1, 0.1, 0.2, 0.2] }],
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.requestAnimationFrame = originalRequestAnimationFrame;
  });

  it('keeps Home anchored on the capture card while the local save sheet is open', async () => {
    const { getByTestId, queryByText } = render(<HomeScreen />);

    fireEvent.press(getByTestId('capture-save-button'));

    await waitFor(() => {
      expect(mockCreateNote).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'text',
          content: 'A doodled note',
          locationName: 'Mock Place, Mock Street, Ho Chi Minh City',
          hasDoodle: true,
          doodleStrokesJson: JSON.stringify([{ color: '#1C1C1E', points: [0.1, 0.1, 0.2, 0.2] }]),
        })
      );
    });

    expect(mockGetDoodleSnapshot).toHaveBeenCalled();
    const createdInput = mockCreateNote.mock.calls[0]?.[0];
    expect(queryByText(createdInput.id)).toBeNull();
    expect(mockSaveNoteDoodle).toHaveBeenCalledWith(
      createdInput.id,
      JSON.stringify([{ color: '#1C1C1E', points: [0.1, 0.1, 0.2, 0.2] }])
    );
    expect(mockRefreshNotes).not.toHaveBeenCalled();
    expect(mockShowAlert).toHaveBeenCalledWith(expect.objectContaining({
      variant: 'success',
    }));
    expect(mockResetCapture).toHaveBeenCalled();
    expect(mockResetDoodle).toHaveBeenCalled();
    expect(mockResetStickers).toHaveBeenCalled();
    expect(mockScrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: false });

    act(() => {
      mockShowAlert.mock.calls[0]?.[0]?.onClose?.();
    });

    await waitFor(() => {
      expect(queryByText(createdInput.id)).not.toBeNull();
    });
  });

  it('scrolls to the newly saved note after dismissing the local save sheet with Done', async () => {
    const { getByTestId } = render(<HomeScreen />);

    fireEvent.press(getByTestId('capture-save-button'));

    await waitFor(() => {
      expect(mockCreateNote).toHaveBeenCalledTimes(1);
    });

    const savedAlert = mockShowAlert.mock.calls[0]?.[0];

    act(() => {
      savedAlert?.onClose?.();
    });

    act(() => {
      savedAlert?.secondaryAction?.onPress?.();
    });

    await waitFor(() => {
      expect(mockScrollToOffset).toHaveBeenCalledWith(
        expect.objectContaining({
          animated: true,
        })
      );
    });
  });

  it('allows saving a doodle-only text note', async () => {
    mockNoteText = '';

    const { getByTestId } = render(<HomeScreen />);

    fireEvent.press(getByTestId('capture-save-button'));

    await waitFor(() => {
      expect(mockCreateNote).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'text',
          content: '',
          locationName: 'Mock Place, Mock Street, Ho Chi Minh City',
          hasDoodle: true,
          doodleStrokesJson: JSON.stringify([{ color: '#1C1C1E', points: [0.1, 0.1, 0.2, 0.2] }]),
        })
      );
    });

    const doodleOnlyCreatedInput = mockCreateNote.mock.calls[0]?.[0];
    expect(mockSaveNoteDoodle).toHaveBeenCalledWith(
      doodleOnlyCreatedInput.id,
      JSON.stringify([{ color: '#1C1C1E', points: [0.1, 0.1, 0.2, 0.2] }])
    );
  });

  it('re-anchors Home on the capture card after an inline save', async () => {
    jest.useFakeTimers();
    mockRemindersEnabled = true;

    try {
      const { getByTestId } = render(<HomeScreen />);

      fireEvent.press(getByTestId('capture-save-button'));

      await waitFor(() => {
        expect(mockCreateNote).toHaveBeenCalled();
      });

      act(() => {
        jest.runAllTimers();
      });

      expect(mockScrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: false });
      expect(mockResetCapture).toHaveBeenCalled();
      expect(mockResetDoodle).toHaveBeenCalled();
      expect(mockResetStickers).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows the saved note in the feed again after inline save completes', async () => {
    jest.useFakeTimers();
    mockRemindersEnabled = true;

    try {
      const { getByTestId, queryByText } = render(<HomeScreen />);

      fireEvent.press(getByTestId('capture-save-button'));

      await waitFor(() => {
        expect(mockCreateNote).toHaveBeenCalledTimes(1);
      });

      const createdInput = mockCreateNote.mock.calls[0]?.[0];
      expect(queryByText(createdInput.id)).toBeNull();

      act(() => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(queryByText(createdInput.id)).not.toBeNull();
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('ignores a second save tap while the first save is still in flight', async () => {
    let resolveCreateNote: ((value: any) => void) | null = null;
    mockCreateNote.mockImplementationOnce(
      () =>
        new Promise<any>((resolve: (value: any) => void) => {
          resolveCreateNote = resolve;
        })
    );

    const { getByTestId } = render(<HomeScreen />);

    fireEvent.press(getByTestId('capture-save-button'));
    fireEvent.press(getByTestId('capture-save-button'));

    await waitFor(() => {
      expect(mockCreateNote).toHaveBeenCalledTimes(1);
    });

    if (!resolveCreateNote) {
      throw new Error('Expected the first save to start');
    }
    const resolvePendingCreateNote = resolveCreateNote as (value: any) => void;

    await act(async () => {
      resolvePendingCreateNote({
        id: 'note-1',
        type: 'text',
        content: 'A doodled note',
        locationName: 'Mock Place',
        latitude: 10.77,
        longitude: 106.69,
        radius: 150,
        isFavorite: false,
        hasDoodle: false,
        createdAt: '2026-03-20T00:00:00.000Z',
        updatedAt: null,
      });
    });

    await waitFor(() => {
      expect(mockSaveNoteDoodle).toHaveBeenCalledTimes(1);
    });
  });
});

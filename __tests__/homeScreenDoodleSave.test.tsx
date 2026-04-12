import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ActiveFeedTargetProvider } from '../hooks/useActiveFeedTarget';

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
const mockRequestForegroundLocation = jest.fn();
const mockRequestReminderPermissions = jest.fn();
const mockOpenAppSettings = jest.fn();
let mockRemindersEnabled = false;
let mockNoteText = 'A doodled note';
let mockNotes: any[] = [];
let mockHasLoadedAllNotes = true;
let mockNoteCount: number | null = null;
let mockLocation: any = {
  coords: {
    latitude: 10.77,
    longitude: 106.69,
  },
};
const mockGetDoodleSnapshot = jest.fn(() => ({
  enabled: true,
  strokes: [{ color: '#1C1C1E', points: [0.1, 0.1, 0.2, 0.2] }],
}));
let latestCaptureCardProps: any = null;
let latestNotesFeedProps: any = null;
let latestSavedNoteRevealProps: any = null;
const originalRequestAnimationFrame = global.requestAnimationFrame;
const originalRequestIdleCallback = (global as any).requestIdleCallback;
const originalCancelIdleCallback = (global as any).cancelIdleCallback;

function mockBuildHomeFeedItems() {
  return [...mockNotes]
    .map((note) => ({
      id: note.id,
      kind: 'note' as const,
      note,
      createdAt: note.createdAt,
    }))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

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

jest.mock('../hooks/app/useHomeStartupReady', () => ({
  useHomeStartupReady: () => ({
    homeFeedReady: false,
    markHomeFeedReady: jest.fn(),
    resetHomeFeedReady: jest.fn(),
  }),
}));

jest.mock('../hooks/useGeofence', () => ({
  useGeofence: () => ({
    location: mockLocation,
    remindersEnabled: mockRemindersEnabled,
    requestForegroundLocation: mockRequestForegroundLocation,
    requestReminderPermissions: mockRequestReminderPermissions,
    openAppSettings: mockOpenAppSettings,
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
      const createSharedValue = (value: number) => ({ value } as any);
      return {
        captureScale: createSharedValue(1),
        captureTranslateY: createSharedValue(0),
        shutterScale: createSharedValue(1),
      };
    })(),
    captureMode: 'text',
    cameraSessionKey: 1,
    setCaptureMode: jest.fn(),
    noteText: mockNoteText,
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
    hasLoadedAllNotes: mockHasLoadedAllNotes,
    noteCount: mockNoteCount ?? mockNotes.length,
    notes: mockNotes,
    loadNextNotesPage: jest.fn(async () => mockNotes),
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

jest.mock('../components/sheets/AppSheetAlert', () => {
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
      latestCaptureCardProps = props;
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
    latestNotesFeedProps = props;
    const visibleItems = props.items ?? props.notes ?? [];
    props.flatListRef.current = {
      scrollToOffset: (...args: unknown[]) => mockScrollToOffset(...args),
    };
    return (
      <View>
        {props.captureHeader}
        {visibleItems.map((item: { id: string; kind?: 'note' | 'shared-post'; note?: { id: string } }) => (
          <Text key={`${item.kind ?? 'note'}:${item.id}`}>{item.note?.id ?? item.id}</Text>
        ))}
      </View>
    );
  };
});

jest.mock('../components/home/SavedNotePolaroidReveal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockSavedNotePolaroidReveal(props: any) {
    latestSavedNoteRevealProps = props;
    return props.note ? <View testID="saved-note-polaroid-reveal" /> : null;
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

function renderHomeScreen() {
  return render(
    <ActiveFeedTargetProvider>
      <HomeScreen />
    </ActiveFeedTargetProvider>
  );
}

describe('HomeScreen doodle save flow', () => {
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
    jest.clearAllMocks();
    mockRemindersEnabled = false;
    mockNoteText = 'A doodled note';
    mockNotes = [];
    mockHasLoadedAllNotes = true;
    mockNoteCount = null;
    mockLocation = {
      coords: {
        latitude: 10.77,
        longitude: 106.69,
      },
    };
    mockRequestForegroundLocation.mockResolvedValue({
      location: null,
      requiresSettings: false,
      reason: 'unavailable',
    });
    mockRequestReminderPermissions.mockResolvedValue({
      enabled: false,
      requiresSettings: false,
    });
    mockOpenAppSettings.mockResolvedValue(undefined);
    latestCaptureCardProps = null;
    latestNotesFeedProps = null;
    latestSavedNoteRevealProps = null;
    mockGetDoodleSnapshot.mockImplementation(() => ({
      enabled: true,
      strokes: [{ color: '#1C1C1E', points: [0.1, 0.1, 0.2, 0.2] }],
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.requestAnimationFrame = originalRequestAnimationFrame;
    (global as any).requestIdleCallback = originalRequestIdleCallback;
    (global as any).cancelIdleCallback = originalCancelIdleCallback;
  });

  it('does not wire load-more when the full note set already fits in store data', () => {
    mockNotes = Array.from({ length: 5 }, (_, index) => ({
      id: `note-${index + 1}`,
      type: 'text',
      content: `Note ${index + 1}`,
      locationName: `Place ${index + 1}`,
      latitude: 10.7 + index,
      longitude: 106.6 + index,
      radius: 150,
      isFavorite: false,
      createdAt: new Date(Date.UTC(2026, 2, 20 - index)).toISOString(),
      updatedAt: null,
    }));

    renderHomeScreen();

    expect(latestNotesFeedProps?.items).toHaveLength(5);
    expect(latestNotesFeedProps?.onEndReached).toBeUndefined();
  });

  it('does not wire load-more when noteCount already matches the loaded notes', () => {
    mockHasLoadedAllNotes = false;
    mockNotes = [
      {
        id: 'note-1',
        type: 'text',
        content: 'Only visible note',
        locationName: 'Place 1',
        latitude: 10.7,
        longitude: 106.6,
        radius: 150,
        isFavorite: false,
        createdAt: new Date(Date.UTC(2026, 2, 20)).toISOString(),
        updatedAt: null,
      },
    ];
    mockNoteCount = mockNotes.length;

    renderHomeScreen();

    expect(latestNotesFeedProps?.items).toHaveLength(1);
    expect(latestNotesFeedProps?.onEndReached).toBeUndefined();
  });

  it('keeps Home anchored on the capture card while the local save sheet is open', async () => {
    const { getByTestId, queryByText } = renderHomeScreen();

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
    const { getByTestId } = renderHomeScreen();

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

    const { getByTestId } = renderHomeScreen();

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
      const { getByTestId } = renderHomeScreen();

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
      const { getByTestId, queryByText } = renderHomeScreen();

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

  it('does not pass a home feed reveal animation after saving a note', async () => {
    jest.useFakeTimers();
    mockRemindersEnabled = true;

    try {
      const { getByTestId } = renderHomeScreen();

      fireEvent.press(getByTestId('capture-save-button'));

      await waitFor(() => {
        expect(mockCreateNote).toHaveBeenCalledTimes(1);
      });

      const createdInput = mockCreateNote.mock.calls[0]?.[0];

      act(() => {
        jest.runAllTimers();
      });

      expect(latestSavedNoteRevealProps?.note?.id).toBe(createdInput.id);
      expect(latestNotesFeedProps?.revealedNoteId).toBeUndefined();
      expect(latestNotesFeedProps?.revealToken).toBeUndefined();

      act(() => {
        latestNotesFeedProps?.onCaptureVisibilityChange?.(false);
      });

      await waitFor(() => {
        expect(latestNotesFeedProps?.revealedNoteId).toBeUndefined();
        expect(latestNotesFeedProps?.revealToken).toBeUndefined();
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

    const { getByTestId } = renderHomeScreen();

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

  it('shows save progress while waiting for location and then surfaces the GPS failure', async () => {
    let resolveLocationRequest: ((value: any) => void) | null = null;
    mockLocation = null;
    mockRequestForegroundLocation.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLocationRequest = resolve;
        })
    );

    const { getByTestId } = renderHomeScreen();

    fireEvent.press(getByTestId('capture-save-button'));

    await waitFor(() => {
      expect(mockRequestForegroundLocation).toHaveBeenCalledTimes(1);
      expect(latestCaptureCardProps?.saving).toBe(true);
    });

    expect(mockCreateNote).not.toHaveBeenCalled();

    if (!resolveLocationRequest) {
      throw new Error('Expected the foreground location request to start');
    }
    const resolvePendingLocationRequest: (value: any) => void = resolveLocationRequest;

    await act(async () => {
      resolvePendingLocationRequest({
        location: null,
        requiresSettings: false,
        reason: 'timeout',
      });
    });

    await waitFor(() => {
      expect(mockShowAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'error',
          title: 'Location unavailable',
          message:
            'Noto is still waiting for a GPS fix. Move to a clearer spot and try again in a moment.',
        })
      );
    });
  });
});

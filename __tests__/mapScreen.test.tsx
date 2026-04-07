import React from 'react';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { Platform } from 'react-native';
import MapScreen from '../app/(tabs)/map';

const mockOpenNoteDetail = jest.fn();
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockAnimateToRegion = jest.fn();
const mockFitToCoordinates = jest.fn();
const mockRequestForegroundLocation = jest.fn();
const mockOpenAppSettings = jest.fn();
const mockImpactAsync = jest.fn();
let mockReduceMotionEnabled = false;
const defaultSharedPosts = [
  {
    id: 'shared-friend-1',
    authorUid: 'friend-1',
    authorDisplayName: 'Lan',
    authorPhotoURLSnapshot: null,
    audienceUserIds: ['me'],
    type: 'text' as const,
    text: 'Shared coffee memory',
    photoPath: null,
    photoLocalUri: null,
    doodleStrokesJson: null,
    placeName: 'District 3',
    sourceNoteId: null,
    latitude: 10.803,
    longitude: 106.701,
    createdAt: '2026-03-12T00:00:00.000Z',
    updatedAt: null,
  },
  {
    id: 'shared-owned-1',
    authorUid: 'me',
    authorDisplayName: 'Me',
    authorPhotoURLSnapshot: null,
    audienceUserIds: ['friend-1'],
    type: 'text' as const,
    text: 'My own shared copy',
    photoPath: null,
    photoLocalUri: null,
    doodleStrokesJson: null,
    placeName: 'District 1',
    sourceNoteId: null,
    latitude: 10.761,
    longitude: 106.661,
    createdAt: '2026-03-11T00:00:00.000Z',
    updatedAt: null,
  },
];

jest.mock('expo-glass-effect', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GlassView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Image: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
  ImpactFeedbackStyle: {
    Light: 'light',
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallbackOrOptions?: string | Record<string, unknown>) => {
      if (typeof fallbackOrOptions === 'string') {
        return fallbackOrOptions;
      }

      if (fallbackOrOptions && typeof fallbackOrOptions === 'object') {
        const defaultValue =
          typeof fallbackOrOptions.defaultValue === 'string' ? fallbackOrOptions.defaultValue : _key;
        return defaultValue.replace(/\{\{count\}\}/g, String(fallbackOrOptions.count ?? ''));
      }

      return _key;
    },
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => mockRouterPush(...args),
    replace: (...args: unknown[]) => mockRouterReplace(...args),
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

jest.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockReduceMotionEnabled,
}));

jest.mock('../hooks/ui/useNoteDetailSheet', () => ({
  useNoteDetailSheet: () => ({
    openNoteDetail: (...args: unknown[]) => mockOpenNoteDetail(...args),
  }),
}));

const defaultNotes = [
  {
    id: 'text-1',
    type: 'text' as const,
    content: 'Text note one',
    locationName: 'District 1',
    latitude: 10.76,
    longitude: 106.66,
    radius: 150,
    isFavorite: true,
    createdAt: '2026-03-11T00:00:00.000Z',
    updatedAt: null,
  },
  {
    id: 'photo-1',
    type: 'photo' as const,
    content: 'file:///photo.jpg',
    locationName: 'District 3',
    latitude: 10.8,
    longitude: 106.7,
    radius: 150,
    isFavorite: false,
    createdAt: '2026-03-10T00:00:00.000Z',
    updatedAt: null,
  },
];

const mockNotes = defaultNotes.map((note) => ({ ...note }));
const mockSharedPosts = defaultSharedPosts.map((post) => ({ ...post }));

function resetMockNotes() {
  mockNotes.splice(0, mockNotes.length, ...defaultNotes.map((note) => ({ ...note })));
}

function resetMockSharedPosts() {
  mockSharedPosts.splice(0, mockSharedPosts.length, ...defaultSharedPosts.map((post) => ({ ...post })));
}

function replaceMockNotes(nextNotes: typeof defaultNotes) {
  mockNotes.splice(0, mockNotes.length, ...nextNotes.map((note) => ({ ...note })));
}

function setPlatformOS(nextOS: 'ios' | 'android' | 'web') {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    get: () => nextOS,
  });
}

async function waitForPreviewCloseAnimation() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 320));
  });
}

jest.mock('../hooks/useNotes', () => ({
  useNotesStore: () => ({
    loading: false,
    notes: mockNotes,
  }),
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'me' },
  }),
}));

jest.mock('../hooks/useSharedFeed', () => ({
  useSharedFeedStore: () => ({
    enabled: true,
    sharedPosts: mockSharedPosts,
  }),
}));

jest.mock('../hooks/useGeofence', () => ({
  useGeofence: () => ({
    location: {
      coords: {
        latitude: 10.7605,
        longitude: 106.6605,
      },
    },
    requestForegroundLocation: (...args: unknown[]) => mockRequestForegroundLocation(...args),
    openAppSettings: (...args: unknown[]) => mockOpenAppSettings(...args),
  }),
}));

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View, Pressable } = require('react-native');

  const MockMapView = React.forwardRef(({ children, onMapReady, onPress, onRegionChangeComplete, testID }: any, ref: any) => {
    const didInitializeRef = React.useRef(false);

    React.useImperativeHandle(ref, () => ({
      animateToRegion: (...args: unknown[]) => mockAnimateToRegion(...args),
      fitToCoordinates: (...args: unknown[]) => mockFitToCoordinates(...args),
    }));

    React.useEffect(() => {
      if (didInitializeRef.current) {
        return;
      }

      didInitializeRef.current = true;
      onMapReady?.();
      onRegionChangeComplete?.({
        latitude: 10.76,
        longitude: 106.66,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      });
    }, [onMapReady, onRegionChangeComplete]);

    return (
      <View
        testID={testID ?? 'mock-map-view'}
        onRegionChangeComplete={onRegionChangeComplete}
      >
        <Pressable testID="mock-map-press" onPress={() => onPress?.({})} />
        {children}
      </View>
    );
  });
  MockMapView.displayName = 'MockMapView';

  const Marker = ({ children, onPress, onSelect, testID, ...props }: any) => (
    <Pressable
      testID={testID}
      {...props}
      onPress={() => {
        onPress?.({ stopPropagation: () => undefined });
        onSelect?.();
      }}
    >
      {children}
    </Pressable>
  );

  return {
    __esModule: true,
    default: MockMapView,
    Marker,
    Callout: ({ children }: any) => <View>{children}</View>,
  };
});

describe('MapScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReduceMotionEnabled = false;
    setPlatformOS('ios');
    resetMockNotes();
    resetMockSharedPosts();
  });

  afterAll(() => {
    setPlatformOS('ios');
  });

  it('keeps the top controls mounted while filter empty states appear and clear', async () => {
    const { getByTestId, getByText, queryByTestId } = render(<MapScreen />);

    const topHeader = getByTestId('map-top-header');
    const overlayHost = getByTestId('map-overlay-host');
    expect(within(topHeader).getByTestId('map-inline-count')).toBeTruthy();
    expect(within(topHeader).getByTestId('map-filter-all')).toBeTruthy();
    expect(queryByTestId('map-count-badge')).toBeNull();
    expect(overlayHost).toBeTruthy();
    expect(getByTestId('map-friends-chip')).toBeTruthy();

    expect(getByText('2 notes')).toBeTruthy();

    fireEvent.press(getByTestId('map-filter-photo'));
    await waitFor(() => {
      expect(getByText('1 note · filtered')).toBeTruthy();
    });

    fireEvent.press(getByTestId('map-filter-favorites'));

    await waitFor(() => {
      expect(getByText('No notes match these filters')).toBeTruthy();
      expect(getByTestId('map-top-header')).toBeTruthy();
      expect(getByTestId('map-overlay-host')).toBeTruthy();
    });

    fireEvent.press(getByTestId('map-clear-filters'));
    await waitFor(() => {
      expect(getByText('2 notes')).toBeTruthy();
      expect(getByTestId('map-top-header')).toBeTruthy();
      expect(getByTestId('map-overlay-host')).toBeTruthy();
    });
  });

  it('keeps recenter control operable', async () => {
    const { getByTestId } = render(<MapScreen />);

    fireEvent.press(getByTestId('map-recenter'));

    await waitFor(() => {
      const lastCall = mockAnimateToRegion.mock.calls[mockAnimateToRegion.mock.calls.length - 1];
      expect(lastCall?.[0]?.latitude).toBeCloseTo(10.7605, 3);
      expect(lastCall?.[0]?.longitude).toBeCloseTo(106.6605, 3);
    });
  });

  it('shows an in-area empty state and can temporarily reveal all matching results', async () => {
    const { getByTestId, getByText, queryByText } = render(<MapScreen />);

    act(() => {
      getByTestId('map-canvas').props.onRegionChangeComplete({
        latitude: 11.4,
        longitude: 107.4,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    });

    await waitFor(() => {
      expect(getByTestId('map-preview-shell')).toBeTruthy();
      expect(getByTestId('map-show-all-results')).toBeTruthy();
    });

    fireEvent.press(getByTestId('map-show-all-results'));

    await waitFor(() => {
      expect(getByTestId('map-preview-shell')).toBeTruthy();
      expect(getByTestId('map-preview-list')).toBeTruthy();
      expect(getByTestId('map-preview-item-text-1')).toBeTruthy();
      expect(getByText('2 notes · all results')).toBeTruthy();
    });

    act(() => {
      getByTestId('map-canvas').props.onRegionChangeComplete({
        latitude: 10.8,
        longitude: 106.7,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    });

    await waitFor(() => {
      expect(queryByText('2 notes · all results')).toBeNull();
    });
  });

  it('shows a passive no-notes state without a create-note action', async () => {
    replaceMockNotes([]);
    resetMockSharedPosts();
    mockSharedPosts.splice(0, mockSharedPosts.length);

    const { findByText, queryByTestId } = render(<MapScreen />);

    expect(await findByText('No notes')).toBeTruthy();
    expect(queryByTestId('map-create-first-note')).toBeNull();
  });

  it('keeps the no-notes state visible even when shared markers exist on the map', async () => {
    replaceMockNotes([]);
    resetMockSharedPosts();

    const { findByText, getByTestId, queryByTestId } = render(<MapScreen />);

    expect(await findByText('No notes')).toBeTruthy();
    expect(getByTestId('friend-marker-shared-friend-1')).toBeTruthy();
    expect(queryByTestId('map-create-first-note')).toBeNull();
  });

  it('clears stale status actions when transitioning into the no-notes state', async () => {
    resetMockSharedPosts();
    mockSharedPosts.splice(0, mockSharedPosts.length);

    const { getByTestId, findByText, queryByTestId, rerender } = render(<MapScreen />);

    fireEvent.press(getByTestId('map-filter-photo'));
    fireEvent.press(getByTestId('map-filter-favorites'));

    expect(await findByText('No notes match these filters')).toBeTruthy();
    expect(getByTestId('map-clear-filters')).toBeTruthy();

    replaceMockNotes([]);
    rerender(<MapScreen />);

    expect(await findByText('No notes')).toBeTruthy();
    expect(queryByTestId('map-clear-filters')).toBeNull();
    expect(queryByTestId('map-create-first-note')).toBeNull();
  });

  it('keeps the initial map entry static', () => {
    render(<MapScreen />);

    expect(mockAnimateToRegion).not.toHaveBeenCalled();
  });

  it('mounts the shared map experience on Android instead of the placeholder fallback', async () => {
    setPlatformOS('android');

    const { getByTestId, queryByTestId, queryByText } = render(<MapScreen />);

    await waitFor(() => {
      expect(getByTestId('map-canvas')).toBeTruthy();
    });
    expect(queryByTestId('map-android-fallback')).toBeNull();
    expect(queryByText('Map is temporarily unavailable on Android')).toBeNull();
  });

  it('renders custom note markers on Android instead of lite pins', async () => {
    setPlatformOS('android');

    const { getByTestId } = render(<MapScreen />);

    await waitFor(() => {
      expect(getByTestId('leaf-marker-10.76000:106.66000')).toBeTruthy();
    });

    act(() => {
      getByTestId('map-canvas').props.onRegionChangeComplete({
        latitude: 10.76,
        longitude: 106.66,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      });
    });

    fireEvent.press(getByTestId('leaf-marker-10.76000:106.66000'));

    await waitFor(() => {
      expect(getByTestId('note-marker-text-1')).toBeTruthy();
    });
  });

  it('keeps the selected note callout mounted when the visible region updates on Android', async () => {
    setPlatformOS('android');

    const { getByTestId } = render(<MapScreen />);

    await waitFor(() => {
      expect(getByTestId('leaf-marker-10.76000:106.66000')).toBeTruthy();
    });

    act(() => {
      getByTestId('map-canvas').props.onRegionChangeComplete({
        latitude: 10.76,
        longitude: 106.66,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      });
    });

    fireEvent.press(getByTestId('leaf-marker-10.76000:106.66000'));

    await waitFor(() => {
      expect(getByTestId('note-marker-text-1')).toBeTruthy();
    });

    act(() => {
      getByTestId('map-canvas').props.onRegionChangeComplete({
        latitude: 10.7605,
        longitude: 106.6605,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      });
    });

    expect(getByTestId('note-marker-text-1')).toBeTruthy();
  });

  it('renders nearby mode in preview and opens the centered preview card on tap', async () => {
    const { getAllByTestId, getByTestId, queryByTestId } = render(<MapScreen />);

    expect(queryByTestId('nearby-rail')).toBeNull();
    await waitFor(() => {
      expect(getByTestId('map-preview-list')).toBeTruthy();
      expect(queryByTestId('map-preview-group-count')).toBeNull();
      expect(getByTestId('map-preview-primary-action').props.accessibilityLabel).toBe('Open note');
      expect(String(getByTestId('map-preview-index').props.children)).toMatch(/^1\/\d+$/);
    });

    fireEvent.press(getByTestId('map-preview-item-text-1'));

    await waitFor(() => {
      expect(mockOpenNoteDetail).toHaveBeenCalledWith('text-1');
    });
  });

  it('centers an off-center nearby preview card without opening the note', async () => {
    const { getByTestId } = render(<MapScreen />);

    await waitFor(() => {
      expect(getByTestId('map-preview-item-photo-1')).toBeTruthy();
      expect(getByTestId('map-preview-primary-action').props.accessibilityLabel).toBe('Open note');
      expect(String(getByTestId('map-preview-index').props.children)).toBe('1/2');
    });

    fireEvent.press(getByTestId('map-preview-item-photo-1'));

    await waitFor(() => {
      const lastCall = mockAnimateToRegion.mock.calls[mockAnimateToRegion.mock.calls.length - 1];
      expect(lastCall?.[0]?.latitude).toBeCloseTo(10.8, 2);
      expect(lastCall?.[0]?.longitude).toBeCloseTo(106.7, 2);
      expect(mockOpenNoteDetail).not.toHaveBeenCalled();
      expect(getByTestId('map-preview-primary-action').props.accessibilityLabel).toBe('Center on map');
      expect(String(getByTestId('map-preview-index').props.children)).toBe('2/2');
    });

    act(() => {
      getByTestId('map-canvas').props.onRegionChangeComplete({
        latitude: 10.8,
        longitude: 106.7,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      });
    });

    await waitFor(() => {
      expect(getByTestId('map-preview-primary-action').props.accessibilityLabel).toBe('Open note');
    });

    fireEvent.press(getByTestId('map-preview-item-photo-1'));

    await waitFor(() => {
      expect(mockOpenNoteDetail).toHaveBeenCalledWith('photo-1');
    });
  });

  it('swipes nearby preview and pans map to the focused note before opening', async () => {
    const { getByTestId } = render(<MapScreen />);
    const nearbyList = await waitFor(() => getByTestId('map-preview-list'));
    const snapInterval = nearbyList.props.snapToInterval;

    act(() => {
      getByTestId('map-canvas').props.onRegionChangeComplete({
        latitude: 10.76,
        longitude: 106.66,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      });
    });

    act(() => {
      nearbyList.props.onScrollBeginDrag({
        nativeEvent: {},
      });
      nearbyList.props.onMomentumScrollEnd({
        nativeEvent: {
          contentOffset: {
            x: snapInterval,
            y: 0,
          },
        },
      });
    });

    await waitFor(() => {
      expect(String(getByTestId('map-preview-index').props.children)).toBe('2/2');
      expect(getByTestId('map-preview-primary-action').props.accessibilityLabel).toBe('Center on map');
    });

    act(() => {
      getByTestId('map-canvas').props.onRegionChangeComplete({
        latitude: 10.8,
        longitude: 106.7,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      });
    });

    await waitFor(() => {
      expect(getByTestId('map-preview-primary-action').props.accessibilityLabel).toBe('Open note');
    });

    fireEvent.press(getByTestId('map-preview-item-photo-1'));

    await waitFor(() => {
      const lastCall = mockAnimateToRegion.mock.calls[mockAnimateToRegion.mock.calls.length - 1];
      expect(lastCall?.[0]?.latitude).toBeCloseTo(10.8, 2);
      expect(lastCall?.[0]?.longitude).toBeCloseTo(106.7, 2);
      expect(mockOpenNoteDetail).toHaveBeenCalledWith('photo-1');
    });
  });

  it('keeps the nearby preview on the focused item after programmatic camera movement completes', async () => {
    const { getByTestId } = render(<MapScreen />);
    const nearbyList = await waitFor(() => getByTestId('map-preview-list'));
    const snapInterval = nearbyList.props.snapToInterval;

    act(() => {
      nearbyList.props.onScrollBeginDrag({
        nativeEvent: {},
      });
      nearbyList.props.onMomentumScrollEnd({
        nativeEvent: {
          contentOffset: {
            x: snapInterval,
            y: 0,
          },
        },
      });
    });

    await waitFor(() => {
      expect(String(getByTestId('map-preview-index').props.children)).toBe('2/2');
    });

    act(() => {
      getByTestId('map-canvas').props.onRegionChangeComplete({
        latitude: 10.8,
        longitude: 106.7,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      });
    });

    await waitFor(() => {
      expect(String(getByTestId('map-preview-index').props.children)).toBe('2/2');
    });
  });

  it('keeps the nearby preview locked when the map reports a slightly different completion region after preview focus', async () => {
    const { getByTestId } = render(<MapScreen />);
    const nearbyList = await waitFor(() => getByTestId('map-preview-list'));
    const snapInterval = nearbyList.props.snapToInterval;

    act(() => {
      nearbyList.props.onScrollBeginDrag({
        nativeEvent: {},
      });
      nearbyList.props.onMomentumScrollEnd({
        nativeEvent: {
          contentOffset: {
            x: snapInterval,
            y: 0,
          },
        },
      });
    });

    await waitFor(() => {
      expect(String(getByTestId('map-preview-index').props.children)).toBe('2/2');
    });

    act(() => {
      getByTestId('map-canvas').props.onRegionChangeComplete({
        latitude: 10.8,
        longitude: 106.7,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      });
    });

    await waitFor(() => {
      expect(String(getByTestId('map-preview-index').props.children)).toBe('2/2');
    });
  });

  it('dismisses the selected preview when tapping outside the map content', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    let now = 1000;
    nowSpy.mockImplementation(() => now);

    const { getAllByTestId, getByTestId, getByText, queryByTestId } = render(<MapScreen />);

    await waitFor(() => {
      expect(getByTestId('map-preview-shell')).toBeTruthy();
      expect(getByTestId('map-preview-list')).toBeTruthy();
    });

    const leafMarkers = getAllByTestId(/leaf-marker-/);
    fireEvent.press(leafMarkers[0]);

    await waitFor(() => {
      expect(getByTestId('map-preview-shell')).toBeTruthy();
      expect(getByTestId('map-preview-list')).toBeTruthy();
      expect(getByText(/^\d+(?:\.\d)?(?:m|km)$/)).toBeTruthy();
      expect(queryByTestId('map-preview-index')).toBeNull();
      expect(queryByTestId('map-preview-group-count')).toBeNull();
    });
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);

    now = 1400;
    fireEvent.press(getByTestId('mock-map-press'));

    expect(getByTestId('map-preview-shell')).toBeTruthy();

    await waitForPreviewCloseAnimation();

    await waitFor(() => {
      expect(queryByTestId('map-preview-shell')).toBeNull();
    });

    nowSpy.mockRestore();
  });

  it('lets you dismiss the note preview until you focus a marker again', async () => {
    const { getAllByTestId, getByTestId, queryByTestId } = render(<MapScreen />);

    await waitFor(() => {
      expect(getByTestId('map-preview-shell')).toBeTruthy();
    });

    fireEvent.press(getByTestId('map-preview-dismiss'));

    expect(getByTestId('map-preview-shell')).toBeTruthy();

    await waitForPreviewCloseAnimation();

    await waitFor(() => {
      expect(getByTestId('map-show-preview')).toBeTruthy();
    });

    fireEvent.press(getByTestId('map-show-preview'));

    await waitFor(() => {
      expect(getByTestId('map-preview-list')).toBeTruthy();
    });

    fireEvent.press(getAllByTestId(/leaf-marker-/)[0]);

    await waitFor(() => {
      expect(getByTestId('map-preview-shell')).toBeTruthy();
    });
  });

  it('lets you reveal all matching notes when filters leave the current area empty', async () => {
    const { getByTestId } = render(<MapScreen />);

    act(() => {
      getByTestId('map-canvas').props.onRegionChangeComplete({
        latitude: 10.76,
        longitude: 106.66,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      });
    });

    await waitFor(() => {
      expect(getByTestId('map-preview-item-photo-1')).toBeTruthy();
    });

    fireEvent.press(getByTestId('map-preview-item-photo-1'));
    expect(mockOpenNoteDetail).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('map-filter-text'));
    fireEvent.press(getByTestId('map-show-all-results'));
    fireEvent.press(getByTestId('map-preview-item-text-1'));

    await waitFor(() => {
      expect(mockOpenNoteDetail).toHaveBeenCalledWith('text-1');
    });
  });

  it('turns on marker feedback tracking when a leaf marker is selected', async () => {
    const { getAllByTestId } = render(<MapScreen />);

    const [firstLeafMarker] = await waitFor(() => getAllByTestId(/leaf-marker-/));

    fireEvent.press(firstLeafMarker);

    await waitFor(() => {
      expect(getAllByTestId(/leaf-marker-/)[0].props.tracksViewChanges).toBe(true);
    });
  });

  it('shows a thumbnail marker for single photo notes at high zoom and when selected', async () => {
    const { getAllByTestId, getByTestId, queryByTestId } = render(<MapScreen />);

    expect(queryByTestId('photo-marker-photo-1')).toBeNull();

    act(() => {
      getByTestId('map-canvas').props.onRegionChangeComplete({
        latitude: 10.8,
        longitude: 106.7,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      });
    });

    await waitFor(() => {
      expect(getByTestId('photo-marker-photo-1')).toBeTruthy();
    });

    fireEvent.press(getByTestId('leaf-marker-10.80000:106.70000'));

    await waitFor(() => {
      expect(getByTestId('photo-marker-photo-1')).toBeTruthy();
    });
  });

  it('restores the photo marker after dismissing the preview for a selected photo note', async () => {
    const { getByTestId } = render(<MapScreen />);

    act(() => {
      getByTestId('map-canvas').props.onRegionChangeComplete({
        latitude: 10.8,
        longitude: 106.7,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      });
    });

    await waitFor(() => {
      expect(getByTestId('photo-marker-photo-1')).toBeTruthy();
    });

    fireEvent.press(getByTestId('leaf-marker-10.80000:106.70000'));

    await waitFor(() => {
      expect(getByTestId('map-preview-shell')).toBeTruthy();
    });

    fireEvent.press(getByTestId('map-preview-dismiss'));

    await waitForPreviewCloseAnimation();

    await waitFor(() => {
      expect(getByTestId('map-show-preview')).toBeTruthy();
      expect(getByTestId('photo-marker-photo-1')).toBeTruthy();
    });
  });

  it('shows an anchored selected preview above a single text marker', async () => {
    const { getByTestId } = render(<MapScreen />);

    act(() => {
      getByTestId('map-canvas').props.onRegionChangeComplete({
        latitude: 10.76,
        longitude: 106.66,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      });
    });

    fireEvent.press(getByTestId('leaf-marker-10.76000:106.66000'));

    await waitFor(() => {
      expect(getByTestId('note-marker-text-1')).toBeTruthy();
    });

    expect(getByTestId('leaf-marker-10.76000:106.66000').props.anchor).toMatchObject({
      x: 0.5,
      y: 0.86,
    });
    expect(mockAnimateToRegion).not.toHaveBeenCalled();
  });

  it('keeps a tapped marker selected when a follow-up map press fires immediately after selection', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    let now = 1000;
    nowSpy.mockImplementation(() => now);

    const { getByTestId, getByText } = render(<MapScreen />);

    act(() => {
      getByTestId('map-canvas').props.onRegionChangeComplete({
        latitude: 10.76,
        longitude: 106.66,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      });
    });

    fireEvent.press(getByTestId('leaf-marker-10.76000:106.66000'));

    await waitFor(() => {
      expect(getByTestId('note-marker-text-1')).toBeTruthy();
      expect(getByText(/^\d+(?:\.\d)?(?:m|km)$/)).toBeTruthy();
    });

    now = 1100;
    fireEvent.press(getByTestId('mock-map-press'));

    expect(getByTestId('note-marker-text-1')).toBeTruthy();
    expect(getByText(/^\d+(?:\.\d)?(?:m|km)$/)).toBeTruthy();

    nowSpy.mockRestore();
  });

  it('keeps the selected note callout mounted when the visible region updates', async () => {
    const { getByTestId } = render(<MapScreen />);

    act(() => {
      getByTestId('map-canvas').props.onRegionChangeComplete({
        latitude: 10.76,
        longitude: 106.66,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      });
    });

    fireEvent.press(getByTestId('leaf-marker-10.76000:106.66000'));

    await waitFor(() => {
      expect(getByTestId('note-marker-text-1')).toBeTruthy();
    });

    act(() => {
      getByTestId('map-canvas').props.onRegionChangeComplete({
        latitude: 10.7605,
        longitude: 106.6605,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      });
    });

    expect(getByTestId('note-marker-text-1')).toBeTruthy();
  });

  it('keeps the pinned preview visible after opening the note and a follow-up map update', async () => {
    const { getByTestId } = render(<MapScreen />);

    act(() => {
      getByTestId('map-canvas').props.onRegionChangeComplete({
        latitude: 10.76,
        longitude: 106.66,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      });
    });

    fireEvent.press(getByTestId('leaf-marker-10.76000:106.66000'));

    await waitFor(() => {
      expect(getByTestId('note-marker-text-1')).toBeTruthy();
    });

    fireEvent.press(getByTestId('map-preview-item-text-1'));

    await waitFor(() => {
      expect(mockOpenNoteDetail).toHaveBeenCalledWith('text-1');
    });

    act(() => {
      getByTestId('map-canvas').props.onRegionChangeComplete({
        latitude: 10.7626,
        longitude: 106.6626,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      });
    });

    expect(getByTestId('map-preview-shell')).toBeTruthy();
    expect(getByTestId('map-preview-item-text-1')).toBeTruthy();
  });

  it('keeps the pinned preview visible for the start of the dismiss animation while the base marker stays mounted', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    let now = 1000;
    nowSpy.mockImplementation(() => now);

    const { getByTestId, getByText } = render(<MapScreen />);

    act(() => {
      getByTestId('map-canvas').props.onRegionChangeComplete({
        latitude: 10.76,
        longitude: 106.66,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      });
    });

    fireEvent.press(getByTestId('leaf-marker-10.76000:106.66000'));

    await waitFor(() => {
      expect(getByTestId('note-marker-text-1')).toBeTruthy();
      expect(getByText(/^\d+(?:\.\d)?(?:m|km)$/)).toBeTruthy();
    });

    now = 1400;
    fireEvent.press(getByTestId('mock-map-press'));

    expect(getByTestId('leaf-marker-10.76000:106.66000')).toBeTruthy();
    expect(getByText(/^\d+(?:\.\d)?(?:m|km)$/)).toBeTruthy();

    nowSpy.mockRestore();
  });

  it('keeps same-place notes compact on the map even when focused', async () => {
    replaceMockNotes([
      {
        id: 'same-1',
        type: 'photo',
        content: 'file:///same-1.jpg',
        locationName: 'Phu Nhuan',
        latitude: 10.8,
        longitude: 106.7,
        radius: 150,
        isFavorite: false,
        createdAt: '2026-03-12T00:00:00.000Z',
        updatedAt: null,
      },
      {
        id: 'same-2',
        type: 'text',
        content: 'Coffee note',
        locationName: 'Phu Nhuan',
        latitude: 10.8,
        longitude: 106.7,
        radius: 150,
        isFavorite: true,
        createdAt: '2026-03-11T00:00:00.000Z',
        updatedAt: null,
      },
      {
        id: 'same-3',
        type: 'text',
        content: 'Dinner note',
        locationName: 'Phu Nhuan',
        latitude: 10.8,
        longitude: 106.7,
        radius: 150,
        isFavorite: false,
        createdAt: '2026-03-10T00:00:00.000Z',
        updatedAt: null,
      },
    ]);

    const { getAllByTestId, getByTestId, queryByTestId } = render(<MapScreen />);

    act(() => {
      getByTestId('map-canvas').props.onRegionChangeComplete({
        latitude: 10.8,
        longitude: 106.7,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      });
    });

    expect(queryByTestId('stack-marker-same-1')).toBeNull();
    expect(queryByTestId('note-marker-same-1')).toBeNull();

    fireEvent.press(getByTestId('leaf-marker-10.80000:106.70000'));

    await waitFor(() => {
      expect(getByTestId('map-preview-shell')).toBeTruthy();
      expect(queryByTestId('map-preview-group-count')).toBeNull();
      expect(getByTestId('map-preview-action')).toBeTruthy();
      expect(String(getByTestId('map-preview-index').props.children)).toBe('1/3');
      expect(queryByTestId('stack-marker-same-1')).toBeNull();
      expect(queryByTestId('note-marker-same-1')).toBeNull();
    });
  });

  it('pulses cluster feedback and zooms the camera when a cluster marker is pressed', async () => {
    replaceMockNotes([
      {
        id: 'cluster-1',
        type: 'text',
        content: 'Cluster one',
        locationName: 'A',
        latitude: 10.68,
        longitude: 106.58,
        radius: 150,
        isFavorite: false,
        createdAt: '2026-03-11T00:00:00.000Z',
        updatedAt: null,
      },
      {
        id: 'cluster-2',
        type: 'photo',
        content: 'file:///cluster-2.jpg',
        locationName: 'B',
        latitude: 10.74,
        longitude: 106.64,
        radius: 150,
        isFavorite: false,
        createdAt: '2026-03-10T00:00:00.000Z',
        updatedAt: null,
      },
      {
        id: 'cluster-3',
        type: 'text',
        content: 'Cluster three',
        locationName: 'C',
        latitude: 10.8,
        longitude: 106.7,
        radius: 150,
        isFavorite: true,
        createdAt: '2026-03-09T00:00:00.000Z',
        updatedAt: null,
      },
      {
        id: 'cluster-4',
        type: 'photo',
        content: 'file:///cluster-4.jpg',
        locationName: 'D',
        latitude: 10.86,
        longitude: 106.76,
        radius: 150,
        isFavorite: false,
        createdAt: '2026-03-08T00:00:00.000Z',
        updatedAt: null,
      },
    ]);

    const { getAllByTestId, getByTestId } = render(<MapScreen />);

    act(() => {
      getByTestId('map-canvas').props.onRegionChangeComplete({
        latitude: 10.77,
        longitude: 106.67,
        latitudeDelta: 20,
        longitudeDelta: 20,
      });
    });

    const clusterMarker = await waitFor(() => getAllByTestId(/cluster-marker-/)[0]);
    fireEvent.press(clusterMarker);

    await waitFor(() => {
      const lastCall = mockAnimateToRegion.mock.calls[mockAnimateToRegion.mock.calls.length - 1];
      expect(lastCall?.[1]).toBe(350);
      expect(mockImpactAsync).toHaveBeenCalled();
    });
  });

  it('uses zero-duration camera animation when reduced motion is enabled', async () => {
    mockReduceMotionEnabled = true;

    replaceMockNotes([
      {
        id: 'cluster-1',
        type: 'text',
        content: 'Cluster one',
        locationName: 'A',
        latitude: 10.68,
        longitude: 106.58,
        radius: 150,
        isFavorite: false,
        createdAt: '2026-03-11T00:00:00.000Z',
        updatedAt: null,
      },
      {
        id: 'cluster-2',
        type: 'photo',
        content: 'file:///cluster-2.jpg',
        locationName: 'B',
        latitude: 10.74,
        longitude: 106.64,
        radius: 150,
        isFavorite: false,
        createdAt: '2026-03-10T00:00:00.000Z',
        updatedAt: null,
      },
      {
        id: 'cluster-3',
        type: 'text',
        content: 'Cluster three',
        locationName: 'C',
        latitude: 10.8,
        longitude: 106.7,
        radius: 150,
        isFavorite: true,
        createdAt: '2026-03-09T00:00:00.000Z',
        updatedAt: null,
      },
      {
        id: 'cluster-4',
        type: 'photo',
        content: 'file:///cluster-4.jpg',
        locationName: 'D',
        latitude: 10.86,
        longitude: 106.76,
        radius: 150,
        isFavorite: false,
        createdAt: '2026-03-08T00:00:00.000Z',
        updatedAt: null,
      },
    ]);

    const { getAllByTestId, getByTestId } = render(<MapScreen />);

    fireEvent.press(getByTestId('map-recenter'));

    await waitFor(() => {
      const lastCall = mockAnimateToRegion.mock.calls[mockAnimateToRegion.mock.calls.length - 1];
      expect(lastCall?.[1]).toBe(0);
    });

    act(() => {
      getByTestId('map-canvas').props.onRegionChangeComplete({
        latitude: 10.77,
        longitude: 106.67,
        latitudeDelta: 20,
        longitudeDelta: 20,
      });
    });

    fireEvent.press(await waitFor(() => getAllByTestId(/cluster-marker-/)[0]));

    await waitFor(() => {
      const lastCall = mockAnimateToRegion.mock.calls[mockAnimateToRegion.mock.calls.length - 1];
      expect(lastCall?.[1]).toBe(0);
    });
  });

  it('shows friend memories in the preview container and opens shared detail', async () => {
    const { getByTestId, getByText, queryByTestId } = render(<MapScreen />);

    fireEvent.press(getByTestId('map-friends-chip'));

    await waitFor(() => {
      expect(getByTestId('map-friends-preview-shell')).toBeTruthy();
    });
    const friendPreview = getByTestId('map-friends-preview-item-shared-friend-1');
    expect(within(friendPreview).getByText('District 3')).toBeTruthy();
    expect(within(friendPreview).getByText('Shared coffee memory')).toBeTruthy();
    expect(queryByTestId('map-friends-preview-item-shared-owned-1')).toBeNull();
    expect(getByText('Open shared')).toBeTruthy();

    fireEvent.press(getByTestId('map-friends-preview-open'));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/shared/shared-friend-1');
    });
  });

  it('renders friend markers on the map and opens the friend preview when pressed', async () => {
    const { getByTestId } = render(<MapScreen />);

    fireEvent.press(getByTestId('friend-marker-shared-friend-1'));

    await waitFor(() => {
      expect(getByTestId('map-friends-preview-shell')).toBeTruthy();
      expect(getByTestId('map-friends-preview-item-shared-friend-1')).toBeTruthy();
    });
  });
});

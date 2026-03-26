import React from 'react';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { Platform } from 'react-native';
import MapScreen from '../app/(tabs)/map';

const mockOpenNoteDetail = jest.fn();
const mockRouterPush = jest.fn();
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
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => mockRouterPush(...args),
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

jest.mock('../hooks/useNoteDetailSheet', () => ({
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

  it('keeps the initial map entry static', () => {
    render(<MapScreen />);

    expect(mockAnimateToRegion).not.toHaveBeenCalled();
  });

  it('skips mounting the native map on Android and shows a fallback card', () => {
    setPlatformOS('android');

    const { getByTestId, getByText, queryByTestId } = render(<MapScreen />);

    expect(getByTestId('map-android-fallback')).toBeTruthy();
    expect(getByText('Map is temporarily unavailable on Android')).toBeTruthy();
    expect(queryByTestId('map-canvas')).toBeNull();
  });

  it('renders nearby mode in preview and opens only on explicit open action', async () => {
    const { getByTestId, queryByTestId } = render(<MapScreen />);

    expect(queryByTestId('nearby-rail')).toBeNull();
    expect(getByTestId('map-preview-list')).toBeTruthy();
    expect(String(getByTestId('map-preview-index').props.children)).toMatch(/^1\/\d+$/);

    fireEvent.press(getByTestId('map-preview-item-text-1'));
    expect(mockOpenNoteDetail).not.toHaveBeenCalled();
    expect(mockRouterPush).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('map-preview-open'));
    await waitFor(() => {
      expect(mockOpenNoteDetail).toHaveBeenCalledWith('text-1');
    });
  });

  it('swipes nearby preview and pans map to focused note', async () => {
    const { getByTestId } = render(<MapScreen />);
    const nearbyList = getByTestId('map-preview-list');
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

    fireEvent.press(getByTestId('map-preview-open'));
    await waitFor(() => {
      const lastCall = mockAnimateToRegion.mock.calls[mockAnimateToRegion.mock.calls.length - 1];
      expect(lastCall?.[0]?.latitude).toBeCloseTo(10.8, 2);
      expect(lastCall?.[0]?.longitude).toBeCloseTo(106.7, 2);
      expect(mockOpenNoteDetail).toHaveBeenCalledWith('photo-1');
    });
  });

  it('keeps the preview rail mounted when switching between marker and nearby modes', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    let now = 1000;
    nowSpy.mockImplementation(() => now);

    const { getAllByTestId, getByTestId, getByText, queryByText } = render(<MapScreen />);

    expect(getByTestId('map-preview-shell')).toBeTruthy();
    expect(getByTestId('map-preview-list')).toBeTruthy();

    const leafMarkers = getAllByTestId(/leaf-marker-/);
    fireEvent.press(leafMarkers[0]);

    await waitFor(() => {
      expect(getByTestId('map-preview-shell')).toBeTruthy();
      expect(getByTestId('map-preview-list')).toBeTruthy();
      expect(getByText('Pinned note')).toBeTruthy();
    });
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);

    now = 1400;
    fireEvent.press(getByTestId('mock-map-press'));

    await waitFor(() => {
      expect(getByTestId('map-preview-shell')).toBeTruthy();
      expect(getByTestId('map-preview-list')).toBeTruthy();
      expect(queryByText('Pinned note')).toBeNull();
    });

    nowSpy.mockRestore();
  });

  it('falls back focused nearby note when filters remove current focus', async () => {
    const { getByTestId } = render(<MapScreen />);

    act(() => {
      getByTestId('map-canvas').props.onRegionChangeComplete({
        latitude: 10.76,
        longitude: 106.66,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      });
    });

    fireEvent.press(getByTestId('map-preview-item-photo-1'));

    fireEvent.press(getByTestId('map-filter-text'));
    fireEvent.press(getByTestId('map-preview-open'));

    await waitFor(() => {
      expect(mockOpenNoteDetail).toHaveBeenCalledWith('text-1');
    });
  });

  it('turns on marker feedback tracking when a leaf marker is selected', async () => {
    const { getAllByTestId } = render(<MapScreen />);

    const [firstLeafMarker] = getAllByTestId(/leaf-marker-/);
    expect(firstLeafMarker.props.tracksViewChanges).toBe(false);

    fireEvent.press(firstLeafMarker);

    await waitFor(() => {
      expect(getAllByTestId(/leaf-marker-/)[0].props.tracksViewChanges).toBe(true);
    });
  });

  it('shows a thumbnail marker for single photo notes at high zoom and when selected', async () => {
    const { getByTestId, queryByTestId } = render(<MapScreen />);

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

  it('shows friend memories in the preview container after the scan and opens shared detail', async () => {
    const { getByTestId, getByText, queryByTestId } = render(<MapScreen />);

    fireEvent.press(getByTestId('map-friends-chip'));

    expect(getByTestId('map-friends-preview-shell')).toBeTruthy();
    expect(getByTestId('map-friends-scan')).toBeTruthy();
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
});

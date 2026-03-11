import React from 'react';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';

const mockOpenNoteDetail = jest.fn();
const mockRouterPush = jest.fn();
const mockAnimateToRegion = jest.fn();
const mockFitToCoordinates = jest.fn();
const mockRequestForegroundLocation = jest.fn();
const mockOpenAppSettings = jest.fn();

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
  impactAsync: jest.fn(),
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
    },
  }),
}));

jest.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

jest.mock('../hooks/useNoteDetailSheet', () => ({
  useNoteDetailSheet: () => ({
    openNoteDetail: (...args: unknown[]) => mockOpenNoteDetail(...args),
  }),
}));

const mockNotes = [
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

jest.mock('../hooks/useNotes', () => ({
  useNotesStore: () => ({
    loading: false,
    notes: mockNotes,
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

  const MockMapView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      animateToRegion: (...args: unknown[]) => mockAnimateToRegion(...args),
      fitToCoordinates: (...args: unknown[]) => mockFitToCoordinates(...args),
    }));

    React.useEffect(() => {
      props.onMapReady?.();
      props.onRegionChangeComplete?.({
        latitude: 10.76,
        longitude: 106.66,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      });
    }, []);

    return (
      <View
        testID={props.testID ?? 'mock-map-view'}
        onRegionChangeComplete={props.onRegionChangeComplete}
      >
        <Pressable testID="mock-map-press" onPress={() => props.onPress?.({})} />
        {props.children}
      </View>
    );
  });

  const Marker = ({ children, onPress, onSelect, testID }: any) => (
    <Pressable
      testID={testID}
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

import MapScreen from '../app/(tabs)/map';

describe('MapScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders unified map header and supports clearing filters', async () => {
    const { getByTestId, getByText, queryByTestId } = render(<MapScreen />);

    const topHeader = getByTestId('map-top-header');
    expect(within(topHeader).getByTestId('map-inline-count')).toBeTruthy();
    expect(within(topHeader).getByTestId('map-filter-all')).toBeTruthy();
    expect(queryByTestId('map-count-badge')).toBeNull();

    expect(getByText('2 notes')).toBeTruthy();

    fireEvent.press(getByTestId('map-filter-photo'));
    await waitFor(() => {
      expect(getByText('1 note · filtered')).toBeTruthy();
    });

    fireEvent.press(getByTestId('map-filter-favorites'));

    await waitFor(() => {
      expect(getByText('No notes match these filters')).toBeTruthy();
    });

    fireEvent.press(getByTestId('map-clear-filters'));
    await waitFor(() => {
      expect(getByText('2 notes')).toBeTruthy();
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

  it('renders nearby mode in preview and opens only on explicit open action', async () => {
    const { getByTestId, queryByTestId } = render(<MapScreen />);

    expect(queryByTestId('nearby-rail')).toBeNull();
    expect(getByTestId('map-preview-nearby-list')).toBeTruthy();
    expect(String(getByTestId('map-preview-nearby-index').props.children)).toMatch(/^1\/\d+$/);

    fireEvent.press(getByTestId('map-preview-nearby-text-1'));
    expect(mockOpenNoteDetail).not.toHaveBeenCalled();
    expect(mockRouterPush).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('map-preview-open'));
    await waitFor(() => {
      expect(mockOpenNoteDetail).toHaveBeenCalledWith('text-1');
    });
  });

  it('swipes nearby preview and pans map to focused note', async () => {
    const { getByTestId } = render(<MapScreen />);
    const nearbyList = getByTestId('map-preview-nearby-list');
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

  it('switches between marker group mode and nearby mode', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    let now = 1000;
    nowSpy.mockImplementation(() => now);

    const { getAllByTestId, getByTestId, queryByTestId } = render(<MapScreen />);

    expect(getByTestId('map-preview-nearby-list')).toBeTruthy();

    const leafMarkers = getAllByTestId(/leaf-marker-/);
    fireEvent.press(leafMarkers[0]);

    await waitFor(() => {
      expect(queryByTestId('map-preview-nearby-list')).toBeNull();
    });

    now = 1400;
    fireEvent.press(getByTestId('mock-map-press'));

    await waitFor(() => {
      expect(getByTestId('map-preview-nearby-list')).toBeTruthy();
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

    fireEvent.press(getByTestId('map-preview-nearby-photo-1'));

    fireEvent.press(getByTestId('map-filter-text'));
    fireEvent.press(getByTestId('map-preview-open'));

    await waitFor(() => {
      expect(mockOpenNoteDetail).toHaveBeenCalledWith('text-1');
    });
  });
});

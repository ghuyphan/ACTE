import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

const mockSearchBarProps: { onChangeText?: (event: { nativeEvent: { text: string } }) => void } = {};

jest.mock('expo-router', () => {
  const React = require('react');
  const { TextInput, View } = require('react-native');
  return {
    useRouter: () => ({
      push: jest.fn(),
    }),
    Stack: {
      Screen: () => null,
      SearchBar: (props: any) => {
        mockSearchBarProps.onChangeText = props.onChangeText;
        return <TextInput testID="search-bar" />;
      },
    },
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, options?: { count?: number }) =>
      fallback?.replace('{{count}}', String(options?.count ?? '')) ?? fallback ?? key,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

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

jest.mock('../hooks/useTheme', () => ({
  CardGradients: [['#333333', '#555555']],
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

jest.mock('../hooks/useNoteDetailSheet', () => ({
  useNoteDetailSheet: () => ({
    openNoteDetail: jest.fn(),
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
  }),
}));

jest.mock('../utils/dateUtils', () => ({
  formatDate: () => 'Mar 10',
}));

import SearchScreen from '../app/(tabs)/search/index';

describe('SearchScreen', () => {
  it('does not match photo file uris when searching', async () => {
    const { getByTestId, queryByText, getByText } = render(<SearchScreen />);

    expect(getByTestId('search-bar')).toBeTruthy();

    await act(async () => {
      mockSearchBarProps.onChangeText?.({ nativeEvent: { text: 'photo-1.jpg' } });
    });

    await waitFor(() => {
      expect(getByText('No notes found')).toBeTruthy();
    });

    await act(async () => {
      mockSearchBarProps.onChangeText?.({ nativeEvent: { text: 'District 3' } });
    });

    await waitFor(() => {
      expect(queryByText('District 3')).toBeTruthy();
    });
  });
});

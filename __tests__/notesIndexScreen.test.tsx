import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import NotesIndexScreen from '../app/notes/index';

const mockRouterReplace = jest.fn();
const mockRouterPush = jest.fn();
const mockRequestFeedFocus = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: (...args: unknown[]) => mockRouterReplace(...args),
    push: (...args: unknown[]) => mockRouterPush(...args),
  }),
  Stack: {
    Screen: () => null,
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
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

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'me' },
  }),
}));

jest.mock('../hooks/useTheme', () => ({
  CardGradients: [['#333333', '#555555']],
  useTheme: () => ({
    colors: {
      background: '#FAF9F6',
      card: '#FFFFFF',
      border: '#E5E5EA',
      primary: '#FFC107',
      text: '#1C1C1E',
      secondaryText: '#8E8E93',
    },
  }),
}));

jest.mock('../hooks/useFeedFocus', () => ({
  useFeedFocus: () => ({
    requestFeedFocus: (...args: unknown[]) => mockRequestFeedFocus(...args),
  }),
}));

jest.mock('../hooks/useNotes', () => ({
  useNotesStore: () => ({
    loading: false,
    notes: [
      {
        id: 'note-1',
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
    ],
  }),
}));

jest.mock('../hooks/useSharedFeed', () => ({
  useSharedFeedStore: () => ({
    loading: false,
    sharedPosts: [
      {
        id: 'shared-1',
        authorUid: 'friend-1',
        authorDisplayName: 'Lan',
        type: 'text',
        text: 'Shared memory',
        placeName: 'District 3',
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
  }),
}));

describe('NotesIndexScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queues a note focus request and returns to Home instead of pushing note detail', () => {
    const { getByText } = render(<NotesIndexScreen />);

    fireEvent.press(getByText('Newest note'));

    expect(mockRequestFeedFocus).toHaveBeenCalledWith({ kind: 'note', id: 'note-1' });
    expect(mockRouterReplace).toHaveBeenCalledWith('/(tabs)');
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('queues a shared-post focus request and returns to Home instead of pushing shared detail', () => {
    const { getByText } = render(<NotesIndexScreen />);

    fireEvent.press(getByText('Shared memory'));

    expect(mockRequestFeedFocus).toHaveBeenCalledWith({ kind: 'shared-post', id: 'shared-1' });
    expect(mockRouterReplace).toHaveBeenCalledWith('/(tabs)');
    expect(mockRouterPush).not.toHaveBeenCalled();
  });
});

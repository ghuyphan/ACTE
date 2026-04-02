/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import NotesIndexScreen from '../app/notes/index';

const mockRouterReplace = jest.fn();
const mockRouterPush = jest.fn();
const mockRequestFeedFocus = jest.fn();
const mockDownloadPhotoFromStorage = jest.fn();

const mockNotes = [
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
];

const mockSharedPosts: any[] = [
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
];

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{name}</Text>,
  };
});

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

jest.mock('../services/remoteMedia', () => ({
  SHARED_POST_MEDIA_BUCKET: 'shared-media',
  downloadPhotoFromStorage: (...args: unknown[]) => mockDownloadPhotoFromStorage(...args),
}));

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
      primarySoft: '#FFF3CD',
      text: '#1C1C1E',
      secondaryText: '#8E8E93',
    },
  }),
}));

jest.mock('../hooks/state/useFeedFocus', () => ({
  useFeedFocus: () => ({
    requestFeedFocus: (...args: unknown[]) => mockRequestFeedFocus(...args),
  }),
}));

jest.mock('../hooks/useNotes', () => ({
  useNotesStore: () => ({
    loading: false,
    notes: mockNotes,
  }),
}));

jest.mock('../hooks/useSharedFeed', () => ({
  useSharedFeedStore: () => ({
    loading: false,
    sharedPosts: mockSharedPosts,
  }),
}));

describe('NotesIndexScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotes.splice(
      0,
      mockNotes.length,
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
      }
    );
    mockSharedPosts.splice(
      0,
      mockSharedPosts.length,
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
      }
    );
  });

  it('renders a centered empty state when there are no notes or shared posts', () => {
    mockNotes.splice(0, mockNotes.length);
    mockSharedPosts.splice(0, mockSharedPosts.length);

    const { getByTestId, getByText } = render(<NotesIndexScreen />);

    expect(getByTestId('notes-empty-state')).toBeTruthy();
    expect(getByText('document-text-outline')).toBeTruthy();
    expect(getByText('No notes yet')).toBeTruthy();
  });

  it('queues a note focus request and returns to Home instead of pushing note detail', () => {
    const { getByText } = render(<NotesIndexScreen />);

    fireEvent.press(getByText('Newest note'));

    expect(mockRequestFeedFocus).toHaveBeenCalledWith({ kind: 'note', id: 'note-1' });
    expect(mockRouterReplace).toHaveBeenCalledWith('/');
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('queues a shared-post focus request and returns to Home instead of pushing shared detail', () => {
    const { getByText } = render(<NotesIndexScreen />);

    fireEvent.press(getByText('Shared memory'));

    expect(mockRequestFeedFocus).toHaveBeenCalledWith({ kind: 'shared-post', id: 'shared-1' });
    expect(mockRouterReplace).toHaveBeenCalledWith('/');
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('keeps shared photo tiles on a photo placeholder until the image hydrates', async () => {
    let resolveDownload: ((value: string) => void) | undefined;
    mockSharedPosts.splice(0, mockSharedPosts.length, {
      id: 'shared-photo',
      authorUid: 'friend-1',
      authorDisplayName: 'Lan',
      type: 'photo',
      text: 'Friend photo caption',
      photoPath: 'photos/friend-photo.jpg',
      photoLocalUri: null,
      placeName: 'District 5',
      createdAt: '2026-03-14T00:00:00.000Z',
    });
    mockDownloadPhotoFromStorage.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveDownload = resolve;
        })
    );

    const { getByTestId, queryByText, queryByTestId } = render(<NotesIndexScreen />);

    expect(getByTestId('shared-photo-grid-placeholder')).toBeTruthy();
    expect(queryByText('Friend photo caption')).toBeNull();

    resolveDownload?.('file:///friend-photo.jpg');

    await waitFor(() => {
      expect(queryByTestId('shared-photo-grid-placeholder')).toBeNull();
    });
  });
});

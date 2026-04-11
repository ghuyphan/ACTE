/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import NotesIndexScreen, { resolveNotesModeFromSwipe } from '../app/notes/index';

const mockRouterReplace = jest.fn();
const mockRouterPush = jest.fn();
const mockRequestFeedFocus = jest.fn();
const mockDownloadPhotoFromStorage = jest.fn();
const mockDynamicStickerCanvas = jest.fn();
const mockScheduleOnIdle = jest.fn();
const originalConsoleError = console.error;

const mockNotes: any[] = [
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
    t: (_key: string, defaultValueOrOptions?: unknown, maybeOptions?: { defaultValue?: string }) => {
      if (typeof defaultValueOrOptions === 'string') {
        return defaultValueOrOptions;
      }

      if (
        defaultValueOrOptions &&
        typeof defaultValueOrOptions === 'object' &&
        'defaultValue' in defaultValueOrOptions
      ) {
        return String((defaultValueOrOptions as { defaultValue?: string }).defaultValue ?? _key);
      }

      if (maybeOptions?.defaultValue) {
        return maybeOptions.defaultValue;
      }

      return _key;
    },
    i18n: { language: 'en' },
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

jest.mock('../components/notes/DynamicStickerCanvas', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return function MockDynamicStickerCanvas(props: any) {
    mockDynamicStickerCanvas(props);
    return (
      <View testID="mock-dynamic-sticker-canvas">
        <Text testID="mock-dynamic-sticker-min-size">
          {String(props.minimumBaseSize ?? 'default')}
        </Text>
      </View>
    );
  };
});

jest.mock('../components/notes/NoteDoodleCanvas', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockNoteDoodleCanvas() {
    return <View testID="mock-note-doodle-canvas" />;
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
  },
}));

jest.mock('../services/remoteMedia', () => ({
  SHARED_POST_MEDIA_BUCKET: 'shared-media',
  downloadPhotoFromStorage: (...args: unknown[]) => mockDownloadPhotoFromStorage(...args),
}));

jest.mock('../utils/scheduleOnIdle', () => ({
  scheduleOnIdle: (...args: unknown[]) => mockScheduleOnIdle(...args),
}));

jest.mock('../utils/dateUtils', () => ({
  formatDate: () => 'Mar 11, 12:00 AM',
  formatNoteTimestamp: () => '2 hr. ago',
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'me' },
  }),
}));

jest.mock('../hooks/useTheme', () => ({
  CardGradients: [['#333333', '#555555']],
  useTheme: () => ({
    isDark: false,
    colors: {
      background: '#FAF9F6',
      surface: '#F7F4EF',
      card: '#FFFFFF',
      border: '#E5E5EA',
      primary: '#FFC107',
      primarySoft: '#FFF3CD',
      accent: '#D97706',
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
    jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const [message] = args;
      if (typeof message === 'string' && message.includes('not wrapped in act')) {
        return;
      }

      originalConsoleError(...args);
    });
    mockScheduleOnIdle.mockImplementation((callback: () => void) => {
      callback();
      return { cancel: jest.fn() };
    });
    mockDynamicStickerCanvas.mockClear();
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
        hasStickers: true,
        stickerPlacementsJson: JSON.stringify([
          {
            id: 'placement-1',
            assetId: 'asset-1',
            x: 0.5,
            y: 0.5,
            scale: 1,
            rotation: 0,
            zIndex: 1,
            opacity: 1,
            asset: {
              id: 'asset-1',
              localUri: 'file:///sticker-1.png',
              mimeType: 'image/png',
            },
          },
        ]),
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders a centered empty state when there are no notes or shared posts', () => {
    mockNotes.splice(0, mockNotes.length);
    mockSharedPosts.splice(0, mockSharedPosts.length);

    const { getByTestId, getByText } = render(<NotesIndexScreen />);

    expect(getByTestId('notes-empty-state')).toBeTruthy();
    expect(getByText('document-text-outline')).toBeTruthy();
    expect(getByText('No notes yet')).toBeTruthy();
  });

  it('switches into recap mode for personal notes and shows the monthly summary', () => {
    const { getByTestId, getByText, queryByText } = render(<NotesIndexScreen />);

    fireEvent.press(getByTestId('notes-mode-recap'));

    expect(getByTestId('notes-recap-mode')).toBeTruthy();
    expect(getByText('March 2026')).toBeTruthy();
    expect(getByTestId('notes-recap-sticker-pile')).toBeTruthy();
    expect(getByText('Used this month')).toBeTruthy();
    expect(queryByText('Shared memory')).toBeNull();
  });

  it('shows the sticker collection as a first-class notes mode', () => {
    const { getByTestId, getByText, queryByText } = render(<NotesIndexScreen />);

    fireEvent.press(getByTestId('notes-mode-collection'));

    expect(getByTestId('notes-collection-mode')).toBeTruthy();
    expect(getByText('1x')).toBeTruthy();
    expect(queryByText('Newest note')).toBeNull();
  });

  it('shows an overflow badge for multi-photo days and a note tile for text-only days', () => {
    mockNotes.splice(
      0,
      mockNotes.length,
      {
        id: 'photo-1',
        type: 'photo',
        content: 'photos/photo-1.jpg',
        photoLocalUri: 'photos/photo-1.jpg',
        locationName: 'District 1',
        latitude: 10.7,
        longitude: 106.6,
        radius: 150,
        isFavorite: false,
        createdAt: '2026-03-11T00:00:00.000Z',
        updatedAt: null,
      },
      {
        id: 'photo-2',
        type: 'photo',
        content: 'photos/photo-2.jpg',
        photoLocalUri: 'photos/photo-2.jpg',
        locationName: 'District 1',
        latitude: 10.7,
        longitude: 106.6,
        radius: 150,
        isFavorite: false,
        createdAt: '2026-03-11T08:00:00.000Z',
        updatedAt: null,
      },
      {
        id: 'text-1',
        type: 'text',
        content: 'Text-only memory',
        locationName: 'District 3',
        latitude: 10.7,
        longitude: 106.6,
        radius: 150,
        isFavorite: false,
        createdAt: '2026-03-07T00:00:00.000Z',
        updatedAt: null,
      }
    );

    const { getByTestId } = render(<NotesIndexScreen />);

    fireEvent.press(getByTestId('notes-mode-recap'));

    expect(getByTestId('notes-recap-day-secondary-photo-2026-03-11')).toBeTruthy();
    expect(getByTestId('notes-recap-day-text-body-2026-03-07')).toBeTruthy();
  });

  it('renders the active mode pill with width immediately', () => {
    const { getByTestId } = render(<NotesIndexScreen />);

    const pillStyle = StyleSheet.flatten(getByTestId('notes-mode-pill').props.style);

    expect(pillStyle.width).toBeGreaterThan(0);
    expect(pillStyle.opacity).toBe(1);
  });

  it('shows month items by default, filters to a tapped day, and clears when tapped again', () => {
    const { getByTestId, getByText, queryByText } = render(<NotesIndexScreen />);

    fireEvent.press(getByTestId('notes-mode-recap'));

    expect(getByText('Used this month')).toBeTruthy();

    fireEvent.press(getByText('11'));

    expect(getByText('Mar 11')).toBeTruthy();
    expect(queryByText('Used this month')).toBeNull();

    fireEvent.press(getByText('11'));

    expect(getByText('Used this month')).toBeTruthy();
    expect(queryByText('Mar 11')).toBeNull();
  });

  it('switches back to all mode and restores the note grid content', () => {
    const { getByTestId, getByText } = render(<NotesIndexScreen />);

    fireEvent.press(getByTestId('notes-mode-recap'));
    expect(getByTestId('notes-recap-mode')).toBeTruthy();

    fireEvent.press(getByTestId('notes-mode-all'));

    expect(getByTestId('notes-mode-all').props.accessibilityState).toEqual({ selected: true });
    expect(getByText('Newest note')).toBeTruthy();
    expect(getByText('Shared memory')).toBeTruthy();
  });

  it('lets the user switch recap months from the header', () => {
    mockNotes.splice(
      0,
      mockNotes.length,
      {
        id: 'note-april',
        type: 'text',
        content: 'April note',
        locationName: 'District 1',
        latitude: 10.7,
        longitude: 106.6,
        radius: 150,
        isFavorite: false,
        createdAt: '2026-04-02T00:00:00.000Z',
        updatedAt: null,
      },
      {
        id: 'note-march',
        type: 'text',
        content: 'March note',
        locationName: 'District 3',
        latitude: 10.7,
        longitude: 106.6,
        radius: 150,
        isFavorite: false,
        createdAt: '2026-03-11T00:00:00.000Z',
        updatedAt: null,
      }
    );

    const { getByTestId, getByText } = render(<NotesIndexScreen />);

    fireEvent.press(getByTestId('notes-mode-recap'));

    expect(getByText('April 2026')).toBeTruthy();

    fireEvent.press(getByTestId('notes-recap-previous-month'));

    expect(getByText('March 2026')).toBeTruthy();

    fireEvent.press(getByTestId('notes-recap-next-month'));

    expect(getByText('April 2026')).toBeTruthy();
  });

  it('lets the user go to an empty previous month even when notes only exist in the current month', () => {
    mockNotes.splice(
      0,
      mockNotes.length,
      {
        id: 'note-april-only',
        type: 'text',
        content: 'April only note',
        locationName: 'District 1',
        latitude: 10.7,
        longitude: 106.6,
        radius: 150,
        isFavorite: false,
        createdAt: '2026-04-02T00:00:00.000Z',
        updatedAt: null,
      }
    );

    const { getByTestId, getByText, queryByTestId } = render(<NotesIndexScreen />);

    fireEvent.press(getByTestId('notes-mode-recap'));
    fireEvent.press(getByTestId('notes-recap-previous-month'));

    expect(getByText('March 2026')).toBeTruthy();
    expect(queryByTestId('notes-recap-sticker-pile')).toBeTruthy();
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

    await act(async () => {
      resolveDownload?.('file:///friend-photo.jpg');
    });

    await waitFor(() => {
      expect(queryByTestId('shared-photo-grid-placeholder')).toBeNull();
    });
  });

  it('re-renders tiles when grid decorations are revealed in all mode', async () => {
    const processEnv = process.env as NodeJS.ProcessEnv & { NODE_ENV?: string };
    const previousNodeEnv = processEnv.NODE_ENV;
    const originalRequestAnimationFrame = global.requestAnimationFrame;
    const originalCancelAnimationFrame = global.cancelAnimationFrame;

    processEnv.NODE_ENV = 'production';
    mockNotes.splice(0, mockNotes.length, {
      id: 'note-with-decorations',
      type: 'text',
      content: 'Decorated note',
      locationName: 'District 1',
      latitude: 10.7,
      longitude: 106.6,
      radius: 150,
      isFavorite: false,
      hasDoodle: true,
      doodleStrokesJson: JSON.stringify([{ color: '#FFFFFF', points: [0.1, 0.1, 0.2, 0.2] }]),
      hasStickers: true,
      stickerPlacementsJson: JSON.stringify([
        {
          id: 'placement-1',
          assetId: 'asset-1',
          x: 0.5,
          y: 0.5,
          scale: 1,
          rotation: 0,
          zIndex: 1,
          opacity: 1,
          asset: {
            id: 'asset-1',
            localUri: 'file:///sticker-1.png',
            mimeType: 'image/png',
          },
        },
      ]),
      createdAt: '2026-03-11T00:00:00.000Z',
      updatedAt: null,
    });

    jest.useFakeTimers();
    global.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }) as typeof requestAnimationFrame;
    global.cancelAnimationFrame = jest.fn();

    try {
      const { queryAllByTestId } = render(<NotesIndexScreen />);

      expect(queryAllByTestId('mock-dynamic-sticker-canvas')).toHaveLength(0);
      expect(queryAllByTestId('mock-note-doodle-canvas')).toHaveLength(0);

      await act(async () => {
        jest.advanceTimersByTime(220);
      });

      await waitFor(() => {
        expect(queryAllByTestId('mock-dynamic-sticker-canvas')).toHaveLength(1);
        expect(queryAllByTestId('mock-note-doodle-canvas')).toHaveLength(1);
      });
    } finally {
      processEnv.NODE_ENV = previousNodeEnv;
      global.requestAnimationFrame = originalRequestAnimationFrame;
      global.cancelAnimationFrame = originalCancelAnimationFrame;
      jest.useRealTimers();
    }
  });

  it('resolves left and right swipes into the expected modes', () => {
    expect(resolveNotesModeFromSwipe('all', -72, 0, true)).toBe('collection');
    expect(resolveNotesModeFromSwipe('collection', 0, -520, true)).toBe('recap');
    expect(resolveNotesModeFromSwipe('recap', 72, 0, true)).toBe('collection');
    expect(resolveNotesModeFromSwipe('collection', 0, 520, true)).toBe('all');
    expect(resolveNotesModeFromSwipe('all', -72, 0, false)).toBe('all');
    expect(resolveNotesModeFromSwipe('recap', 12, 40, true)).toBe('recap');
  });
});

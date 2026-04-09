import React from 'react';
import { render } from '@testing-library/react-native';
import SharedFeedScreen from '../app/shared/index';

const mockPush = jest.fn();
const mockSharedFeedState = {
  enabled: true,
  loading: false,
  dataSource: 'cache' as 'cache' | 'live',
  lastUpdatedAt: '2026-04-01T00:00:00.000Z' as string | null,
  sharedPosts: [
    {
      id: 'shared-1',
      authorUid: 'friend-1',
      authorDisplayName: 'Lan',
      authorPhotoURLSnapshot: null,
      audienceUserIds: ['me'],
      type: 'text' as const,
      text: 'Shared memory',
      photoPath: null,
      photoLocalUri: null,
      isLivePhoto: false,
      pairedVideoPath: null,
      pairedVideoLocalUri: null,
      doodleStrokesJson: null,
      hasStickers: false,
      stickerPlacementsJson: null,
      noteColor: null,
      placeName: 'District 3',
      sourceNoteId: 'note-1',
      latitude: null,
      longitude: null,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: null,
    },
  ],
};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => mockPush(...args),
  }),
  Stack: {
    Screen: () => null,
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, options?: { time?: string }) =>
      fallback?.replace('{{time}}', String(options?.time ?? '')) ?? fallback ?? key,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'me' },
  }),
}));

jest.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#FFFFFF',
      text: '#1C1C1E',
      secondaryText: '#8E8E93',
      primary: '#FFC107',
      primarySoft: 'rgba(255,193,7,0.15)',
      border: '#E5E5EA',
    },
  }),
}));

jest.mock('../hooks/useSharedFeed', () => ({
  useSharedFeedStore: () => mockSharedFeedState,
}));

jest.mock('../components/home/MemoryCardPrimitives', () => {
  const React = require('react');
  const { Text, View } = require('react-native');

  return {
    SharedPostMemoryCard: ({ post }: any) => (
      <View>
        <Text>{post.text}</Text>
      </View>
    ),
  };
});

jest.mock('../utils/dateUtils', () => ({
  formatNoteTimestamp: () => '2h',
}));

describe('SharedFeedScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSharedFeedState.enabled = true;
    mockSharedFeedState.loading = false;
    mockSharedFeedState.dataSource = 'cache';
    mockSharedFeedState.lastUpdatedAt = '2026-04-01T00:00:00.000Z';
  });

  it('shows a cache freshness banner when shared feed data is stale', () => {
    const { getByTestId, getByText } = render(<SharedFeedScreen />);

    expect(getByTestId('shared-feed-cache-banner')).toBeTruthy();
    expect(getByText('Showing saved shared moments')).toBeTruthy();
    expect(getByText('Last updated 2h. Live updates will resume when the connection returns.')).toBeTruthy();
  });

  it('hides the cache banner when live feed data is active', () => {
    mockSharedFeedState.dataSource = 'live';

    const { queryByTestId } = render(<SharedFeedScreen />);

    expect(queryByTestId('shared-feed-cache-banner')).toBeNull();
  });
});

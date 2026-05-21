import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import SharedChatsScreen from '../components/screens/shared/SharedChatsScreen';

const mockPush = jest.fn();
const mockGetSharedChatThreadPosts = jest.fn();
const mockGetSharedPostThreadSummaries = jest.fn();
const mockGetSharedThreadReadStates = jest.fn();
const mockGetCachedSharedThreadSummaries = jest.fn();
const mockSubscribeToSharedPostTyping = jest.fn();
let mockFocusCallbacks: Array<() => void | (() => void)> = [];

const mockDirectPost = {
  id: 'direct-chat-1',
  authorUid: 'me',
  authorDisplayName: 'Me',
  authorPhotoURLSnapshot: null,
  audienceUserIds: ['me', 'friend-1'],
  type: 'text' as const,
  text: '',
  photoPath: null,
  photoLocalUri: null,
  isLivePhoto: false,
  pairedVideoPath: null,
  pairedVideoLocalUri: null,
  doodleStrokesJson: null,
  hasStickers: false,
  stickerPlacementsJson: null,
  noteColor: null,
  placeName: null,
  sourceNoteId: null,
  isDirectChat: true,
  directChatKey: 'friend-1:me',
  latitude: null,
  longitude: null,
  createdAt: '2026-05-20T01:00:00.000Z',
  updatedAt: null,
};

const mockSharedFeedState = {
  friends: [
    {
      userId: 'friend-1',
      username: 'lan',
      displayNameSnapshot: 'Lan',
      nickname: null,
      photoURLSnapshot: null,
      friendedAt: '2026-05-20T00:00:00.000Z',
      lastSharedAt: null,
      createdByInviteId: null,
    },
    {
      userId: 'friend-2',
      username: 'mai',
      displayNameSnapshot: 'Mai',
      nickname: null,
      photoURLSnapshot: null,
      friendedAt: '2026-05-20T00:05:00.000Z',
      lastSharedAt: null,
      createdByInviteId: null,
    },
  ],
  loading: false,
  sharedPosts: [mockDirectPost],
  getSharedChatThreadPosts: mockGetSharedChatThreadPosts,
  getSharedPostThreadSummaries: mockGetSharedPostThreadSummaries,
  getSharedThreadReadStates: mockGetSharedThreadReadStates,
  subscribeToSharedPostTyping: mockSubscribeToSharedPostTyping,
};

function threadSummary(text: string, createdAt: string) {
  return {
    postId: mockDirectPost.id,
    latestResponseId: `response-${text}`,
    latestResponseCreatedAt: createdAt,
    latestActivityAt: createdAt,
    latestActivityAuthorUid: 'friend-1',
    latestActivityAuthorDisplayName: 'Lan',
    latestActivityAuthorPhotoURLSnapshot: null,
    latestActivityText: text,
    latestActivityEmoji: null,
    latestActivityKind: 'response' as const,
    updatedAt: createdAt,
  };
}

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(() => {
        mockFocusCallbacks.push(callback);
        const cleanup = callback();
        return () => {
          mockFocusCallbacks = mockFocusCallbacks.filter((candidate) => candidate !== callback);
          if (typeof cleanup === 'function') {
            cleanup();
          }
        };
      }, [callback]);
    },
    useRouter: () => ({
      push: (...args: unknown[]) => mockPush(...args),
    }),
  };
});

jest.mock('@shopify/flash-list', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    FlashList: ({ data, keyExtractor, renderItem }: any) => (
      <View>
        {(data ?? []).map((item: any, index: number) => (
          <View key={keyExtractor ? keyExtractor(item, index) : item.id ?? index}>
            {renderItem({ item, index })}
          </View>
        ))}
      </View>
    ),
  };
});

jest.mock('expo-image', () => ({
  Image: () => null,
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{name}</Text>,
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, options?: Record<string, unknown>) => {
      if (!fallback) {
        return key;
      }
      return Object.entries(options ?? {}).reduce(
        (message, [optionKey, optionValue]) =>
          message.replace(`{{${optionKey}}}`, String(optionValue)),
        fallback
      );
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    isReady: true,
    user: { uid: 'me' },
  }),
}));

jest.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#FFFFFF',
      border: '#E5E5EA',
      onPrimary: '#000000',
      primary: '#FFC107',
      primarySoft: 'rgba(255,193,7,0.15)',
      secondaryText: '#8E8E93',
      surface: '#F8F8F8',
      text: '#1C1C1E',
    },
  }),
}));

jest.mock('../hooks/useSharedFeed', () => ({
  useSharedFeedStore: () => mockSharedFeedState,
}));

jest.mock('../services/sharedFeedCache', () => ({
  getCachedSharedThreadSummaries: (...args: unknown[]) =>
    mockGetCachedSharedThreadSummaries(...args),
}));

describe('SharedChatsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFocusCallbacks = [];
    mockGetSharedChatThreadPosts.mockResolvedValue([mockDirectPost]);
    mockGetSharedPostThreadSummaries.mockResolvedValue([
      threadSummary('Old message', '2026-05-20T01:01:00.000Z'),
    ]);
    mockGetSharedThreadReadStates.mockResolvedValue([]);
    mockGetCachedSharedThreadSummaries.mockResolvedValue([
      threadSummary('Old message', '2026-05-20T01:01:00.000Z'),
    ]);
    mockSubscribeToSharedPostTyping.mockReturnValue({
      setTyping: jest.fn(),
      unsubscribe: jest.fn(),
    });
  });

  it('refreshes the latest preview from cached thread summaries when refocused', async () => {
    const { getByText } = render(<SharedChatsScreen />);

    await waitFor(() => {
      expect(getByText('@lan: Old message')).toBeTruthy();
    });

    mockGetCachedSharedThreadSummaries.mockResolvedValue([
      threadSummary('New message', '2026-05-20T01:02:00.000Z'),
    ]);
    mockGetSharedPostThreadSummaries.mockResolvedValue([
      threadSummary('New message', '2026-05-20T01:02:00.000Z'),
    ]);

    await act(async () => {
      for (const callback of [...mockFocusCallbacks]) {
        callback();
      }
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(getByText('@lan: New message')).toBeTruthy();
    });
  });

  it('keeps starter chats visible for friends without existing threads', async () => {
    const { getByText, getAllByText } = render(<SharedChatsScreen />);

    await waitFor(() => {
      expect(getByText('@lan: Old message')).toBeTruthy();
      expect(getByText('@mai')).toBeTruthy();
    });
    expect(getAllByText('Message privately')).toHaveLength(1);
  });
});

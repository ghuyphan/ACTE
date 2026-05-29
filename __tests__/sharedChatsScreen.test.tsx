import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import SharedChatsScreen from '../components/screens/shared/SharedChatsScreen';

const mockPush = jest.fn();
const mockGetSharedChatThreadPosts = jest.fn();
const mockGetSharedPostThreadSummaries = jest.fn();
const mockGetSharedThreadReadStates = jest.fn();
const mockGetHiddenSharedChatThreads = jest.fn();
const mockGetCachedSharedThreadSummaries = jest.fn();
const mockGetCachedSharedChatThreadPosts = jest.fn();
const mockGetCachedSharedThreadReadStates = jest.fn();
const mockSubscribeToSharedPostTyping = jest.fn();
let mockSharedChatThreadChangeListener: ((event: { userUid: string; postId?: string | null }) => void) | null = null;
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
  getHiddenSharedChatThreads: mockGetHiddenSharedChatThreads,
  subscribeToSharedPostTyping: mockSubscribeToSharedPostTyping,
};

function threadSummary(text: string | null, createdAt: string, authorUid = 'friend-1') {
  return {
    postId: mockDirectPost.id,
    latestResponseId: `response-${text ?? 'sticker'}-${authorUid}`,
    latestResponseCreatedAt: createdAt,
    latestActivityAt: createdAt,
    latestActivityAuthorUid: authorUid,
    latestActivityAuthorDisplayName: authorUid === 'me' ? 'Me' : 'Lan',
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
  getCachedSharedChatThreadPosts: (...args: unknown[]) =>
    mockGetCachedSharedChatThreadPosts(...args),
  getCachedSharedThreadReadStates: (...args: unknown[]) =>
    mockGetCachedSharedThreadReadStates(...args),
  getCachedSharedThreadSummaries: (...args: unknown[]) =>
    mockGetCachedSharedThreadSummaries(...args),
}));

jest.mock('../services/sharedChatThreadEvents', () => ({
  subscribeToSharedChatThreadChanges: (listener: (event: { userUid: string; postId?: string | null }) => void) => {
    mockSharedChatThreadChangeListener = listener;
    return () => {
      if (mockSharedChatThreadChangeListener === listener) {
        mockSharedChatThreadChangeListener = null;
      }
    };
  },
}));

describe('SharedChatsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSharedChatThreadChangeListener = null;
    mockFocusCallbacks = [];
    mockSharedFeedState.friends = [
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
    ];
    mockSharedFeedState.sharedPosts = [mockDirectPost];
    mockGetSharedChatThreadPosts.mockResolvedValue([mockDirectPost]);
    mockGetSharedPostThreadSummaries.mockResolvedValue([
      threadSummary('Old message', '2026-05-20T01:01:00.000Z'),
    ]);
    mockGetSharedThreadReadStates.mockResolvedValue([]);
    mockGetHiddenSharedChatThreads.mockResolvedValue([]);
    mockGetCachedSharedChatThreadPosts.mockResolvedValue([]);
    mockGetCachedSharedThreadReadStates.mockResolvedValue([]);
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
    expect(getAllByText('Message')).toHaveLength(1);
  });

  it('labels sticker-only latest messages from a friend or the current user', async () => {
    mockGetCachedSharedThreadSummaries.mockResolvedValue([
      threadSummary(null, '2026-05-20T01:02:00.000Z'),
    ]);
    mockGetSharedPostThreadSummaries.mockResolvedValue([
      threadSummary(null, '2026-05-20T01:02:00.000Z'),
    ]);

    const { getByText, rerender } = render(<SharedChatsScreen />);

    await waitFor(() => {
      expect(getByText('@lan: Sticker')).toBeTruthy();
    });

    mockGetCachedSharedThreadSummaries.mockResolvedValue([
      threadSummary(null, '2026-05-20T01:03:00.000Z', 'me'),
    ]);
    mockGetSharedPostThreadSummaries.mockResolvedValue([
      threadSummary(null, '2026-05-20T01:03:00.000Z', 'me'),
    ]);

    await act(async () => {
      for (const callback of [...mockFocusCallbacks]) {
        callback();
      }
      await Promise.resolve();
    });
    rerender(<SharedChatsScreen />);

    await waitFor(() => {
      expect(getByText('You: Sticker')).toBeTruthy();
    });
  });

  it('renders empty direct chat anchors like starter rows without badge or timestamp', async () => {
    mockSharedFeedState.friends = [mockSharedFeedState.friends[0]];
    mockGetCachedSharedThreadSummaries.mockResolvedValue([]);
    mockGetSharedPostThreadSummaries.mockResolvedValue([]);

    const { getByText, queryByText } = render(<SharedChatsScreen />);

    await waitFor(() => {
      expect(getByText('@lan')).toBeTruthy();
      expect(getByText('Message')).toBeTruthy();
    });
    expect(queryByText('chatbubble-ellipses-outline')).toBeNull();
    expect(queryByText('Wed')).toBeNull();
  });

  it('does not show unread before cached read state hydration finishes', async () => {
    mockGetSharedThreadReadStates.mockReturnValue(new Promise(() => undefined));

    const { getByLabelText, getByText, queryByLabelText } = render(<SharedChatsScreen />);

    await waitFor(() => {
      expect(getByText('@lan: Old message')).toBeTruthy();
    });
    expect(queryByLabelText('Open unread chat with @lan')).toBeNull();
    expect(getByLabelText('Open chat with @lan')).toBeTruthy();
  });

  it('paints cached direct threads before the remote thread list resolves', async () => {
    mockSharedFeedState.sharedPosts = [];
    mockGetSharedChatThreadPosts.mockReturnValue(new Promise(() => undefined));
    mockGetCachedSharedChatThreadPosts.mockResolvedValue([mockDirectPost]);

    const { getByText } = render(<SharedChatsScreen />);

    await waitFor(() => {
      expect(getByText('@lan: Old message')).toBeTruthy();
    });
    expect(mockGetSharedChatThreadPosts).toHaveBeenCalled();
  });

  it('refreshes preview and unread state from cache events without waiting for refocus', async () => {
    const { getByText, queryByText } = render(<SharedChatsScreen />);

    await waitFor(() => {
      expect(getByText('@lan: Old message')).toBeTruthy();
    });

    mockGetCachedSharedThreadSummaries.mockResolvedValue([
      threadSummary('Read message', '2026-05-20T01:03:00.000Z'),
    ]);
    mockGetCachedSharedThreadReadStates.mockResolvedValue([
      {
        postId: mockDirectPost.id,
        userUid: 'me',
        lastReadResponseId: 'response-Read message',
        lastReadAt: '2026-05-20T01:04:00.000Z',
      },
    ]);

    await act(async () => {
      mockSharedChatThreadChangeListener?.({ userUid: 'me', postId: mockDirectPost.id });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(getByText('@lan: Read message')).toBeTruthy();
    });
    expect(queryByText('@lan: Old message')).toBeNull();
  });
});

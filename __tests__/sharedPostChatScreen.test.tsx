import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Keyboard, Platform, StyleSheet } from 'react-native';
import SharedPostChatScreen from '../components/screens/shared/SharedPostChatScreen';

const mockGetSharedChatThreadPost = jest.fn();
const mockGetDirectChatThreadPost = jest.fn();
const mockGetSharedPostResponsesPage = jest.fn();
const mockCreateSharedPostResponse = jest.fn();
const mockMarkSharedThreadRead = jest.fn();
const mockScrollToEnd = jest.fn();
const mockScrollToIndex = jest.fn();
let mockNotes: unknown[] = [];
let mockLatestStickerPreviewItem: any = null;
let mockLatestThreadOnStartReached: (() => void) | null = null;
let mockLatestThreadOnScroll: ((event: unknown) => void) | null = null;

const directPost = {
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

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('@shopify/flash-list', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    FlashList: React.forwardRef(
      (
        { data, keyExtractor, onScroll, onStartReached, renderItem, ListEmptyComponent, onLoad }: any,
        ref: any
      ) => {
        React.useImperativeHandle(ref, () => ({
          scrollToEnd: mockScrollToEnd,
          scrollToIndex: mockScrollToIndex,
        }));
        React.useEffect(() => {
          mockLatestThreadOnStartReached = onStartReached ?? null;
          mockLatestThreadOnScroll = onScroll ?? null;
          return () => {
            if (mockLatestThreadOnStartReached === onStartReached) {
              mockLatestThreadOnStartReached = null;
            }
            if (mockLatestThreadOnScroll === onScroll) {
              mockLatestThreadOnScroll = null;
            }
          };
        }, [onScroll, onStartReached]);
        React.useEffect(() => {
          onLoad?.({ elapsedTimeInMs: 0 });
        }, [onLoad]);

        return (
          <View>
            {(data ?? []).length === 0 && ListEmptyComponent ? <ListEmptyComponent /> : null}
            {(data ?? []).map((item: any, index: number) => (
              <View key={keyExtractor ? keyExtractor(item, index) : item.id ?? index}>
                {renderItem({ item, index })}
              </View>
            ))}
          </View>
        );
      }
    ),
  };
});

jest.mock('expo-image', () => ({
  Image: () => null,
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: unknown }) => {
    const React = require('react');
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{name}</Text>,
  };
});

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));

jest.mock('../components/sheets/TextFieldEditSheet', () => () => null);
jest.mock('../components/ui/StickerIcon', () => () => null);
jest.mock('../components/notes/StickerLibraryPreview', () => (props: any) => {
  mockLatestStickerPreviewItem = props.item;
  return null;
});

jest.mock('../hooks/useNotes', () => ({
  useNotes: () => ({ notes: mockNotes }),
}));

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
    user: { uid: 'me', photoURL: null },
  }),
}));

jest.mock('../hooks/useConnectivity', () => ({
  useConnectivity: () => ({ isOnline: true }),
}));

jest.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#FFFFFF',
      border: '#E5E5EA',
      card: '#FFFFFF',
      danger: '#D92D20',
      onPrimary: '#000000',
      primary: '#FFC107',
      primarySoft: 'rgba(255,193,7,0.15)',
      secondaryText: '#8E8E93',
      surface: '#F8F8F8',
      text: '#1C1C1E',
    },
  }),
}));

jest.mock('../hooks/useHaptics', () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
  },
}));

jest.mock('../hooks/shared/useSharedPostTypingPresence', () => ({
  useSharedPostTypingPresence: () => ({
    clearTypingIdleTimer: jest.fn(),
    handleDraftChange: (_nextDraft: string, setDraft: (value: string) => void) =>
      setDraft(_nextDraft),
    publishTypingState: jest.fn(),
    typingUsers: [],
  }),
}));

jest.mock('../hooks/useSharedFeed', () => ({
  useSharedFeedStore: () => ({
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
    ],
    friendPresence: {},
    loading: false,
    sharedPosts: [],
    getDirectChatThreadPost: mockGetDirectChatThreadPost,
    getOrCreateDirectChatPost: jest.fn(),
    getSharedChatThreadPost: mockGetSharedChatThreadPost,
    getSharedPostResponsesPage: mockGetSharedPostResponsesPage,
    subscribeToSharedPostTyping: () => ({
      setTyping: jest.fn(),
      unsubscribe: jest.fn(),
    }),
    updateFriendNickname: jest.fn(),
    createSharedPostResponseReaction: jest.fn(),
    deleteSharedPostResponseReaction: jest.fn(),
    markSharedThreadRead: mockMarkSharedThreadRead,
    createSharedPostResponse: mockCreateSharedPostResponse,
  }),
}));

describe('SharedPostChatScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockScrollToEnd.mockClear();
    mockScrollToIndex.mockClear();
    mockLatestThreadOnStartReached = null;
    mockLatestThreadOnScroll = null;
    mockLatestStickerPreviewItem = null;
    mockNotes = [];
    mockCreateSharedPostResponse.mockResolvedValue({
      id: 'response-2',
      postId: directPost.id,
      authorUid: 'me',
      authorDisplayName: 'Me',
      authorPhotoURLSnapshot: null,
      emoji: null,
      text: 'sent from test',
      replyToResponseId: null,
      reactions: [],
      createdAt: '2026-05-20T01:02:00.000Z',
    });
    mockMarkSharedThreadRead.mockResolvedValue(null);
    mockGetSharedChatThreadPost.mockResolvedValue(directPost);
    mockGetDirectChatThreadPost.mockResolvedValue(null);
    mockGetSharedPostResponsesPage.mockResolvedValue([
      {
        id: 'response-1',
        postId: directPost.id,
        authorUid: 'friend-1',
        authorDisplayName: 'Lan',
        authorPhotoURLSnapshot: null,
        emoji: null,
        text: 'hello from cache miss',
        replyToResponseId: null,
        reactions: [],
        createdAt: '2026-05-20T01:01:00.000Z',
      },
    ]);
  });

  function createStickerNote() {
    return {
      id: 'sticker-note-1',
      type: 'text',
      content: '',
      caption: null,
      photoLocalUri: null,
      photoSyncedLocalUri: null,
      photoRemoteBase64: null,
      isLivePhoto: false,
      pairedVideoLocalUri: null,
      pairedVideoSyncedLocalUri: null,
      pairedVideoRemotePath: null,
      locationName: null,
      promptId: null,
      promptTextSnapshot: null,
      promptAnswer: null,
      moodEmoji: null,
      noteColor: null,
      latitude: 0,
      longitude: 0,
      radius: 150,
      isFavorite: false,
      hasDoodle: false,
      doodleStrokesJson: null,
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
          renderMode: 'default',
          asset: {
            id: 'asset-1',
            ownerUid: '__local__',
            localUri: 'file:///asset-1.png',
            remotePath: null,
            mimeType: 'image/png',
            width: 200,
            height: 200,
            createdAt: '2026-04-01T00:00:00.000Z',
            updatedAt: null,
            source: 'import',
          },
        },
      ]),
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: null,
    };
  }

  it('loads a direct chat by post id even when the route also includes friendUid', async () => {
    const { getByText } = render(
      <SharedPostChatScreen
        directFriendUid="friend-1"
        postId="direct-chat-1"
      />
    );

    await waitFor(() => {
      expect(mockGetSharedChatThreadPost).toHaveBeenCalledWith('direct-chat-1');
      expect(getByText('hello from cache miss')).toBeTruthy();
    });
    expect(mockGetDirectChatThreadPost).not.toHaveBeenCalled();
  });

  it('anchors loaded chats to the newest message on first render', async () => {
    render(
      <SharedPostChatScreen
        directFriendUid="friend-1"
        postId="direct-chat-1"
      />
    );

    await waitFor(() => {
      expect(mockScrollToEnd).toHaveBeenCalledWith({ animated: false });
    });
  });

  it('requests only the newest message page on initial load', async () => {
    render(
      <SharedPostChatScreen
        directFriendUid="friend-1"
        postId="direct-chat-1"
      />
    );

    await waitFor(() => {
      expect(mockGetSharedPostResponsesPage).toHaveBeenCalledWith('direct-chat-1', {
        limit: 24,
      });
    });
  });

  it('marks the thread read through the persisted response after sending', async () => {
    const { getByLabelText } = render(
      <SharedPostChatScreen
        directFriendUid="friend-1"
        postId="direct-chat-1"
      />
    );

    await waitFor(() => {
      expect(mockMarkSharedThreadRead).toHaveBeenCalledWith('direct-chat-1', 'response-1');
    });
    mockMarkSharedThreadRead.mockClear();

    await act(async () => {
      fireEvent.changeText(getByLabelText('Message'), 'sent from test');
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.press(getByLabelText('Send'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockCreateSharedPostResponse).toHaveBeenCalledWith('direct-chat-1', {
        emoji: null,
        text: 'sent from test',
        sticker: null,
        replyToResponseId: null,
      });
      expect(mockMarkSharedThreadRead).toHaveBeenCalledWith('direct-chat-1', 'response-2');
    });
  });

  it('sends a sticker without clearing unsent composer text', async () => {
    mockNotes = [createStickerNote()];

    const { getByLabelText, getByTestId } = render(
      <SharedPostChatScreen
        directFriendUid="friend-1"
        postId="direct-chat-1"
      />
    );

    await waitFor(() => {
      expect(getByLabelText('Message')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.changeText(getByLabelText('Message'), 'keep this draft');
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.press(getByLabelText('Open sticker library'));
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.press(getByTestId('chat-sticker-tray-item-asset-1:default'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockCreateSharedPostResponse).toHaveBeenCalledWith('direct-chat-1', {
        emoji: null,
        text: null,
        sticker: {
          asset: expect.objectContaining({
            id: 'asset-1',
            localUri: 'file:///asset-1.png',
          }),
          renderMode: 'default',
          stampStyle: null,
        },
        replyToResponseId: null,
      });
    });
    expect(getByLabelText('Message').props.value).toBe('keep this draft');
  });

  it('renders a confirmed sticker from the local library when hydration has no local uri', async () => {
    mockNotes = [createStickerNote()];
    mockGetSharedPostResponsesPage.mockResolvedValueOnce([
      {
        id: 'response-sticker-1',
        postId: directPost.id,
        authorUid: 'me',
        authorDisplayName: 'Me',
        authorPhotoURLSnapshot: null,
        emoji: null,
        text: '',
        sticker: {
          assetId: 'asset-1',
          localUri: null,
          remotePath: 'me/stickers/asset-1.png',
          mimeType: 'image/png',
          width: 200,
          height: 200,
          renderMode: 'default',
          stampStyle: null,
        },
        replyToResponseId: null,
        reactions: [],
        createdAt: '2026-05-20T01:02:00.000Z',
      },
    ]);

    render(
      <SharedPostChatScreen
        directFriendUid="friend-1"
        postId="direct-chat-1"
      />
    );

    await waitFor(() => {
      expect(mockLatestStickerPreviewItem?.asset?.localUri).toBe('file:///asset-1.png');
    });
  });

  it('does not load older messages until the user scrolls upward', async () => {
    mockGetSharedPostResponsesPage.mockResolvedValueOnce(
      Array.from({ length: 24 }, (_, index) => ({
        id: `response-${index + 1}`,
        postId: directPost.id,
        authorUid: index % 2 === 0 ? 'friend-1' : 'me',
        authorDisplayName: index % 2 === 0 ? 'Lan' : 'Me',
        authorPhotoURLSnapshot: null,
        emoji: null,
        text: `message ${index + 1}`,
        replyToResponseId: null,
        reactions: [],
        createdAt: `2026-05-20T01:${String(index + 1).padStart(2, '0')}:00.000Z`,
      }))
    );
    render(
      <SharedPostChatScreen
        directFriendUid="friend-1"
        postId="direct-chat-1"
      />
    );

    await waitFor(() => {
      expect(mockLatestThreadOnStartReached).toBeTruthy();
    });
    mockGetSharedPostResponsesPage.mockClear();

    await act(async () => {
      mockLatestThreadOnStartReached?.();
      await Promise.resolve();
    });

    expect(mockGetSharedPostResponsesPage).not.toHaveBeenCalled();

    await act(async () => {
      mockLatestThreadOnScroll?.({
        nativeEvent: {
          contentOffset: { y: 420 },
          contentSize: { height: 900 },
          layoutMeasurement: { height: 300 },
        },
      });
      mockLatestThreadOnScroll?.({
        nativeEvent: {
          contentOffset: { y: 360 },
          contentSize: { height: 900 },
          layoutMeasurement: { height: 300 },
        },
      });
      mockLatestThreadOnStartReached?.();
      await Promise.resolve();
    });

    expect(mockGetSharedPostResponsesPage).toHaveBeenCalledWith('direct-chat-1', {
      beforeCreatedAt: '2026-05-20T01:01:00.000Z',
      limit: 24,
    });
  });

  it('shows the thread skeleton while resolving an existing direct chat', async () => {
    let resolveDirectChat: (post: typeof directPost | null) => void = () => undefined;
    mockGetDirectChatThreadPost.mockReturnValue(
      new Promise((resolve) => {
        resolveDirectChat = resolve;
      })
    );

    const { getByTestId, unmount } = render(
      <SharedPostChatScreen
        directFriendUid="friend-1"
        postId="direct-friend-1"
      />
    );

    await waitFor(() => {
      expect(mockGetDirectChatThreadPost).toHaveBeenCalledWith('friend-1');
      expect(getByTestId('shared-chat-thread-skeleton')).toBeTruthy();
    });

    await act(async () => {
      resolveDirectChat(null);
      await Promise.resolve();
    });
    unmount();
  });

  it('lifts the composer above the Android keyboard', async () => {
    const originalPlatform = Platform.OS;
    Platform.OS = 'android';
    const keyboardListeners = new Map<string, (event: any) => void>();
    const addListenerSpy = jest
      .spyOn(Keyboard, 'addListener')
      .mockImplementation((eventName: any, listener: any) => {
        keyboardListeners.set(eventName, listener);
        return {
          remove: jest.fn(() => {
            keyboardListeners.delete(eventName);
          }),
        } as any;
      });

    try {
      const { getByTestId, unmount } = render(
        <SharedPostChatScreen
          directFriendUid="friend-1"
          postId="direct-chat-1"
        />
      );

      await waitFor(() => {
        expect(keyboardListeners.has('keyboardDidShow')).toBe(true);
      });

      await act(async () => {
        keyboardListeners.get('keyboardDidShow')?.({
          endCoordinates: {
            height: 312,
            screenY: 488,
          },
        });
      });

      expect(
        StyleSheet.flatten(getByTestId('shared-chat-composer-shell').props.style)
      ).toMatchObject({
        bottom: 326,
        paddingBottom: 6,
      });

      await act(async () => {
        keyboardListeners.get('keyboardDidHide')?.({
          endCoordinates: {
            height: 0,
            screenY: 800,
          },
        });
      });

      expect(
        StyleSheet.flatten(getByTestId('shared-chat-composer-shell').props.style)
      ).toMatchObject({
        bottom: 0,
      });

      unmount();
    } finally {
      addListenerSpy.mockRestore();
      Platform.OS = originalPlatform;
    }
  });
});

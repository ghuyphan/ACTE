import { Ionicons } from '@expo/vector-icons';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { useSharedFeedStore } from '../../../hooks/useSharedFeed';
import { useTheme } from '../../../hooks/useTheme';
import {
  getNoteCardTextPalette,
  getTextNoteCardGradient,
} from '../../../services/noteAppearance';
import type { SharedPost, SharedPostResponse } from '../../../services/sharedFeedService';
import { getUserSocialName } from '../../../utils/appUser';
import { formatChatTimestamp } from '../../../utils/dateUtils';
import TextFieldEditSheet from '../../sheets/TextFieldEditSheet';

type SharedPostChatScreenProps = {
  postId: string;
};

type ChatResponseGroup = {
  id: string;
  authorUid: string;
  authorDisplayName: string | null;
  authorPhotoURLSnapshot: string | null;
  responses: SharedPostResponse[];
  createdAt: string;
};

type ReplyPreview = {
  authorLabel: string;
  body: string;
} | null;

type ReactionOverlay = {
  response: SharedPostResponse;
  isSelf: boolean;
  pageX: number;
  pageY: number;
} | null;

const RESPONSE_SKELETON_ROWS = [
  { key: 'incoming-short', isSelf: false, width: '44%', minHeight: 40 },
  { key: 'self-reaction', isSelf: true, width: 54, minHeight: 44 },
  { key: 'incoming-long', isSelf: false, width: '68%', minHeight: 62 },
  { key: 'self-medium', isSelf: true, width: '50%', minHeight: 40 },
] as const;
const QUICK_RESPONSES = ['💛', '🥹', '✨', '😂'] as const;

function ResponseSkeletonRows({
  colors,
}: {
  colors: {
    border: string;
    primarySoft: string;
    surface: string;
  };
}) {
  return (
    <View style={styles.loadingThreadSkeleton} pointerEvents="none">
      {RESPONSE_SKELETON_ROWS.map((row) => (
        <View
          key={row.key}
          style={[
            styles.messageRow,
            row.isSelf ? styles.selfMessageRow : styles.friendMessageRow,
          ]}
        >
          {!row.isSelf ? (
            <View
              style={[
                styles.loadingAvatar,
                {
                  backgroundColor: colors.primarySoft,
                  borderColor: colors.border,
                },
              ]}
            />
          ) : null}
          <View
            style={[
              styles.loadingMessageBubble,
              row.isSelf ? styles.selfBubble : styles.friendBubble,
              {
                width: row.width,
                minHeight: row.minHeight,
                backgroundColor: row.isSelf ? colors.primarySoft : colors.surface,
                borderColor: colors.border,
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

function ReplyableBubble({
  children,
  isSelf,
  onReply,
  onLongPress,
  style,
}: {
  children: ReactNode;
  isSelf: boolean;
  onReply: () => void;
  onLongPress: (event: GestureResponderEvent) => void;
  style: StyleProp<ViewStyle>;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const swipeDirection = isSelf ? -1 : 1;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        swipeDirection * gestureState.dx > 8 && Math.abs(gestureState.dy) < 12,
      onPanResponderMove: (_, gestureState) => {
        const distance = Math.max(0, Math.min(gestureState.dx * swipeDirection, 54));
        translateX.setValue(distance * swipeDirection);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx * swipeDirection > 42) {
          onReply();
        }
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{ transform: [{ translateX }] }}
    >
      <Pressable onLongPress={onLongPress} delayLongPress={260} style={style}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

function formatResponseBody(response: SharedPostResponse) {
  return [response.emoji, response.text].filter(Boolean).join(' ').trim();
}

function formatMessageGroupTime(date: Date | string) {
  const timestamp = typeof date === 'string' ? new Date(date) : date;
  if (!Number.isFinite(timestamp.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp);
}

function isReactionOnlyResponse(response: SharedPostResponse) {
  return Boolean(response.emoji && response.text.trim().length === 0);
}

function groupConsecutiveResponses(responses: SharedPostResponse[]): ChatResponseGroup[] {
  const groups: ChatResponseGroup[] = [];

  for (const response of responses) {
    const previousGroup = groups[groups.length - 1];
    if (previousGroup?.authorUid === response.authorUid) {
      previousGroup.responses.push(response);
      previousGroup.createdAt = response.createdAt;
      previousGroup.id = `${previousGroup.responses[0]?.id ?? response.id}:${response.id}`;
      continue;
    }

    groups.push({
      id: response.id,
      authorUid: response.authorUid,
      authorDisplayName: response.authorDisplayName,
      authorPhotoURLSnapshot: response.authorPhotoURLSnapshot,
      responses: [response],
      createdAt: response.createdAt,
    });
  }

  return groups;
}

function formatOfflineDuration(
  lastSeenAt: string | null | undefined,
  t: ReturnType<typeof useTranslation>['t']
) {
  if (!lastSeenAt) {
    return null;
  }

  const lastSeenTime = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(lastSeenTime)) {
    return null;
  }

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - lastSeenTime) / 60000));
  if (elapsedMinutes < 1) {
    return t('shared.chatOfflineJustNow', 'just now');
  }

  if (elapsedMinutes < 60) {
    return t('shared.chatOfflineMinutes', '{{count}}m ago', { count: elapsedMinutes });
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return t('shared.chatOfflineHours', '{{count}}h ago', { count: elapsedHours });
  }

  return t('shared.chatOfflineDays', '{{count}}d ago', {
    count: Math.floor(elapsedHours / 24),
  });
}

function isOptimisticResponse(response: SharedPostResponse) {
  return response.id.startsWith('local-shared-response-');
}

function mergeResponses(
  remoteResponses: SharedPostResponse[],
  pendingResponses: SharedPostResponse[]
) {
  const byId = new Map<string, SharedPostResponse>();
  for (const response of remoteResponses) {
    byId.set(response.id, response);
  }
  for (const response of pendingResponses) {
    if (!byId.has(response.id)) {
      byId.set(response.id, response);
    }
  }

  return Array.from(byId.values()).sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );
}

function areResponseListsEqual(
  left: SharedPostResponse[],
  right: SharedPostResponse[]
) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((leftResponse, index) => {
    const rightResponse = right[index];
    return (
      rightResponse &&
      leftResponse.id === rightResponse.id &&
      leftResponse.authorUid === rightResponse.authorUid &&
      leftResponse.emoji === rightResponse.emoji &&
      leftResponse.text === rightResponse.text &&
      leftResponse.createdAt === rightResponse.createdAt
    );
  });
}

function getSharedPostPreviewUri(post: SharedPost) {
  if (post.type !== 'photo') {
    return null;
  }

  return post.photoLocalUri ?? null;
}

function getMemoryPreviewTitle(post: SharedPost, t: ReturnType<typeof useTranslation>['t']) {
  if (post.type === 'photo') {
    return post.placeName
      ? t('shared.chatThreadPhotoAtPlace', 'Photo memory from {{place}}', {
          place: post.placeName,
        })
      : t('shared.chatThreadPhoto', 'Photo memory');
  }

  return post.text.trim() || t('shared.chatThreadNote', 'Shared note');
}

function getFriendPublicLabel(
  friend: { username?: string | null; displayNameSnapshot?: string | null } | null
) {
  if (!friend) {
    return null;
  }

  return (
    (friend.username ? `@${friend.username}` : null) ||
    friend.displayNameSnapshot?.trim() ||
    null
  );
}

function MiniMemoryCard({
  fallbackText,
  isDark,
  post,
}: {
  fallbackText: string;
  isDark: boolean;
  post: SharedPost;
}) {
  const photoUri = getSharedPostPreviewUri(post);
  const previewText = post.text.trim() || fallbackText;
  const gradient = useMemo(
    () =>
      getTextNoteCardGradient({
        text: previewText,
        noteId: post.id,
        noteColor: post.noteColor,
        colorScheme: isDark ? 'dark' : 'light',
      }),
    [isDark, post.id, post.noteColor, previewText]
  );
  const textPalette = useMemo(() => getNoteCardTextPalette(gradient), [gradient]);

  if (photoUri) {
    return <Image source={{ uri: photoUri }} style={styles.miniMemoryFill} contentFit="cover" />;
  }

  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.miniMemoryFill}
    >
      <Text
        numberOfLines={5}
        style={[
          styles.miniMemoryText,
          {
            color: textPalette.color,
            textShadowColor: textPalette.shadowColor,
          },
        ]}
      >
        {previewText}
      </Text>
    </LinearGradient>
  );
}

export default function SharedPostChatScreen({ postId }: SharedPostChatScreenProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const router = useRouter();
  const { user } = useAuth();
  const {
    friends = [],
    friendPresence = {},
    loading,
    refreshSharedFeed,
    sharedPosts = [],
    getSharedPostResponses = async () => [],
    subscribeToSharedPostResponses,
    updateFriendNickname = async () => undefined,
    createSharedPostResponse = async () => {
      throw new Error(t('shared.responseSendFailed', 'Could not send response.'));
    },
  } = useSharedFeedStore();
  const [responses, setResponses] = useState<SharedPostResponse[]>([]);
  const [draft, setDraft] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingResponses, setIsLoadingResponses] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isNicknameEditorVisible, setIsNicknameEditorVisible] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [nicknameErrorMessage, setNicknameErrorMessage] = useState<string | null>(null);
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [replyTarget, setReplyTarget] = useState<SharedPostResponse | null>(null);
  const [reactionOverlay, setReactionOverlay] = useState<ReactionOverlay>(null);
  const listRef = useRef<FlashListRef<ChatResponseGroup> | null>(null);
  const pendingResponsesRef = useRef<Map<string, SharedPostResponse>>(new Map());
  const initialHydrationSettledRef = useRef(false);
  const previousResponseCountRef = useRef(0);

  const post = sharedPosts.find((item) => item.id === postId) ?? null;
  const responseGroups = useMemo(() => groupConsecutiveResponses(responses), [responses]);
  const responseById = useMemo(
    () => new Map(responses.map((response) => [response.id, response] as const)),
    [responses]
  );
  const friendLabelById = useMemo(() => {
    const labels = new Map<string, string>();
    for (const friend of friends) {
      labels.set(
        friend.userId,
        friend.nickname?.trim() ||
          friend.displayNameSnapshot?.trim() ||
          (friend.username ? `@${friend.username}` : t('shared.friendFallback', 'Friend'))
      );
    }
    return labels;
  }, [friends, t]);

  const getAuthorLabel = useCallback(
    (authorUid: string, displayName: string | null | undefined) => {
      if (user?.uid && authorUid === user.uid) {
        return t('shared.chatYou', 'You');
      }

      return (
        friendLabelById.get(authorUid) ||
        displayName?.trim() ||
        t('shared.someone', 'Someone')
      );
    },
    [friendLabelById, t, user?.uid]
  );
  const getResponseReplyPreview = useCallback(
    (response: SharedPostResponse): ReplyPreview => {
      const replyToResponseId = response.replyToResponseId?.trim();
      if (!replyToResponseId) {
        return null;
      }

      const target = responseById.get(replyToResponseId);
      if (!target) {
        return null;
      }

      return {
        authorLabel: getAuthorLabel(target.authorUid, target.authorDisplayName),
        body: formatResponseBody(target),
      };
    },
    [getAuthorLabel, responseById]
  );

  const postAuthorLabel = post
    ? getAuthorLabel(post.authorUid, post.authorDisplayName)
    : t('shared.someone', 'Someone');
  const participantIds = useMemo(() => {
    if (!post) {
      return [];
    }

    return Array.from(new Set([post.authorUid, ...post.audienceUserIds])).filter(
      (participantUid) => participantUid !== user?.uid
    );
  }, [post, user?.uid]);
  const participantLabels = useMemo(() => {
    if (!post) {
      return [];
    }

    return participantIds
      .map((participantUid) =>
        participantUid === post.authorUid
          ? postAuthorLabel
          : getAuthorLabel(participantUid, null)
      )
      .filter((label) => Boolean(label.trim()));
  }, [getAuthorLabel, participantIds, post, postAuthorLabel]);
  const primaryParticipantLabel =
    participantLabels[0] ?? postAuthorLabel ?? t('shared.someone', 'Someone');
  const primaryParticipantUid = participantIds[0] ?? null;
  const primaryFriend = useMemo(
    () =>
      primaryParticipantUid
        ? friends.find((friend) => friend.userId === primaryParticipantUid) ?? null
        : null,
    [friends, primaryParticipantUid]
  );
  const primaryFriendPublicLabel = useMemo(
    () => getFriendPublicLabel(primaryFriend),
    [primaryFriend]
  );
  const headerIdentityLabel = useMemo(() => {
    if (!post) {
      return t('shared.chatTitle', 'Chat');
    }

    if (participantIds.length > 1) {
      return t('shared.chatGroupTitle', 'Memory chat');
    }

    return (
      primaryFriend?.nickname?.trim() ||
      (primaryFriend?.username ? `@${primaryFriend.username}` : null) ||
      primaryParticipantLabel
    );
  }, [participantIds.length, post, primaryFriend, primaryParticipantLabel, t]);
  const headerAvatarUri =
    primaryFriend?.photoURLSnapshot ??
    (primaryParticipantUid === post?.authorUid ? post?.authorPhotoURLSnapshot : null);
  const headerAvatarInitial = headerIdentityLabel.replace(/^@/, '').charAt(0).toUpperCase();
  const canEditHeaderNickname = Boolean(primaryFriend && participantIds.length <= 1);
  const normalizedNicknameDraft = nicknameDraft.trim();
  const currentHeaderNickname = primaryFriend?.nickname?.trim() ?? '';
  const canSaveHeaderNickname =
    Boolean(primaryFriend) &&
    !isSavingNickname &&
    normalizedNicknameDraft.length <= 40 &&
    normalizedNicknameDraft !== currentHeaderNickname;
  const primaryPresence = primaryParticipantUid ? friendPresence[primaryParticipantUid] : null;
  const headerPresenceStatus = primaryPresence?.status ?? 'unknown';
  const headerSubtitle = useMemo(() => {
    if (!post) {
      return null;
    }

    if (participantIds.length > 1) {
      return t('shared.chatParticipantsCount', '{{count}} people can reply', {
        count: participantIds.length,
      });
    }

    const presenceText =
      headerPresenceStatus === 'online'
        ? t('shared.chatOnline', 'Online')
        : headerPresenceStatus === 'offline'
          ? (() => {
              const offlineDuration = formatOfflineDuration(primaryPresence?.lastSeenAt, t);
              return offlineDuration
                ? t('shared.chatOfflineSince', 'Offline {{time}}', { time: offlineDuration })
                : t('shared.chatOffline', 'Offline');
            })()
          : t('shared.chatConnecting', 'Syncing');
    if (primaryFriend?.nickname?.trim() && primaryFriendPublicLabel) {
      return `${primaryFriendPublicLabel} • ${presenceText}`;
    }

    return presenceText;
  }, [
    headerPresenceStatus,
    participantIds.length,
    post,
    primaryFriend?.nickname,
    primaryFriendPublicLabel,
    primaryPresence?.lastSeenAt,
    t,
  ]);
  const shouldShowHeaderPresence = Boolean(post && participantIds.length <= 1);
  const applyRemoteResponses = useCallback((nextResponses: SharedPostResponse[]) => {
    setResponses((current) => {
      const next = mergeResponses(nextResponses, Array.from(pendingResponsesRef.current.values()));
      return areResponseListsEqual(current, next) ? current : next;
    });
  }, []);

  useEffect(() => {
    initialHydrationSettledRef.current = false;
    previousResponseCountRef.current = 0;
    setIsLoadingResponses(true);
    setErrorMessage(null);
    if (!subscribeToSharedPostResponses) {
      let cancelled = false;
      void getSharedPostResponses(postId)
        .then((nextResponses) => {
          if (!cancelled) {
            applyRemoteResponses(nextResponses);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setErrorMessage(
              error instanceof Error
                ? error.message
                : t('shared.responseLoadFailed', 'Could not load responses.')
            );
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoadingResponses(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }

    try {
      return subscribeToSharedPostResponses(postId, {
        onResponses: (nextResponses) => {
          applyRemoteResponses(nextResponses);
          setIsLoadingResponses(false);
        },
        onError: (error) => {
          setIsLoadingResponses(false);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : t('shared.responseLoadFailed', 'Could not load responses.')
          );
        },
      });
    } catch (error) {
      setIsLoadingResponses(false);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t('shared.responseLoadFailed', 'Could not load responses.')
      );
    }

    return undefined;
  }, [applyRemoteResponses, getSharedPostResponses, postId, subscribeToSharedPostResponses, t]);

  useEffect(() => {
    if (!post && !loading) {
      void refreshSharedFeed?.().catch(() => undefined);
    }
  }, [loading, post, refreshSharedFeed]);

  useEffect(() => {
    if (responses.length === 0) {
      previousResponseCountRef.current = 0;
      return;
    }

    const isInitialHydration = !initialHydrationSettledRef.current;
    const hasNewResponse = responses.length > previousResponseCountRef.current;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({
        animated: !isInitialHydration && hasNewResponse,
      });
    });
    initialHydrationSettledRef.current = true;
    previousResponseCountRef.current = responses.length;
  }, [responses.length]);

  const openNicknameEditor = useCallback(() => {
    if (!primaryFriend) {
      return;
    }

    setNicknameDraft(primaryFriend.nickname ?? '');
    setNicknameErrorMessage(null);
    setIsNicknameEditorVisible(true);
  }, [primaryFriend]);

  const closeNicknameEditor = useCallback(() => {
    if (isSavingNickname) {
      return;
    }

    setIsNicknameEditorVisible(false);
    setNicknameDraft('');
    setNicknameErrorMessage(null);
  }, [isSavingNickname]);

  const saveNickname = useCallback(async () => {
    if (!primaryFriend || !canSaveHeaderNickname) {
      if (normalizedNicknameDraft.length > 40) {
        setNicknameErrorMessage(t('shared.friendNicknameTooLong', 'Use 40 characters or fewer.'));
      }
      return;
    }

    setIsSavingNickname(true);
    setNicknameErrorMessage(null);
    try {
      await updateFriendNickname(primaryFriend.userId, normalizedNicknameDraft || null);
      setIsNicknameEditorVisible(false);
      setNicknameDraft('');
    } catch (error) {
      setNicknameErrorMessage(
        error instanceof Error
          ? error.message
          : t('shared.friendNicknameSaveFailed', 'Could not update nickname.')
      );
    } finally {
      setIsSavingNickname(false);
    }
  }, [
    canSaveHeaderNickname,
    normalizedNicknameDraft,
    primaryFriend,
    t,
    updateFriendNickname,
  ]);

  const sendResponse = useCallback(
    async (emoji?: string, explicitReplyToResponseId?: string | null) => {
      if (!post || isSending) {
        return;
      }

      const text = draft.trim();
      if (!emoji && !text) {
        return;
      }

      const optimisticId = `local-shared-response-${Date.now()}`;
      const replyToResponseId = explicitReplyToResponseId ?? replyTarget?.id ?? null;
      const optimisticResponse: SharedPostResponse = {
        id: optimisticId,
        postId: post.id,
        authorUid: user?.uid ?? '',
        authorDisplayName: user ? getUserSocialName(user) : t('shared.chatYou', 'You'),
        authorPhotoURLSnapshot: user?.photoURL ?? null,
        emoji: emoji ?? null,
        text: emoji ? '' : text,
        replyToResponseId,
        createdAt: new Date().toISOString(),
      };
      pendingResponsesRef.current.set(optimisticId, optimisticResponse);
      setResponses((current) => {
        const next = mergeResponses(current, [optimisticResponse]);
        return areResponseListsEqual(current, next) ? current : next;
      });
      if (!emoji) {
        setDraft('');
      }
      if (!explicitReplyToResponseId) {
        setReplyTarget(null);
      }

      setIsSending(true);
      setReactionOverlay(null);
      setErrorMessage(null);
      try {
        const response = await createSharedPostResponse(post.id, {
          emoji: emoji ?? null,
          text: emoji ? null : text,
          replyToResponseId,
        });
        pendingResponsesRef.current.delete(optimisticId);
        setResponses((current) => {
          const next = mergeResponses(
            current.filter((item) => item.id !== optimisticId),
            [response]
          );
          return areResponseListsEqual(current, next) ? current : next;
        });
      } catch (error) {
        pendingResponsesRef.current.delete(optimisticId);
        setResponses((current) => current.filter((item) => item.id !== optimisticId));
        if (!emoji) {
          setDraft(text);
        }
        if (!explicitReplyToResponseId && replyToResponseId) {
          setReplyTarget(replyTarget);
        }
        setErrorMessage(
          error instanceof Error
            ? error.message
            : t('shared.responseSendFailed', 'Could not send response.')
        );
      } finally {
        setIsSending(false);
      }
    },
    [createSharedPostResponse, draft, isSending, post, replyTarget, t, user]
  );

  const openMemory = useCallback(() => {
    router.push(`/shared/${postId}` as any);
  }, [postId, router]);

  const contentBottomPadding = 18;
  const renderMemoryHeader = useCallback(() => {
    if (!post) {
      return null;
    }

    return (
      <Pressable
        accessibilityRole="button"
        onPress={openMemory}
        style={({ pressed }) => [
          styles.memoryPreviewBlock,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.86 : 1,
          },
        ]}
      >
        <View style={styles.memoryCard}>
          <MiniMemoryCard
            post={post}
            fallbackText={t('shared.noteFallback', 'Shared note')}
            isDark={isDark}
          />
        </View>
        <View style={styles.memoryCopy}>
          <Text numberOfLines={1} style={[styles.memoryTitle, { color: colors.text }]}>
            {getMemoryPreviewTitle(post, t)}
          </Text>
          <View style={styles.memoryMetaLine}>
            {post.authorPhotoURLSnapshot ? (
              <Image
                source={{ uri: post.authorPhotoURLSnapshot }}
                style={styles.memoryAvatar}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.memoryAvatar, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.memoryAvatarLabel, { color: colors.primary }]}>
                  {postAuthorLabel.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text
              numberOfLines={1}
              style={[styles.memoryAuthorText, { color: colors.secondaryText }]}
            >
              {postAuthorLabel}
            </Text>
            <View style={[styles.memoryMetaDot, { backgroundColor: colors.secondaryText }]} />
            <Text style={[styles.memoryMetaTime, { color: colors.secondaryText }]}>
              {formatChatTimestamp(post.createdAt)}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} />
      </Pressable>
    );
  }, [colors, isDark, openMemory, post, postAuthorLabel, t]);
  const isThreadHydrating = isLoadingResponses && responses.length === 0;
  const renderEmptyThread = useCallback(
    () => (
      <View style={styles.messageList}>
        <Text style={[styles.emptyThreadHint, { color: colors.secondaryText }]}>
          {t('shared.chatEmptyHint', 'Start with a quick reaction.')}
        </Text>
      </View>
    ),
    [colors.secondaryText, t]
  );
  const renderResponseLoadingFooter = useCallback(
    () => (
      <ResponseSkeletonRows
        colors={{
          border: colors.border,
          primarySoft: colors.primarySoft,
          surface: colors.surface,
        }}
      />
    ),
    [colors.border, colors.primarySoft, colors.surface]
  );
  const renderResponseItem = useCallback(
    ({ item: group }: { item: ChatResponseGroup }) => {
      const isSelf = group.authorUid === user?.uid;
      const authorLabel = getAuthorLabel(group.authorUid, group.authorDisplayName);
      const avatarLabel = authorLabel
        .replace(/^@/, '')
        .charAt(0)
        .toUpperCase();
      const avatarUri = group.authorPhotoURLSnapshot;
      const shouldShowStatus = isSelf && group.responses.some(isOptimisticResponse);
      return (
        <View
          style={[
            styles.messageRow,
            isSelf ? styles.selfMessageRow : styles.friendMessageRow,
          ]}
        >
          {!isSelf ? (
            avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={styles.messageAvatar}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.messageAvatar, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.messageAvatarLabel, { color: colors.primary }]}>
                  {avatarLabel}
                </Text>
              </View>
            )
          ) : null}
          <View
            style={[
              styles.messageStack,
              isSelf ? styles.selfMessageStack : styles.friendMessageStack,
            ]}
          >
            {!isSelf ? (
              <Text
                numberOfLines={1}
                style={[styles.messageIdentity, { color: colors.secondaryText }]}
              >
                {authorLabel}
              </Text>
            ) : null}
            <View
              style={[
                styles.messageBubbleStack,
                isSelf ? styles.selfMessageStack : styles.friendMessageStack,
              ]}
            >
              {group.responses.map((response, responseIndex) => {
                const isFirstInGroup = responseIndex === 0;
                const isLastInGroup = responseIndex === group.responses.length - 1;
                const isReactionOnly = isReactionOnlyResponse(response);
                const replyPreview = getResponseReplyPreview(response);
                return (
                  <View
                    key={response.id}
                    style={styles.messageInteractionWrap}
                  >
                    <ReplyableBubble
                      isSelf={isSelf}
                      onReply={() => {
                        setReplyTarget(response);
                        setReactionOverlay(null);
                      }}
                      onLongPress={(event) => {
                        setReactionOverlay({
                          response,
                          isSelf,
                          pageX: event.nativeEvent.pageX,
                          pageY: event.nativeEvent.pageY,
                        });
                      }}
                      style={[
                        styles.messageBubble,
                        isSelf ? styles.selfBubble : styles.friendBubble,
                        isReactionOnly ? styles.reactionBubble : null,
                        isSelf && !isFirstInGroup ? styles.selfBubbleGroupedTop : null,
                        isSelf && !isLastInGroup ? styles.selfBubbleGroupedBottom : null,
                        !isSelf && !isFirstInGroup ? styles.friendBubbleGroupedTop : null,
                        !isSelf && !isLastInGroup ? styles.friendBubbleGroupedBottom : null,
                        {
                          backgroundColor: isSelf ? colors.primary : colors.surface,
                          borderColor: isSelf ? 'transparent' : colors.border,
                        },
                      ]}
                    >
                    {replyPreview ? (
                      <View
                        style={[
                          styles.replyPreviewBubble,
                          {
                            backgroundColor: isSelf
                              ? 'rgba(255,255,255,0.18)'
                              : colors.primarySoft,
                          },
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.replyPreviewAuthor,
                            { color: isSelf ? colors.onPrimary : colors.primary },
                          ]}
                        >
                          {replyPreview.authorLabel}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.replyPreviewBody,
                            { color: isSelf ? colors.onPrimary : colors.secondaryText },
                          ]}
                        >
                          {replyPreview.body}
                        </Text>
                      </View>
                    ) : null}
                    <Text
                      android_hyphenationFrequency="normal"
                      lineBreakStrategyIOS="standard"
                      style={[
                        styles.messageText,
                        isReactionOnly ? styles.reactionMessageText : null,
                        { color: isSelf ? colors.onPrimary : colors.text },
                      ]}
                    >
                      {formatResponseBody(response)}
                    </Text>
                    </ReplyableBubble>
                  </View>
                );
              })}
            </View>
            <Text
              style={[
                styles.messageTime,
                {
                  color: colors.secondaryText,
                  textAlign: isSelf ? 'right' : 'left',
                },
              ]}
            >
              {formatMessageGroupTime(group.createdAt)}
            </Text>
            {shouldShowStatus ? (
              <Text
                style={[
                  styles.messageStatus,
                  {
                    color: colors.secondaryText,
                    alignSelf: 'flex-end',
                  },
                ]}
              >
                {t('shared.chatSending', 'Sending...')}
              </Text>
            ) : null}
          </View>
        </View>
      );
    },
    [
      colors,
      getAuthorLabel,
      getResponseReplyPreview,
      t,
      user?.uid,
    ]
  );
  const reactionOverlayWidth = 188;
  const reactionOverlayLeft = reactionOverlay
    ? Math.min(
        Math.max(reactionOverlay.pageX - reactionOverlayWidth / 2, 12),
        Math.max(12, screenWidth - reactionOverlayWidth - 12)
      )
    : 0;
  const reactionOverlayTop = reactionOverlay
    ? Math.max(insets.top + 10, reactionOverlay.pageY - 72)
    : 0;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View
        style={[
          styles.chatHeader,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Back')}
          onPress={() => {
            router.back();
          }}
          style={({ pressed }) => [
            styles.chatBackButton,
            {
              opacity: pressed ? 0.64 : 1,
            },
          ]}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        {post ? (
          <View style={styles.headerIdentity}>
            {headerAvatarUri ? (
              <Image
                source={{ uri: headerAvatarUri }}
                style={styles.headerAvatar}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.headerAvatar, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.headerAvatarLabel, { color: colors.primary }]}>
                  {headerAvatarInitial}
                </Text>
              </View>
            )}
            <View style={styles.headerCopy}>
              <Text numberOfLines={1} style={[styles.headerIdentityText, { color: colors.text }]}>
                {headerIdentityLabel}
              </Text>
              {headerSubtitle ? (
                <View style={styles.headerSubtitleRow}>
                  {shouldShowHeaderPresence ? (
                    <View
                      style={[
                        styles.headerPresenceDot,
                        {
                          backgroundColor:
                            headerPresenceStatus === 'online'
                              ? colors.success
                              : colors.secondaryText,
                          opacity: headerPresenceStatus === 'unknown' ? 0.42 : 1,
                        },
                      ]}
                    />
                  ) : null}
                  <Text
                    numberOfLines={1}
                    style={[styles.headerSubtitle, { color: colors.secondaryText }]}
                  >
                    {headerSubtitle}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <Text style={[styles.headerFallbackTitle, { color: colors.text }]}>
            {t('shared.chatTitle', 'Chat')}
          </Text>
        )}
        {canEditHeaderNickname ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('shared.friendNicknameEdit', 'Edit nickname')}
            onPress={openNicknameEditor}
            style={({ pressed }) => [
              styles.chatHeaderActionButton,
              {
                opacity: pressed ? 0.64 : 1,
              },
            ]}
          >
            <Ionicons name="pencil-outline" size={21} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.chatHeaderSpacer} />
        )}
      </View>

      {!post && loading ? (
        <View style={styles.loadingChatContent} pointerEvents="none">
          <View
            style={[
              styles.memoryPreviewBlock,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.loadingMemoryCard, { backgroundColor: colors.primarySoft }]} />
            <View style={styles.memoryCopy}>
              <View
                style={[
                  styles.loadingLine,
                  styles.loadingLineWide,
                  { backgroundColor: colors.primarySoft },
                ]}
              />
              <View style={styles.memoryMetaLine}>
                <View style={[styles.memoryAvatar, { backgroundColor: colors.primarySoft }]} />
                <View
                  style={[
                    styles.loadingLine,
                    styles.loadingLineMedium,
                    { backgroundColor: colors.primarySoft },
                  ]}
                />
              </View>
            </View>
          </View>
          <ResponseSkeletonRows
            colors={{
              border: colors.border,
              primarySoft: colors.primarySoft,
              surface: colors.surface,
            }}
          />
        </View>
      ) : !post ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t('shared.detailNotFound', 'Shared moment not found')}
          </Text>
          <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
            {t('shared.chatNotFoundBody', 'This chat may no longer be available.')}
          </Text>
        </View>
      ) : (
        <>
          <View
            style={[
              styles.memoryPreviewHost,
              {
                backgroundColor: colors.background,
                borderBottomColor: colors.border,
              },
            ]}
          >
            {renderMemoryHeader()}
          </View>
          <FlashList
            ref={listRef}
            style={styles.threadList}
            data={responseGroups}
            keyExtractor={(item) => item.id}
            renderItem={renderResponseItem}
            extraData={`${isThreadHydrating}:${responses.length}`}
            ItemSeparatorComponent={() => <View style={styles.messageSeparator} />}
            ListFooterComponent={isThreadHydrating ? renderResponseLoadingFooter : undefined}
            ListEmptyComponent={isThreadHydrating ? null : renderEmptyThread}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.threadContent,
              {
                paddingTop: 20,
                paddingBottom: contentBottomPadding,
              },
            ]}
          />

          <View
            style={[
              styles.composerShell,
              {
                paddingBottom: Math.max(insets.bottom, 12),
                backgroundColor: colors.background,
                borderTopColor: colors.border,
              },
            ]}
          >
            {errorMessage ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>
            ) : null}
            {replyTarget ? (
              <View
                style={[
                  styles.composerReplyPreview,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.composerReplyCopy}>
                  <Text
                    numberOfLines={1}
                    style={[styles.composerReplyAuthor, { color: colors.primary }]}
                  >
                    {getAuthorLabel(replyTarget.authorUid, replyTarget.authorDisplayName)}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[styles.composerReplyBody, { color: colors.secondaryText }]}
                  >
                    {formatResponseBody(replyTarget)}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close', 'Close')}
                  onPress={() => setReplyTarget(null)}
                  style={styles.composerReplyClose}
                >
                  <Ionicons name="close" size={16} color={colors.secondaryText} />
                </Pressable>
              </View>
            ) : null}
            <View
              style={[
                styles.composer,
                {
                  backgroundColor: colors.surface,
                  borderColor: errorMessage ? colors.danger : colors.border,
                },
              ]}
            >
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={t('shared.chatComposerPlaceholder', 'Reply to this memory')}
                placeholderTextColor={colors.secondaryText}
                maxLength={160}
                returnKeyType="send"
                multiline
                style={[styles.composerInput, { color: colors.text }]}
                onSubmitEditing={() => {
                  void sendResponse();
                }}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void sendResponse();
                }}
                disabled={isSending || !draft.trim()}
                style={({ pressed }) => [
                  styles.sendButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: isSending || !draft.trim() ? 0.44 : pressed ? 0.82 : 1,
                  },
                ]}
              >
                <Ionicons name="send" size={16} color={colors.onPrimary} />
              </Pressable>
            </View>
          </View>
        </>
      )}
      {reactionOverlay ? (
        <View style={styles.reactionOverlayLayer} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close', 'Close')}
            style={StyleSheet.absoluteFill}
            onPress={() => setReactionOverlay(null)}
          />
          <View
            style={[
              styles.reactionTray,
              {
                left: reactionOverlayLeft,
                top: reactionOverlayTop,
                width: reactionOverlayWidth,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            {QUICK_RESPONSES.map((reactionEmoji) => (
              <Pressable
                key={reactionEmoji}
                accessibilityRole="button"
                onPress={() => {
                  void sendResponse(reactionEmoji, reactionOverlay.response.id);
                }}
                style={({ pressed }) => [
                  styles.reactionTrayButton,
                  { opacity: pressed ? 0.62 : 1 },
                ]}
              >
                <Text style={styles.reactionTrayText}>{reactionEmoji}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      <TextFieldEditSheet
        visible={isNicknameEditorVisible}
        value={nicknameDraft}
        errorMessage={nicknameErrorMessage}
        helperText={t('shared.friendNicknameHint', 'Only you will see this nickname.')}
        isSaving={isSavingNickname}
        onChangeValue={setNicknameDraft}
        onClose={closeNicknameEditor}
        onSave={saveNickname}
        title={t('shared.friendNicknameSheetTitle', 'Friend nickname')}
        subtitle={primaryFriendPublicLabel ?? undefined}
        saveLabel={t('shared.friendNicknameSave', 'Save nickname')}
        placeholder={t('shared.friendNicknamePlaceholder', 'Add nickname')}
        autoComplete="name"
        testIDPrefix="chat-friend-nickname"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.screenPadding,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    textAlign: 'center',
    fontFamily: 'Noto Sans',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: 'Noto Sans',
  },
  threadContent: {
    paddingHorizontal: Layout.screenPadding,
  },
  threadList: {
    flex: 1,
  },
  loadingChatContent: {
    flex: 1,
    paddingHorizontal: Layout.screenPadding,
    paddingTop: 20,
  },
  memoryPreviewHost: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Layout.screenPadding,
    paddingTop: 12,
    paddingBottom: 10,
  },
  chatHeader: {
    minHeight: 82,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  chatBackButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatHeaderSpacer: {
    width: 42,
    height: 42,
  },
  headerIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minWidth: 0,
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarLabel: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    fontFamily: 'Noto Sans',
  },
  headerCopy: {
    flexShrink: 1,
    minWidth: 0,
  },
  chatHeaderActionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIdentityText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    fontFamily: 'Noto Sans',
  },
  headerSubtitle: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  headerSubtitleRow: {
    marginTop: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
  },
  headerFallbackTitle: {
    flex: 1,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    fontFamily: 'Noto Sans',
  },
  headerPresenceDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  memoryPreviewBlock: {
    width: '100%',
    minHeight: 76,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 8,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memoryCard: {
    width: 58,
    height: 58,
    borderRadius: 17,
    overflow: 'hidden',
  },
  miniMemoryFill: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  miniMemoryText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    textAlign: 'center',
    fontFamily: 'Noto Sans',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  memoryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  memoryTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
    fontFamily: 'Noto Sans',
  },
  memoryMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memoryAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoryAvatarLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    fontFamily: 'Noto Sans',
  },
  memoryMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.7,
  },
  memoryAuthorText: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: 'Noto Sans',
  },
  memoryMetaTime: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: 'Noto Sans',
  },
  loadingMemoryCard: {
    width: 58,
    height: 58,
    borderRadius: 17,
  },
  loadingLine: {
    height: 12,
    borderRadius: 6,
  },
  loadingLineWide: {
    width: '76%',
  },
  loadingLineMedium: {
    width: '42%',
  },
  messageList: {
    gap: 10,
  },
  loadingThreadSkeleton: {
    gap: 8,
    opacity: 0.78,
  },
  messageSeparator: {
    height: 6,
  },
  messageRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 2,
  },
  groupedMessageRow: {
    marginTop: -2,
  },
  selfMessageRow: {
    justifyContent: 'flex-end',
  },
  friendMessageRow: {
    justifyContent: 'flex-start',
  },
  messageStack: {
    maxWidth: '78%',
    minWidth: 0,
    gap: 4,
  },
  selfMessageStack: {
    alignItems: 'flex-end',
  },
  friendMessageStack: {
    alignItems: 'flex-start',
  },
  messageBubbleStack: {
    maxWidth: '100%',
    minWidth: 0,
    gap: 3,
  },
  messageInteractionWrap: {
    maxWidth: '100%',
    gap: 5,
    position: 'relative',
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageAvatarLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    fontFamily: 'Noto Sans',
  },
  messageAvatarSpacer: {
    width: 28,
    height: 28,
  },
  loadingAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  messageIdentity: {
    maxWidth: 220,
    paddingLeft: 4,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
  },
  messageBubble: {
    maxWidth: '100%',
    minWidth: 0,
    flexShrink: 1,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 13,
    paddingVertical: 9,
    gap: 2,
  },
  reactionBubble: {
    minWidth: 48,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyPreviewBubble: {
    minWidth: 120,
    maxWidth: 220,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
    gap: 1,
  },
  replyPreviewAuthor: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    fontFamily: 'Noto Sans',
  },
  replyPreviewBody: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'Noto Sans',
  },
  reactionTray: {
    position: 'absolute',
    zIndex: 10,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 7,
    paddingVertical: 5,
    flexDirection: 'row',
    gap: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
  reactionTrayButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionTrayText: {
    fontSize: 24,
    lineHeight: 29,
  },
  loadingMessageBubble: {
    maxWidth: '78%',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  selfBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 6,
  },
  friendBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 6,
  },
  selfBubbleGroupedTop: {
    borderTopRightRadius: 8,
  },
  selfBubbleGroupedBottom: {
    borderBottomRightRadius: 8,
  },
  friendBubbleGroupedTop: {
    borderTopLeftRadius: 8,
  },
  friendBubbleGroupedBottom: {
    borderBottomLeftRadius: 8,
  },
  messageText: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: 'Noto Sans',
  },
  reactionMessageText: {
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
  },
  messageTime: {
    maxWidth: '100%',
    paddingHorizontal: 6,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'Noto Sans',
  },
  messageStatus: {
    paddingHorizontal: 6,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  emptyThreadHint: {
    alignSelf: 'center',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Noto Sans',
  },
  composerShell: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Layout.screenPadding,
    paddingTop: 9,
    gap: 7,
  },
  reactionOverlayLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Noto Sans',
  },
  composerReplyPreview: {
    minHeight: 48,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  composerReplyCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  composerReplyAuthor: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    fontFamily: 'Noto Sans',
  },
  composerReplyBody: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Noto Sans',
  },
  composerReplyClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composer: {
    minHeight: 46,
    maxHeight: 88,
    borderRadius: 23,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 15,
    paddingRight: 5,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  composerInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 72,
    paddingTop: 8,
    paddingBottom: 8,
    fontFamily: 'Noto Sans',
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

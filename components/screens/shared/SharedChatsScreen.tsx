import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { useSharedFeedStore } from '../../../hooks/useSharedFeed';
import { useTheme } from '../../../hooks/useTheme';
import type {
  SharedPost,
  SharedPostTypingUser,
  SharedThreadSummary,
} from '../../../services/sharedFeedService';
import { rememberSharedChatThreadPosts } from '../../../services/sharedChatPostMemory';
import {
  getCachedSharedThreadSummaries,
  type SharedThreadReadState,
} from '../../../services/sharedFeedCache';
import { formatChatTimestamp } from '../../../utils/dateUtils';
import {
  getSharedChatIdentity,
  getSharedChatThreadIconName,
  getSharedThreadSummaryBody,
  isDirectChatPost,
  isSharedThreadUnread,
} from '../../../utils/sharedChatPresentation';

const CHAT_LIST_SKELETON_ROWS = [
  { key: 'first', titleWidth: '46%', previewWidth: '68%' },
  { key: 'second', titleWidth: '38%', previewWidth: '54%' },
  { key: 'third', titleWidth: '52%', previewWidth: '62%' },
] as const;
const CHAT_PREWARM_RESPONSE_LIMIT = 30;
const MAX_PREWARM_THREADS = 8;
const MAX_CACHED_THREAD_SUMMARIES = 80;
const MAX_TYPING_PREVIEW_THREADS = 12;
const CHAT_THREAD_VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 40,
} as const;
const cachedActivityThreadPostsByUserUid = new Map<string, SharedPost[]>();
const cachedThreadSummaryByPostId = new Map<string, SharedThreadSummary>();
const cachedReadStateByUserUid = new Map<string, Record<string, SharedThreadReadState>>();
const prewarmedResponsePageKeys = new Set<string>();

type FriendListItem = ReturnType<typeof useSharedFeedStore>['friends'][number];
type ChatListItem =
  | { key: string; type: 'thread'; post: SharedPost }
  | { key: string; type: 'friend'; friend: FriendListItem };

function getCachedThreadSummaries(postIds: readonly string[]) {
  return Object.fromEntries(
    postIds.flatMap((postId) => {
      const summary = cachedThreadSummaryByPostId.get(postId);
      return summary ? [[postId, summary] as const] : [];
    })
  );
}

function rememberThreadSummaries(summaries: readonly SharedThreadSummary[]) {
  for (const summary of summaries) {
    cachedThreadSummaryByPostId.delete(summary.postId);
    cachedThreadSummaryByPostId.set(summary.postId, summary);
  }
  while (cachedThreadSummaryByPostId.size > MAX_CACHED_THREAD_SUMMARIES) {
    const oldestPostId = cachedThreadSummaryByPostId.keys().next().value;
    if (!oldestPostId) {
      break;
    }
    cachedThreadSummaryByPostId.delete(oldestPostId);
  }
}

function UnreadIndicator({ color, count }: { color: string; count: number }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  if (count > 1) {
    return (
      <Animated.View
        style={[
          styles.unreadCountPill,
          {
            backgroundColor: color,
            transform: [
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.05],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.unreadCount}>{count > 9 ? '9+' : count}</Text>
      </Animated.View>
    );
  }

  return (
    <View style={styles.unreadDotHost}>
      <Animated.View
        style={[
          styles.unreadPulse,
          {
            backgroundColor: color,
            opacity: pulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.28, 0],
            }),
            transform: [
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 2.6],
                }),
              },
            ],
          },
        ]}
      />
      <View style={[styles.unreadDot, { backgroundColor: color }]} />
    </View>
  );
}

export default function SharedChatsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isReady: authReady, user } = useAuth();
  const {
    friends = [],
    friendPresence = {},
    loading,
    sharedPosts = [],
    getSharedChatThreadPosts = async () => [],
    getSharedPostResponsesPage = async () => [],
    getSharedPostThreadSummaries = async () => [],
    getSharedThreadReadStates = async () => [],
    subscribeToSharedPostTyping = () => ({
      setTyping: () => undefined,
      unsubscribe: () => undefined,
    }),
  } = useSharedFeedStore();
  const [threadSummaryByPostId, setThreadSummaryByPostId] = useState<
    Record<string, SharedThreadSummary>
  >(() => getCachedThreadSummaries(sharedPosts.map((post) => post.id)));
  const [readStateByPostId, setReadStateByPostId] = useState<
    Record<string, SharedThreadReadState>
  >(() => (user?.uid ? cachedReadStateByUserUid.get(user.uid) ?? {} : {}));
  const [typingUsersByPostId, setTypingUsersByPostId] = useState<
    Record<string, SharedPostTypingUser[]>
  >({});
  const [visibleThreadPostIds, setVisibleThreadPostIds] = useState<string[]>([]);
  const [activityThreadPosts, setActivityThreadPosts] = useState<SharedPost[]>(() =>
    user?.uid ? cachedActivityThreadPostsByUserUid.get(user.uid) ?? [] : []
  );
  const [loadingActivityThreads, setLoadingActivityThreads] = useState(false);
  const listContentStyle = useMemo(
    () => ({
      paddingTop: 8,
      paddingBottom: insets.bottom + 32,
      paddingHorizontal: Layout.screenPadding,
    }),
    [insets.bottom]
  );
  const renderThreadSeparator = useCallback(
    () => <View style={[styles.threadSeparator, { backgroundColor: colors.border }]} />,
    [colors.border]
  );
  const mergedThreadPosts = useMemo(() => {
    const postById = new Map<string, SharedPost>();
    for (const post of activityThreadPosts) {
      if (isDirectChatPost(post)) {
        postById.set(post.id, post);
      }
    }
    for (const post of sharedPosts) {
      if (isDirectChatPost(post)) {
        postById.set(post.id, post);
      }
    }
    return Array.from(postById.values());
  }, [activityThreadPosts, sharedPosts]);
  const threadPostIdsKey = useMemo(
    () => mergedThreadPosts.map((post) => post.id).join('|'),
    [mergedThreadPosts]
  );
  useEffect(() => {
    rememberSharedChatThreadPosts(mergedThreadPosts);
  }, [mergedThreadPosts]);
  const friendById = useMemo(() => {
    const next = new Map<string, (typeof friends)[number]>();
    for (const friend of friends) {
      next.set(friend.userId, friend);
    }
    return next;
  }, [friends]);
  const openFriendChat = useCallback(
    (friendUid: string) => {
      router.push(`/shared/chat/direct-${friendUid}?friendUid=${encodeURIComponent(friendUid)}` as any);
    },
    [router]
  );
  useFocusEffect(
    useCallback(() => {
      if (!authReady || !user?.uid) {
        setActivityThreadPosts([]);
        setLoadingActivityThreads(false);
        return undefined;
      }

      let cancelled = false;
      const cachedActivityThreadPosts = cachedActivityThreadPostsByUserUid.get(user.uid) ?? [];
      if (cachedActivityThreadPosts.length > 0) {
        setActivityThreadPosts(cachedActivityThreadPosts);
      }
      setLoadingActivityThreads(
        cachedActivityThreadPosts.length === 0 && !threadPostIdsKey && friends.length === 0
      );
      void getSharedChatThreadPosts()
        .then((posts) => {
          if (!cancelled) {
            cachedActivityThreadPostsByUserUid.set(user.uid, posts);
            setActivityThreadPosts(posts);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            console.warn('Failed to load shared chat threads:', error);
            if (cachedActivityThreadPosts.length === 0) {
              setActivityThreadPosts([]);
            }
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoadingActivityThreads(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [authReady, friends.length, getSharedChatThreadPosts, threadPostIdsKey, user?.uid])
  );
  useFocusEffect(
    useCallback(() => {
      const postIds = threadPostIdsKey ? threadPostIdsKey.split('|') : [];
      if (!authReady || !user?.uid || postIds.length === 0) {
        if (postIds.length === 0) {
          setThreadSummaryByPostId({});
          setReadStateByPostId({});
        }
        return undefined;
      }

      setThreadSummaryByPostId((current) => ({
        ...getCachedThreadSummaries(postIds),
        ...current,
      }));
      setReadStateByPostId(cachedReadStateByUserUid.get(user.uid) ?? {});

      let cancelled = false;
      void getCachedSharedThreadSummaries(user.uid, postIds)
        .then((cachedSummaries) => {
          if (cancelled || cachedSummaries.length === 0) {
            return;
          }

          rememberThreadSummaries(cachedSummaries);
          setThreadSummaryByPostId((current) => ({
            ...current,
            ...Object.fromEntries(
              cachedSummaries.map((summary) => [summary.postId, summary])
            ),
          }));
        })
        .catch(() => undefined);

      void Promise.all([
        getSharedPostThreadSummaries(postIds).catch(() => []),
        getSharedThreadReadStates().catch(() => []),
      ]).then(([summaries, readStates]) => {
        if (cancelled) {
          return;
        }

        rememberThreadSummaries(summaries);
        const nextReadStateByPostId = Object.fromEntries(
          readStates.map((readState) => [readState.postId, readState])
        );
        cachedReadStateByUserUid.set(user.uid, nextReadStateByPostId);
        setThreadSummaryByPostId(Object.fromEntries(summaries.map((summary) => [summary.postId, summary])));
        setReadStateByPostId(nextReadStateByPostId);
      });

      return () => {
        cancelled = true;
      };
    }, [
      authReady,
      getSharedPostThreadSummaries,
      getSharedThreadReadStates,
      threadPostIdsKey,
      user?.uid,
    ])
  );

  const threads = useMemo(
    () =>
      [...mergedThreadPosts].sort((left, right) => {
        const leftSummary = threadSummaryByPostId[left.id];
        const rightSummary = threadSummaryByPostId[right.id];
        const leftTime = new Date(leftSummary?.latestActivityAt ?? left.createdAt).getTime();
        const rightTime = new Date(rightSummary?.latestActivityAt ?? right.createdAt).getTime();
        return rightTime - leftTime;
      }),
    [mergedThreadPosts, threadSummaryByPostId]
  );
  const getDirectChatParticipantUid = useCallback(
    (post: SharedPost) =>
      [post.authorUid, ...post.audienceUserIds].find((candidate) => candidate !== user?.uid) ??
      post.authorUid,
    [user?.uid]
  );
  const chatListItems = useMemo<ChatListItem[]>(() => {
    const directThreadFriendIds = new Set(
      threads.filter(isDirectChatPost).map((post) => getDirectChatParticipantUid(post))
    );
    const starterItems = friends
      .filter((friend) => !directThreadFriendIds.has(friend.userId))
      .map((friend) => ({
        key: `friend-${friend.userId}`,
        type: 'friend' as const,
        friend,
      }));

    return [
      ...threads.map((post) => ({
        key: `thread-${post.id}`,
        type: 'thread' as const,
        post,
      })),
      ...starterItems,
    ];
  }, [friends, getDirectChatParticipantUid, threads]);
  const visibleTypingPostIdsKey = useMemo(() => {
    const threadPostIds = new Set(threads.map((post) => post.id));
    const visiblePostIds = visibleThreadPostIds.filter((postId) => threadPostIds.has(postId));
    const sourcePostIds =
      visiblePostIds.length > 0
        ? visiblePostIds
        : threads
            .slice(0, MAX_TYPING_PREVIEW_THREADS)
            .map((post) => post.id);

    return sourcePostIds
      .slice(0, MAX_TYPING_PREVIEW_THREADS)
      .join('|');
  }, [threads, visibleThreadPostIds]);
  const handleThreadViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { item?: ChatListItem; isViewable?: boolean }[] }) => {
      const nextVisiblePostIds = viewableItems.flatMap((viewableItem) =>
        viewableItem.isViewable !== false && viewableItem.item?.type === 'thread'
          ? [viewableItem.item.post.id]
          : []
      );

      setVisibleThreadPostIds((current) =>
        current.join('|') === nextVisiblePostIds.join('|') ? current : nextVisiblePostIds
      );
    }
  ).current;
  useEffect(() => {
    const postIds = visibleTypingPostIdsKey ? visibleTypingPostIdsKey.split('|') : [];
    if (!authReady || !user?.uid || postIds.length === 0) {
      setTypingUsersByPostId({});
      return;
    }

    const subscriptions = postIds.map((postId) =>
      subscribeToSharedPostTyping(postId, {
        onTypingUsers: (typingUsers) => {
          setTypingUsersByPostId((current) => {
            const visibleTypingUsers = typingUsers.filter(
              (typingUser) => typingUser.userId !== user.uid
            );
            if (visibleTypingUsers.length === 0) {
              if (!current[postId]) {
                return current;
              }
              const next = { ...current };
              delete next[postId];
              return next;
            }
            return {
              ...current,
              [postId]: visibleTypingUsers,
            };
          });
        },
        onError: () => undefined,
      })
    );

    return () => {
      for (const subscription of subscriptions) {
        subscription.unsubscribe();
      }
    };
  }, [authReady, subscribeToSharedPostTyping, visibleTypingPostIdsKey, user?.uid]);
  const prewarmThreadResponses = useCallback(
    (postId: string) => {
      if (!authReady || !user?.uid) {
        return;
      }

      const cacheKey = `${user.uid}:${postId}`;
      if (prewarmedResponsePageKeys.has(cacheKey)) {
        return;
      }

      prewarmedResponsePageKeys.add(cacheKey);
      void getSharedPostResponsesPage(postId, { limit: CHAT_PREWARM_RESPONSE_LIMIT }).catch(() => {
        prewarmedResponsePageKeys.delete(cacheKey);
      });
    },
    [authReady, getSharedPostResponsesPage, user?.uid]
  );
  const prewarmThreadPostIdsKey = useMemo(
    () =>
      threads
        .slice(0, MAX_PREWARM_THREADS)
        .map((post) => post.id)
        .join('|'),
    [threads]
  );
  useEffect(() => {
    const postIds = prewarmThreadPostIdsKey ? prewarmThreadPostIdsKey.split('|') : [];
    if (!authReady || !user?.uid || postIds.length === 0) {
      return;
    }

    let cancelled = false;
    const warmNext = (index: number) => {
      if (cancelled || index >= postIds.length) {
        return;
      }

      prewarmThreadResponses(postIds[index]);
      setTimeout(() => warmNext(index + 1), 120);
    };

    warmNext(0);
    return () => {
      cancelled = true;
    };
  }, [authReady, prewarmThreadPostIdsKey, prewarmThreadResponses, user?.uid]);
  const getThreadParticipant = useCallback(
    (post: SharedPost) => {
      const participantUid = getDirectChatParticipantUid(post);
      const friend = friendById.get(participantUid) ?? null;
      const identity = getSharedChatIdentity(
        {
          currentUserUid: user?.uid,
          displayNameSnapshot: participantUid === post.authorUid ? post.authorDisplayName : null,
          friend,
          photoURLSnapshot: participantUid === post.authorUid ? post.authorPhotoURLSnapshot : null,
          userId: participantUid,
        },
        {
          friendFallback: t('shared.friendFallback', 'Friend'),
          someone: t('shared.someone', 'Someone'),
          you: t('shared.chatYou', 'You'),
        }
      );

      return {
        label: identity.label,
        photoUri: identity.avatarUri,
        avatarInitial: identity.avatarInitial,
      };
    },
    [friendById, getDirectChatParticipantUid, t, user?.uid]
  );
  const renderThreadItem = useCallback(
    (post: SharedPost) => {
      const participantUid = getDirectChatParticipantUid(post);
      const participant = getThreadParticipant(post);
      const summary = threadSummaryByPostId[post.id] ?? null;
      const hasUnread = isSharedThreadUnread(summary, readStateByPostId[post.id], user?.uid);
      const unreadCount = hasUnread ? 1 : 0;
      const latestAuthor =
        summary?.latestActivityAuthorUid && summary.latestActivityAuthorUid === user?.uid
          ? t('shared.chatYou', 'You')
          : summary?.latestActivityAuthorUid
            ? getThreadParticipant({
                ...post,
                authorUid: summary.latestActivityAuthorUid,
                authorDisplayName: summary.latestActivityAuthorDisplayName,
                authorPhotoURLSnapshot: summary.latestActivityAuthorPhotoURLSnapshot,
              }).label
            : null;
      const isDirectChat = isDirectChatPost(post);
      const starterPreview = t('shared.directChatStarter', 'Message privately');
      const summaryBody = summary ? getSharedThreadSummaryBody(summary) : '';
      const typingUsers = typingUsersByPostId[post.id] ?? [];
      const typingPreview =
        typingUsers.length === 0
          ? null
          : typingUsers.length === 1
            ? t('shared.chatTypingOne', '{{name}} is typing', {
                name: getThreadParticipant({
                  ...post,
                  authorUid: typingUsers[0].userId,
                  authorDisplayName: typingUsers[0].displayName,
                  authorPhotoURLSnapshot: typingUsers[0].photoURL,
                }).label,
              })
            : t('shared.chatTypingMany', '{{count}} people are typing', {
                count: typingUsers.length,
              });
      const latestPreview = summary?.latestActivityAt
        ? latestAuthor
          ? t('shared.chatThreadLatestBy', '{{name}}: {{message}}', {
              name: latestAuthor,
              message: summaryBody || t('shared.chatThreadActivity', 'New activity'),
            })
          : summaryBody || t('shared.chatThreadActivity', 'New activity')
        : starterPreview;
      const latestTimestamp = summary?.latestActivityAt ?? post.createdAt;
      const participantPresenceStatus = friendPresence[participantUid]?.status ?? 'unknown';
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            hasUnread
              ? t('shared.openUnreadChatA11y', 'Open unread chat with {{name}}', {
                  name: participant.label,
                })
              : t('shared.openChatWithA11y', 'Open chat with {{name}}', {
                  name: participant.label,
                })
          }
          onPress={() => {
            router.push(
              isDirectChat
                ? (`/shared/chat/${post.id}?friendUid=${encodeURIComponent(participantUid)}` as any)
                : (`/shared/chat/${post.id}` as any)
            );
          }}
          onPressIn={() => prewarmThreadResponses(post.id)}
          style={({ pressed }) => [
            styles.threadRow,
            {
              backgroundColor: pressed ? colors.surface : 'transparent',
              borderColor: 'transparent',
              opacity: pressed ? 0.86 : 1,
            },
          ]}
        >
          <View style={styles.avatarHost}>
            {participant.photoUri ? (
              <Image
                source={{ uri: participant.photoUri }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.avatarLabel, { color: colors.primary }]}>
                  {participant.avatarInitial}
                </Text>
              </View>
            )}
            {isDirectChat && participantPresenceStatus === 'online' ? (
              <View
                style={[
                  styles.avatarPresenceDot,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.background,
                  },
                ]}
              />
            ) : null}
            <View
              style={[
                styles.threadKindBadge,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons name={getSharedChatThreadIconName(post)} size={12} color={colors.primary} />
            </View>
          </View>
          <View style={styles.threadCopy}>
            <Text
              numberOfLines={1}
              style={[
                styles.threadTitle,
                hasUnread ? styles.threadTitleUnread : null,
                { color: colors.text },
              ]}
            >
              {participant.label}
            </Text>
            <View style={styles.threadPreviewRow}>
              <Text
                numberOfLines={1}
                style={[
                  styles.threadPreview,
                  hasUnread ? styles.threadPreviewUnread : null,
                  {
                    color: hasUnread ? colors.text : colors.secondaryText,
                  },
                ]}
              >
                {latestPreview}
              </Text>
              {typingPreview ? (
                <Text
                  numberOfLines={1}
                  style={[styles.threadTypingInline, { color: colors.primary }]}
                >
                  {typingPreview}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.threadMeta}>
            <Text
              style={[
                styles.threadTime,
                hasUnread ? styles.threadTimeUnread : null,
                { color: hasUnread ? colors.text : colors.secondaryText },
              ]}
            >
              {formatChatTimestamp(latestTimestamp)}
            </Text>
            {hasUnread ? (
              <View style={styles.unreadWrap}>
                <UnreadIndicator color={colors.primary} count={unreadCount} />
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} />
            )}
          </View>
        </Pressable>
      );
    },
    [
      colors,
      friendPresence,
      getDirectChatParticipantUid,
      getThreadParticipant,
      prewarmThreadResponses,
      readStateByPostId,
      router,
      t,
      threadSummaryByPostId,
      typingUsersByPostId,
      user?.uid,
    ]
  );
  const renderLoadingThreads = useCallback(
    () => (
      <View
        style={[
          styles.skeletonList,
          {
            paddingTop: 12,
            paddingBottom: insets.bottom + 32,
            paddingHorizontal: Layout.screenPadding,
          },
        ]}
        pointerEvents="none"
      >
        {CHAT_LIST_SKELETON_ROWS.map((row) => (
          <View key={row.key}>
            <View style={styles.skeletonThreadRow}>
              <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]} />
              <View style={styles.threadCopy}>
                <View
                  style={[
                    styles.skeletonLine,
                    {
                      width: row.titleWidth,
                      backgroundColor: colors.primarySoft,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.skeletonLine,
                    styles.skeletonPreviewLine,
                    {
                      width: row.previewWidth,
                      backgroundColor: colors.primarySoft,
                    },
                  ]}
                />
              </View>
              <View style={styles.threadMeta}>
                <View
                  style={[
                    styles.skeletonTimeLine,
                    {
                      backgroundColor: colors.primarySoft,
                    },
                  ]}
                />
              </View>
            </View>
            <View style={[styles.threadSeparator, { backgroundColor: colors.border }]} />
          </View>
        ))}
      </View>
    ),
    [colors.border, colors.primarySoft, insets.bottom]
  );
  const renderFriendStarterItem = useCallback(
    (friend: FriendListItem) => {
      const identity = getSharedChatIdentity(
        {
          currentUserUid: user?.uid,
          displayNameSnapshot: friend.displayNameSnapshot,
          friend,
          photoURLSnapshot: friend.photoURLSnapshot,
          userId: friend.userId,
        },
        {
          friendFallback: t('shared.friendFallback', 'Friend'),
          someone: t('shared.someone', 'Someone'),
          you: t('shared.chatYou', 'You'),
        }
      );
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('shared.openChatWithA11y', 'Open chat with {{name}}', {
            name: identity.label,
          })}
          onPress={() => {
            openFriendChat(friend.userId);
          }}
          style={({ pressed }) => [
            styles.threadRow,
            {
              backgroundColor: pressed ? colors.surface : 'transparent',
              borderColor: 'transparent',
              opacity: pressed ? 0.86 : 1,
            },
          ]}
        >
          <View style={styles.avatarHost}>
            {identity.avatarUri ? (
              <Image source={{ uri: identity.avatarUri }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.background }]}>
                <Text style={[styles.avatarLabel, { color: colors.primary }]}>
                  {identity.avatarInitial}
                </Text>
              </View>
            )}
            {friendPresence[friend.userId]?.status === 'online' ? (
              <View
                style={[
                  styles.avatarPresenceDot,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.background,
                  },
                ]}
              />
            ) : null}
          </View>
          <View style={styles.threadCopy}>
            <Text numberOfLines={1} style={[styles.threadTitle, styles.threadStarterTitle, { color: colors.text }]}>
              {identity.label}
            </Text>
            <Text numberOfLines={1} style={[styles.threadPreview, { color: colors.secondaryText }]}>
              {t('shared.directChatStarter', 'Message privately')}
            </Text>
          </View>
          <View style={styles.threadMeta}>
            <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} />
          </View>
        </Pressable>
      );
    },
    [
      colors,
      friendPresence,
      openFriendChat,
      t,
      user?.uid,
    ]
  );
  const renderChatListItem = useCallback(
    ({ item }: { item: ChatListItem }) =>
      item.type === 'thread'
        ? renderThreadItem(item.post)
        : renderFriendStarterItem(item.friend),
    [renderFriendStarterItem, renderThreadItem]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {!authReady ||
      ((loading || loadingActivityThreads) && chatListItems.length === 0) ? (
        renderLoadingThreads()
      ) : chatListItems.length === 0 ? (
        <View style={styles.emptyScreen}>
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="chatbubbles-outline" size={54} color={colors.secondaryText} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t('shared.chatsEmptyTitle', 'No chats yet')}
            </Text>
            <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
              {t(
                'shared.chatsEmptyBody',
                'Connect with a friend from Home, then start a private chat here.'
              )}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('shared.chatsEmptyAction', 'Open Home')}
              onPress={() => {
                router.push('/' as any);
              }}
              style={({ pressed }) => [
                styles.emptyAction,
                { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
              ]}
            >
              <Text style={[styles.emptyActionLabel, { color: colors.onPrimary }]}>
                {t('shared.chatsEmptyAction', 'Open Home')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <FlashList
          data={chatListItems}
          keyExtractor={(item) => item.key}
          renderItem={renderChatListItem}
          ItemSeparatorComponent={renderThreadSeparator}
          onViewableItemsChanged={handleThreadViewableItemsChanged}
          viewabilityConfig={CHAT_THREAD_VIEWABILITY_CONFIG}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={listContentStyle}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.screenPadding,
    gap: 8,
  },
  emptyScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: 40,
  },
  emptyState: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'Noto Sans',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: 'Noto Sans',
    marginTop: 8,
    maxWidth: 280,
  },
  emptyAction: {
    minHeight: 44,
    marginTop: 18,
    borderRadius: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
    fontFamily: 'Noto Sans',
  },
  skeletonList: {
    flex: 1,
    opacity: 0.78,
  },
  skeletonThreadRow: {
    minHeight: 76,
    paddingHorizontal: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skeletonLine: {
    height: 13,
    borderRadius: 7,
  },
  skeletonPreviewLine: {
    height: 11,
    marginTop: 4,
  },
  skeletonTimeLine: {
    width: 34,
    height: 10,
    borderRadius: 5,
  },
  threadSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 66,
  },
  threadRow: {
    minHeight: 76,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarHost: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    fontFamily: 'Noto Sans',
  },
  avatarPresenceDot: {
    position: 'absolute',
    right: 1,
    top: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  threadKindBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  threadTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
    fontFamily: 'Noto Sans',
  },
  threadTitleUnread: {
    fontWeight: '900',
  },
  threadStarterTitle: {
    fontWeight: '800',
  },
  threadPreviewRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  threadPreview: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Noto Sans',
  },
  threadPreviewUnread: {
    fontWeight: '800',
  },
  threadTypingInline: {
    flexShrink: 0,
    maxWidth: '44%',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    fontFamily: 'Noto Sans',
  },
  threadMeta: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 7,
  },
  threadTime: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'Noto Sans',
  },
  threadTimeUnread: {
    fontWeight: '900',
  },
  unreadWrap: {
    minHeight: 18,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  unreadDotHost: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadPulse: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  unreadCountPill: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadCount: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    fontFamily: 'Noto Sans',
    color: '#fff',
  },
});

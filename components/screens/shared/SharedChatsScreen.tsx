import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { useSharedFeedStore } from '../../../hooks/useSharedFeed';
import { useTheme } from '../../../hooks/useTheme';
import type { SharedPost, SharedThreadSummary } from '../../../services/sharedFeedService';
import type { SharedThreadReadState } from '../../../services/sharedFeedCache';
import { formatChatTimestamp } from '../../../utils/dateUtils';
import {
  getSharedChatIdentity,
  getSharedChatMemoryPreview,
  getSharedChatThreadIconName,
  getSharedThreadSummaryBody,
  isSharedThreadUnread,
} from '../../../utils/sharedChatPresentation';

const CHAT_LIST_SKELETON_ROWS = [
  { key: 'first', titleWidth: '46%', previewWidth: '68%' },
  { key: 'second', titleWidth: '38%', previewWidth: '54%' },
  { key: 'third', titleWidth: '52%', previewWidth: '62%' },
] as const;
const MAX_CACHED_THREAD_SUMMARIES = 80;
const cachedThreadSummaryByPostId = new Map<string, SharedThreadSummary>();
const cachedReadStateByUserUid = new Map<string, Record<string, SharedThreadReadState>>();

function getHeaderTopInset(topInset: number) {
  if (topInset > 0) {
    return topInset;
  }

  return Platform.OS === 'ios' ? 44 : StatusBar.currentHeight ?? 24;
}

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
  const headerTopInset = getHeaderTopInset(insets.top);
  const router = useRouter();
  const { isReady: authReady, user } = useAuth();
  const {
    friends = [],
    loading,
    sharedPosts = [],
    getSharedPostThreadSummaries = async () => [],
    getSharedThreadReadStates = async () => [],
  } = useSharedFeedStore();
  const [threadSummaryByPostId, setThreadSummaryByPostId] = useState<
    Record<string, SharedThreadSummary>
  >(() => getCachedThreadSummaries(sharedPosts.map((post) => post.id)));
  const [readStateByPostId, setReadStateByPostId] = useState<
    Record<string, SharedThreadReadState>
  >(() => (user?.uid ? cachedReadStateByUserUid.get(user.uid) ?? {} : {}));
  const threadPostIdsKey = useMemo(
    () => sharedPosts.map((post) => post.id).join('|'),
    [sharedPosts]
  );
  const friendById = useMemo(() => {
    const next = new Map<string, (typeof friends)[number]>();
    for (const friend of friends) {
      next.set(friend.userId, friend);
    }
    return next;
  }, [friends]);
  useEffect(() => {
    const postIds = threadPostIdsKey ? threadPostIdsKey.split('|') : [];
    if (!authReady || !user?.uid || postIds.length === 0) {
      if (postIds.length === 0) {
        setThreadSummaryByPostId({});
        setReadStateByPostId({});
      }
      return;
    }

    setThreadSummaryByPostId((current) => ({
      ...getCachedThreadSummaries(postIds),
      ...current,
    }));
    setReadStateByPostId(cachedReadStateByUserUid.get(user.uid) ?? {});

    let cancelled = false;
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
  ]);

  const threads = useMemo(
    () =>
      [...sharedPosts].sort((left, right) => {
        const leftSummary = threadSummaryByPostId[left.id];
        const rightSummary = threadSummaryByPostId[right.id];
        const leftTime = new Date(leftSummary?.latestActivityAt ?? left.createdAt).getTime();
        const rightTime = new Date(rightSummary?.latestActivityAt ?? right.createdAt).getTime();
        return rightTime - leftTime;
      }),
    [sharedPosts, threadSummaryByPostId]
  );
  const getThreadParticipant = useCallback(
    (post: SharedPost) => {
      const participantUid =
        [post.authorUid, ...post.audienceUserIds].find((candidate) => candidate !== user?.uid) ??
        post.authorUid;
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
    [friendById, t, user?.uid]
  );
  const renderThreadItem = useCallback(
    ({ item: post }: { item: SharedPost }) => {
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
      const memoryPreview = getSharedChatMemoryPreview(post, {
        photoMemory: t('shared.chatThreadPhoto', 'Photo memory'),
        photoMemoryAtPlace: (place) =>
          t('shared.chatThreadPhotoAtPlace', 'Photo memory from {{place}}', { place }),
        sharedNote: t('shared.chatThreadNote', 'Shared note'),
      });
      const summaryBody = summary ? getSharedThreadSummaryBody(summary) : '';
      const latestPreview = summary?.latestActivityAt
        ? latestAuthor
          ? t('shared.chatThreadLatestBy', '{{name}}: {{message}}', {
              name: latestAuthor,
              message: summaryBody || t('shared.chatThreadActivity', 'New activity'),
            })
          : summaryBody || t('shared.chatThreadActivity', 'New activity')
        : memoryPreview;
      const latestTimestamp = summary?.latestActivityAt ?? post.createdAt;
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
            router.push(`/shared/chat/${post.id}` as any);
          }}
          style={({ pressed }) => [
            styles.threadRow,
            {
              backgroundColor: pressed ? colors.surface : 'transparent',
              opacity: pressed ? 0.86 : 1,
            },
          ]}
        >
          <View>
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
            <Text
              numberOfLines={1}
              style={[
                styles.threadPreview,
                hasUnread ? styles.threadPreviewUnread : null,
                { color: hasUnread ? colors.text : colors.secondaryText },
              ]}
            >
              {latestPreview}
            </Text>
            {summary?.latestActivityAt ? (
              <Text
                numberOfLines={1}
                style={[styles.threadMemoryContext, { color: colors.secondaryText }]}
              >
                {memoryPreview}
              </Text>
            ) : null}
          </View>
          <View style={styles.threadMeta}>
            <Text style={[styles.threadTime, { color: colors.secondaryText }]}>
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
    [colors, getThreadParticipant, readStateByPostId, router, t, threadSummaryByPostId, user?.uid]
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
            <View style={styles.threadRow}>
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View
        style={[
          styles.chatListHeader,
          {
            paddingTop: headerTopInset + 6,
            backgroundColor: colors.background,
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
            styles.chatListBackButton,
            {
              opacity: pressed ? 0.64 : 1,
            },
          ]}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text numberOfLines={1} style={[styles.chatListTitle, { color: colors.text }]}>
          {t('shared.chatsTitle', 'Chats')}
        </Text>
        <View style={styles.chatListHeaderSpacer} />
      </View>
      {!authReady || (loading && threads.length === 0) ? (
        renderLoadingThreads()
      ) : threads.length === 0 ? (
        <View style={styles.emptyScreen}>
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="chatbubbles-outline" size={54} color={colors.secondaryText} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t('shared.chatsEmptyTitle', 'No chats yet')}
            </Text>
            <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
              {t('shared.chatsEmptyBody', 'Share a memory with a friend to start a thread.')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('shared.chatsEmptyAction', 'Open shared moments')}
              onPress={() => {
                router.push('/shared' as any);
              }}
              style={({ pressed }) => [
                styles.emptyAction,
                { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
              ]}
            >
              <Text style={[styles.emptyActionLabel, { color: colors.onPrimary }]}>
                {t('shared.chatsEmptyAction', 'Open shared moments')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <FlashList
          data={threads}
          keyExtractor={(item) => item.id}
          renderItem={renderThreadItem}
          ItemSeparatorComponent={() => (
            <View style={[styles.threadSeparator, { backgroundColor: colors.border }]} />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: insets.bottom + 32,
            paddingHorizontal: Layout.screenPadding,
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chatListHeader: {
    minHeight: 74,
    paddingHorizontal: 14,
    paddingBottom: 7,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  chatListBackButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatListTitle: {
    flex: 1,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    fontFamily: 'Noto Sans',
  },
  chatListHeaderSpacer: {
    width: 42,
    height: 42,
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
    paddingHorizontal: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  threadPreview: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Noto Sans',
  },
  threadPreviewUnread: {
    fontWeight: '800',
  },
  threadMemoryContext: {
    fontSize: 11,
    lineHeight: 15,
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

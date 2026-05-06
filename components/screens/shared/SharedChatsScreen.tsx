import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { useSharedFeedStore } from '../../../hooks/useSharedFeed';
import { useTheme } from '../../../hooks/useTheme';
import type { SharedPost } from '../../../services/sharedFeedService';
import { formatChatTimestamp } from '../../../utils/dateUtils';

const CHAT_LIST_SKELETON_ROWS = [
  { key: 'first', titleWidth: '46%', previewWidth: '68%' },
  { key: 'second', titleWidth: '38%', previewWidth: '54%' },
  { key: 'third', titleWidth: '52%', previewWidth: '62%' },
] as const;

function getThreadPreview(post: SharedPost, t: ReturnType<typeof useTranslation>['t']) {
  if (post.type === 'photo') {
    return post.placeName
      ? t('shared.chatThreadPhotoAtPlace', 'Photo memory from {{place}}', {
          place: post.placeName,
        })
      : t('shared.chatThreadPhoto', 'Photo memory');
  }

  return post.text || t('shared.chatThreadNote', 'Shared note');
}

function getThreadIconName(post: SharedPost) {
  return post.type === 'photo' ? 'image-outline' : 'document-text-outline';
}

export default function SharedChatsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isReady: authReady, user } = useAuth();
  const { friends = [], loading, sharedPosts = [] } = useSharedFeedStore();
  const friendById = useMemo(() => {
    const next = new Map<string, (typeof friends)[number]>();
    for (const friend of friends) {
      next.set(friend.userId, friend);
    }
    return next;
  }, [friends]);
  const threads = useMemo(
    () =>
      [...sharedPosts].sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
    [sharedPosts]
  );
  const getThreadParticipant = useCallback(
    (post: SharedPost) => {
      const participantUid =
        [post.authorUid, ...post.audienceUserIds].find((candidate) => candidate !== user?.uid) ??
        post.authorUid;
      const friend = friendById.get(participantUid) ?? null;
      const label =
        participantUid === user?.uid
          ? t('shared.chatYou', 'You')
          : friend?.nickname?.trim() ||
            (friend?.username ? `@${friend.username}` : null) ||
            (participantUid === post.authorUid ? post.authorDisplayName?.trim() : null) ||
            t('shared.someone', 'Someone');

      return {
        label,
        photoUri:
          friend?.photoURLSnapshot ??
          (participantUid === post.authorUid ? post.authorPhotoURLSnapshot : null),
      };
    },
    [friendById, t, user?.uid]
  );
  const renderThreadItem = useCallback(
    ({ item: post }: { item: SharedPost }) => {
      const participant = getThreadParticipant(post);
      const avatarLabel = participant.label.replace(/^@/, '').charAt(0).toUpperCase();
      return (
        <Pressable
          accessibilityRole="button"
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
                  {avatarLabel}
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
              <Ionicons name={getThreadIconName(post)} size={12} color={colors.primary} />
            </View>
          </View>
          <View style={styles.threadCopy}>
            <Text numberOfLines={1} style={[styles.threadTitle, { color: colors.text }]}>
              {participant.label}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.threadPreview, { color: colors.secondaryText }]}
            >
              {getThreadPreview(post, t)}
            </Text>
          </View>
          <View style={styles.threadMeta}>
            <Text style={[styles.threadTime, { color: colors.secondaryText }]}>
              {formatChatTimestamp(post.createdAt)}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} />
          </View>
        </Pressable>
      );
    },
    [colors, getThreadParticipant, router, t]
  );
  const renderLoadingThreads = useCallback(
    () => (
      <View
        style={[
          styles.skeletonList,
          {
            paddingTop: insets.top + 68,
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
    [colors.border, colors.primarySoft, insets.bottom, insets.top]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerShadowVisible: false,
          title: t('shared.chatsTitle', 'Chats'),
          headerTintColor: colors.text,
          headerBackButtonDisplayMode: 'minimal',
          headerBackButtonMenuEnabled: false,
        }}
      />
      {!authReady || loading ? (
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
            paddingTop: insets.top + 68,
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
  threadPreview: {
    fontSize: 13,
    lineHeight: 18,
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
});

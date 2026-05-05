import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { useSharedFeedStore } from '../../../hooks/useSharedFeed';
import { useTheme } from '../../../hooks/useTheme';
import type { SharedPost } from '../../../services/sharedFeedService';
import { formatDate } from '../../../utils/dateUtils';
import NotoLoader from '../../ui/NotoLoader';

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
        <View style={styles.center}>
          <NotoLoader variant="note" color={colors.primary} />
        </View>
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
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: insets.top + 76,
            paddingBottom: insets.bottom + 32,
            paddingHorizontal: Layout.screenPadding,
          }}
        >
          <View style={styles.threadList}>
            {threads.map((post) => {
              const participant = getThreadParticipant(post);
              const avatarLabel = participant.label.replace(/^@/, '').charAt(0).toUpperCase();
              return (
                <Pressable
                  key={post.id}
                  accessibilityRole="button"
                  onPress={() => {
                    router.push(`/shared/chat/${post.id}` as any);
                  }}
                  style={({ pressed }) => [
                    styles.threadRow,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      opacity: pressed ? 0.86 : 1,
                    },
                  ]}
                >
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
                      {formatDate(post.createdAt, 'short')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} />
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
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
  threadList: {
    gap: 10,
  },
  threadRow: {
    minHeight: 78,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    fontFamily: 'Noto Sans',
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
  },
  threadTime: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'Noto Sans',
  },
});

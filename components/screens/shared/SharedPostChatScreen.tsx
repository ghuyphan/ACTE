import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
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
import { formatDate } from '../../../utils/dateUtils';
import NotoLoader from '../../ui/NotoLoader';

type SharedPostChatScreenProps = {
  postId: string;
};

function formatResponseBody(response: SharedPostResponse) {
  return [response.emoji, response.text].filter(Boolean).join(' ').trim();
}

function getSharedPostPreviewUri(post: SharedPost) {
  if (post.type !== 'photo') {
    return null;
  }

  return post.photoLocalUri ?? null;
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
  const router = useRouter();
  const { user } = useAuth();
  const {
    friends = [],
    loading,
    refreshSharedFeed,
    sharedPosts = [],
    getSharedPostResponses = async () => [],
    subscribeToSharedPostResponses,
    createSharedPostResponse = async () => {
      throw new Error(t('shared.responseSendFailed', 'Could not send response.'));
    },
  } = useSharedFeedStore();
  const [responses, setResponses] = useState<SharedPostResponse[]>([]);
  const [draft, setDraft] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingResponses, setIsLoadingResponses] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const scrollRef = useRef<ScrollView | null>(null);

  const post = sharedPosts.find((item) => item.id === postId) ?? null;
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
  const isPostFromSelf = post?.authorUid === user?.uid;
  useEffect(() => {
    setIsLoadingResponses(true);
    setErrorMessage(null);
    setRealtimeStatus('connecting');

    if (!subscribeToSharedPostResponses) {
      let cancelled = false;
      void getSharedPostResponses(postId)
        .then((nextResponses) => {
          if (!cancelled) {
            setResponses(nextResponses);
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
            setRealtimeStatus('disconnected');
          }
        });

      return () => {
        cancelled = true;
      };
    }

    try {
      return subscribeToSharedPostResponses(postId, {
        onResponses: (nextResponses) => {
          setResponses(nextResponses);
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
        onStatus: setRealtimeStatus,
      });
    } catch (error) {
      setIsLoadingResponses(false);
      setRealtimeStatus('disconnected');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t('shared.responseLoadFailed', 'Could not load responses.')
      );
    }

    return undefined;
  }, [getSharedPostResponses, postId, subscribeToSharedPostResponses, t]);

  useEffect(() => {
    if (!post && !loading) {
      void refreshSharedFeed?.().catch(() => undefined);
    }
  }, [loading, post, refreshSharedFeed]);

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [responses.length]);

  const sendResponse = useCallback(
    async (emoji?: string) => {
      if (!post || isSending) {
        return;
      }

      const text = draft.trim();
      if (!emoji && !text) {
        return;
      }

      setIsSending(true);
      setErrorMessage(null);
      try {
        const response = await createSharedPostResponse(post.id, {
          emoji: emoji ?? null,
          text: emoji ? null : text,
        });
        setResponses((current) => [...current, response]);
        if (!emoji) {
          setDraft('');
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : t('shared.responseSendFailed', 'Could not send response.')
        );
      } finally {
        setIsSending(false);
      }
    },
    [createSharedPostResponse, draft, isSending, post, t]
  );

  const openMemory = useCallback(() => {
    router.push(`/shared/${postId}` as any);
  }, [postId, router]);

  const contentBottomPadding = insets.bottom + 112;
  const quickResponses = ['💛', '🥹', '✨', '😂'];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerShadowVisible: false,
          title: '',
          headerTitleAlign: 'left',
          headerTitle: () =>
            post ? (
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
                <Text numberOfLines={1} style={[styles.headerIdentityText, { color: colors.text }]}>
                  {headerIdentityLabel}
                </Text>
              </View>
            ) : (
              <Text style={[styles.headerFallbackTitle, { color: colors.text }]}>
                {t('shared.chatTitle', 'Chat')}
              </Text>
            ),
          headerTintColor: colors.text,
          headerBackButtonDisplayMode: 'minimal',
          headerBackButtonMenuEnabled: false,
          headerRight: post
            ? () => (
                <View
                  style={[
                    styles.headerPresenceDot,
                    {
                      backgroundColor:
                        realtimeStatus === 'connected' ? colors.success : colors.secondaryText,
                      opacity: realtimeStatus === 'connected' ? 1 : 0.48,
                    },
                  ]}
                />
              )
            : undefined,
        }}
      />

      {!post && loading ? (
        <View style={styles.center}>
          <NotoLoader variant="note" color={colors.primary} />
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
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.threadContent,
              {
                paddingTop: insets.top + 58,
                paddingBottom: contentBottomPadding,
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              onPress={openMemory}
              style={({ pressed }) => [
                styles.memoryPreviewBlock,
                isPostFromSelf ? styles.memoryPreviewSelf : styles.memoryPreviewFriend,
                { opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <View style={styles.memoryCard}>
                <MiniMemoryCard
                  post={post}
                  fallbackText={t('shared.noteFallback', 'Shared note')}
                  isDark={isDark}
                />
              </View>
              <View
                style={[
                  styles.memoryMetaPill,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
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
                <View style={[styles.memoryMetaDot, { backgroundColor: colors.secondaryText }]} />
                <Ionicons name="location" size={13} color={colors.secondaryText} />
                <Text numberOfLines={1} style={[styles.memoryMetaText, { color: colors.secondaryText }]}>
                  {post.placeName ?? t('shared.sharedNow', 'Shared now')}
                </Text>
                <View style={[styles.memoryMetaDot, { backgroundColor: colors.secondaryText }]} />
                <Text style={[styles.memoryMetaTime, { color: colors.secondaryText }]}>
                  {formatDate(post.createdAt, 'short')}
                </Text>
                <Ionicons name="chevron-forward" size={15} color={colors.secondaryText} />
              </View>
            </Pressable>

            <View style={styles.messageList}>
              {isLoadingResponses ? (
                <View style={styles.inlineLoader}>
                  <NotoLoader variant="inline" size="small" color={colors.primary} />
                </View>
              ) : responses.length === 0 ? (
                <Text style={[styles.emptyThreadHint, { color: colors.secondaryText }]}>
                  {t('shared.chatEmptyHint', 'Start with a quick reaction.')}
                </Text>
              ) : (
                responses.map((response) => {
                  const isSelf = response.authorUid === user?.uid;
                  const body = formatResponseBody(response);
                  return (
                    <View
                      key={response.id}
                      style={[
                        styles.messageBubble,
                        isSelf ? styles.selfBubble : styles.friendBubble,
                        {
                          backgroundColor: isSelf ? colors.primary : colors.surface,
                          borderColor: isSelf ? 'transparent' : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.messageAuthor,
                          { color: isSelf ? colors.onPrimary : colors.secondaryText },
                        ]}
                      >
                        {getAuthorLabel(response.authorUid, response.authorDisplayName)}
                      </Text>
                      <Text
                        style={[
                          styles.messageText,
                          { color: isSelf ? colors.onPrimary : colors.text },
                        ]}
                      >
                        {body}
                      </Text>
                      <Text
                        style={[
                          styles.messageTime,
                          { color: isSelf ? `${colors.onPrimary}B8` : colors.secondaryText },
                        ]}
                      >
                        {formatDate(response.createdAt, 'short')}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>

          <View
            style={[
              styles.composerShell,
              {
                paddingBottom: Math.max(insets.bottom, 12),
                backgroundColor: isDark ? 'rgba(28,28,30,0.96)' : 'rgba(255,253,250,0.96)',
                borderTopColor: colors.border,
              },
            ]}
          >
            {errorMessage ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>
            ) : null}
            <View style={styles.quickResponses}>
              {quickResponses.map((emoji) => (
                <Pressable
                  key={emoji}
                  accessibilityRole="button"
                  onPress={() => {
                    void sendResponse(emoji);
                  }}
                  disabled={isSending}
                  style={({ pressed }) => [
                    styles.emojiButton,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      opacity: isSending ? 0.5 : pressed ? 0.82 : 1,
                    },
                  ]}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
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
    </KeyboardAvoidingView>
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
  headerIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minWidth: 0,
    maxWidth: 240,
  },
  headerAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarLabel: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    fontFamily: 'Noto Sans',
  },
  headerIdentityText: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
    fontFamily: 'Noto Sans',
  },
  headerFallbackTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    fontFamily: 'Noto Sans',
  },
  headerPresenceDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginRight: 4,
  },
  memoryPreviewBlock: {
    width: '72%',
    maxWidth: 260,
    alignItems: 'center',
  },
  memoryPreviewFriend: {
    alignSelf: 'flex-start',
  },
  memoryPreviewSelf: {
    alignSelf: 'flex-end',
  },
  memoryCard: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 30,
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
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
    textAlign: 'center',
    fontFamily: 'Noto Sans',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  memoryMetaPill: {
    minHeight: 40,
    width: '94%',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 7,
    paddingRight: 9,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  memoryAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
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
  memoryMetaText: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
  },
  memoryMetaTime: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: 'Noto Sans',
  },
  messageList: {
    paddingTop: 24,
    gap: 10,
  },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 3,
  },
  selfBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 8,
  },
  friendBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 8,
  },
  messageAuthor: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: 'Noto Sans',
  },
  messageTime: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'Noto Sans',
  },
  inlineLoader: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  emptyThreadHint: {
    alignSelf: 'center',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Noto Sans',
  },
  composerShell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Layout.screenPadding,
    paddingTop: 10,
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Noto Sans',
  },
  quickResponses: {
    flexDirection: 'row',
    gap: 8,
  },
  emojiButton: {
    width: 42,
    height: 36,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 18,
    lineHeight: 22,
  },
  composer: {
    minHeight: 48,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 14,
    paddingRight: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  composerInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
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

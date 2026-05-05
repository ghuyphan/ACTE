import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useSharedFeedStore } from '../../hooks/useSharedFeed';
import { useTheme } from '../../hooks/useTheme';
import { showAppAlert } from '../../utils/alert';
import { formatDate } from '../../utils/dateUtils';
import {
  buildFriendDisplayNameById,
  getSharedAuthorDisplayName,
  getSharedResponseAuthorDisplayName,
} from '../../utils/sharedDisplayNames';
import { SharedPostMemoryCard } from '../home/MemoryCardPrimitives';
import AppSheet from '../sheets/AppSheet';
import { getGlassSurfacePalette } from '../ui/glassTokens';
import type { SharedPostResponse } from '../../services/sharedFeedService';

interface SharedPostDetailSheetProps {
  postId: string;
  visible: boolean;
  onClose: () => void;
  onClosed?: () => void;
  onOpenChat?: (postId: string) => void;
}

function formatAuthorHandle(displayName: string | null | undefined, fallback: string) {
  const label = displayName?.trim() || fallback;
  return label.startsWith('@') ? label : `@${label}`;
}

export default function SharedPostDetailSheet({
  postId,
  visible,
  onClose,
  onClosed,
  onOpenChat,
}: SharedPostDetailSheetProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    friends = [],
    sharedPosts = [],
    deleteSharedPostById,
    getSharedPostResponses = async () => [],
    createSharedPostResponse = async () => {
      throw new Error(t('shared.responseSendFailed', 'Could not send response.'));
    },
  } = useSharedFeedStore();
  const [responses, setResponses] = useState<SharedPostResponse[]>([]);
  const [responseText, setResponseText] = useState('');
  const [responseError, setResponseError] = useState<string | null>(null);
  const [isSendingResponse, setIsSendingResponse] = useState(false);
  const closeHandledRef = useRef(false);
  const glassPalette = getGlassSurfacePalette({
    isDark,
    borderColor: colors.border,
    colors,
  });

  const post = sharedPosts.find((item) => item.id === postId) ?? null;
  const isOwnedPost = Boolean(post && user?.uid === post.authorUid);
  const friendLabelById = useMemo(
    () => buildFriendDisplayNameById(friends, t('shared.friendFallback', 'Friend')),
    [friends, t]
  );

  useEffect(() => {
    let cancelled = false;
    if (!visible || !postId) {
      setResponses([]);
      return () => {
        cancelled = true;
      };
    }

    void getSharedPostResponses(postId)
      .then((nextResponses) => {
        if (!cancelled) {
          setResponses(nextResponses);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setResponseError(
            error instanceof Error
              ? error.message
              : t('shared.responseLoadFailed', 'Could not load responses.')
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [getSharedPostResponses, postId, t, visible]);

  useEffect(() => {
    if (visible) {
      closeHandledRef.current = false;
    }
  }, [visible]);

  const handleDismiss = useCallback(() => {
    if (closeHandledRef.current) {
      return;
    }

    closeHandledRef.current = true;
    onClose();
    onClosed?.();
  }, [onClose, onClosed]);

  const handleDelete = useCallback(() => {
    if (!post) {
      return;
    }

    showAppAlert(
      t('shared.deleteTitle', 'Delete shared moment'),
      t('shared.deleteBody', 'This shared post will be removed for everyone in the feed.'),
      [
        {
          text: t('common.cancel', 'Cancel'),
          style: 'cancel',
        },
        {
          text: t('shared.deleteButton', 'Delete'),
          style: 'destructive',
          onPress: () => {
            void deleteSharedPostById(post.id)
              .then(() => {
                handleDismiss();
              })
              .catch((error) => {
                showAppAlert(
                  t('shared.deleteTitle', 'Delete shared moment'),
                  error instanceof Error ? error.message : t('shared.genericError', 'Something went wrong.')
                );
              });
          },
        },
      ]
    );
  }, [deleteSharedPostById, handleDismiss, post, t]);

  const sendResponse = useCallback(
    async (emoji?: string) => {
      if (!post || isSendingResponse) {
        return;
      }

      const text = responseText.trim();
      if (!emoji && !text) {
        return;
      }

      setIsSendingResponse(true);
      setResponseError(null);
      try {
        const response = await createSharedPostResponse(post.id, {
          emoji: emoji ?? null,
          text: emoji ? null : text,
        });
        setResponses((current) => [...current, response]);
        if (!emoji) {
          setResponseText('');
        }
      } catch (error) {
        setResponseError(
          error instanceof Error
            ? error.message
            : t('shared.responseSendFailed', 'Could not send response.')
        );
      } finally {
        setIsSendingResponse(false);
      }
    },
    [createSharedPostResponse, isSendingResponse, post, responseText, t]
  );

  const renderBody = () => {
    if (!post) {
      return (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t('shared.detailNotFound', 'Shared moment not found')}
          </Text>
          <Pressable onPress={handleDismiss} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: colors.primary }]}>
              {t('common.goBack', 'Go Back')}
            </Text>
          </Pressable>
        </View>
      );
    }

    const authorLabel = getSharedAuthorDisplayName(
      post.authorUid,
      post.authorDisplayName,
      friendLabelById,
      t('shared.someone', 'Someone'),
      user?.uid
    );

    return (
      <ScrollView
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: Layout.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <SharedPostMemoryCard
          post={post}
          colors={colors}
          t={t}
          showSharedBadge={isOwnedPost}
          metadataFullWidth
        />

        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: glassPalette.controlBackgroundColor,
              borderColor: glassPalette.controlBorderColor,
            },
          ]}
        >
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={18} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              {formatAuthorHandle(authorLabel, t('shared.someone', 'Someone'))}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={18} color={colors.secondaryText} />
            <Text style={[styles.infoText, { color: colors.secondaryText }]}>
              {formatDate(post.createdAt, 'long')}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color={colors.secondaryText} />
            <Text style={[styles.infoText, { color: colors.secondaryText }]}>
              {post.placeName ?? t('shared.sharedNow', 'Shared now')}
            </Text>
          </View>
        </View>

        <View style={styles.responsesBlock}>
          <View style={styles.responsesHeader}>
            <Text style={[styles.responsesTitle, { color: colors.text }]}>
              {t('shared.responsesTitle', 'Responses')}
            </Text>
            {onOpenChat ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => onOpenChat(post.id)}
                style={({ pressed }) => [
                  styles.openChatButton,
                  {
                    backgroundColor: glassPalette.controlBackgroundColor,
                    borderColor: glassPalette.controlBorderColor,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.text} />
                <Text style={[styles.openChatText, { color: colors.text }]}>
                  {t('shared.openChat', 'Open chat')}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.quickResponses}>
            {['💛', '🥹', '✨', '😂'].map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => {
                  void sendResponse(emoji);
                }}
                disabled={isSendingResponse}
                style={({ pressed }) => [
                  styles.emojiButton,
                  {
                    backgroundColor: glassPalette.controlBackgroundColor,
                    borderColor: glassPalette.controlBorderColor,
                    opacity: isSendingResponse ? 0.5 : pressed ? 0.82 : 1,
                  },
                ]}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
          <View
            style={[
              styles.responseComposer,
              {
                backgroundColor: glassPalette.controlBackgroundColor,
                borderColor: responseError ? colors.danger : glassPalette.controlBorderColor,
              },
            ]}
          >
            <TextInput
              value={responseText}
              onChangeText={setResponseText}
              placeholder={t('shared.responsePlaceholder', 'Write a quick response')}
              placeholderTextColor={colors.secondaryText}
              maxLength={160}
              style={[styles.responseInput, { color: colors.text }]}
              returnKeyType="send"
              onSubmitEditing={() => {
                void sendResponse();
              }}
            />
            <Pressable
              onPress={() => {
                void sendResponse();
              }}
              disabled={isSendingResponse || !responseText.trim()}
              style={({ pressed }) => [
                styles.sendResponseButton,
                {
                  backgroundColor: colors.primary,
                  opacity: isSendingResponse || !responseText.trim() ? 0.45 : pressed ? 0.82 : 1,
                },
              ]}
            >
              <Ionicons name="send" size={16} color="#1C1C1E" />
            </Pressable>
          </View>
          {responseError ? (
            <Text style={[styles.responseError, { color: colors.danger }]}>
              {responseError}
            </Text>
          ) : null}
          <View style={styles.responseList}>
            {responses.map((response) => (
              <View
                key={response.id}
                style={[
                  styles.responseRow,
                  {
                    backgroundColor: glassPalette.controlBackgroundColor,
                    borderColor: glassPalette.controlBorderColor,
                  },
                ]}
              >
                <Text style={[styles.responseAuthor, { color: colors.text }]} numberOfLines={1}>
                  {getSharedResponseAuthorDisplayName(
                    response,
                    friendLabelById,
                    t('shared.someone', 'Someone'),
                    user?.uid,
                    t('shared.chatYou', 'You')
                  )}
                </Text>
                <Text style={[styles.responseBody, { color: colors.secondaryText }]}>
                  {[response.emoji, response.text].filter(Boolean).join(' ')}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {isOwnedPost ? (
          <Pressable
            onPress={handleDelete}
            style={[
              styles.deleteButton,
              {
                backgroundColor: isDark ? 'rgba(255,69,58,0.12)' : 'rgba(255,59,48,0.1)',
              },
            ]}
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={[styles.deleteLabel, { color: colors.danger }]}>
              {t('shared.deleteButton', 'Delete')}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    );
  };

  return (
    <AppSheet visible={visible} onClose={handleDismiss}>
      {renderBody()}
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'Noto Sans',
  },
  backButton: {
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Noto Sans',
  },
  infoCard: {
    marginTop: 24,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 14,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Noto Sans',
  },
  responsesBlock: {
    marginTop: 22,
    gap: 12,
  },
  responsesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  responsesTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
  },
  openChatButton: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  openChatText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
  },
  quickResponses: {
    flexDirection: 'row',
    gap: 10,
  },
  emojiButton: {
    width: 46,
    height: 42,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 20,
    lineHeight: 24,
  },
  responseComposer: {
    minHeight: 50,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 14,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  responseInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontFamily: 'Noto Sans',
  },
  sendResponseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  responseError: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Noto Sans',
  },
  responseList: {
    gap: 8,
  },
  responseRow: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 3,
  },
  responseAuthor: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
  },
  responseBody: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Noto Sans',
  },
  deleteButton: {
    marginTop: 18,
    minHeight: 48,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteLabel: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
});

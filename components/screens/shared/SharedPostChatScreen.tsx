import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type KeyboardEvent,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { useConnectivity } from '../../../hooks/useConnectivity';
import * as Haptics from '../../../hooks/useHaptics';
import { useSharedFeedStore } from '../../../hooks/useSharedFeed';
import { useSharedPostChatResponses } from '../../../hooks/shared/useSharedPostChatResponses';
import { useSharedPostTypingPresence } from '../../../hooks/shared/useSharedPostTypingPresence';
import {
  getResponseDeliveryStatus,
  isReactionOnlyResponse,
  mergeChatResponses,
  useSharedPostChatThreadPresentation,
  type ChatDeliveryStatus,
  type ChatListItem,
  type ChatThreadResponse as SharedPostChatThreadResponse,
} from '../../../hooks/shared/useSharedPostChatThread';
import { useTheme } from '../../../hooks/useTheme';
import type {
  SharedPost,
  SharedPostResponse,
} from '../../../services/sharedFeedService';
import {
  getRememberedSharedChatThreadPost,
  rememberSharedChatThreadPost,
} from '../../../services/sharedChatPostMemory';
import { rememberSharedPostResponses } from '../../../services/sharedPostResponseMemory';
import { getUserSocialName } from '../../../utils/appUser';
import {
  formatSharedResponseBody,
  getSharedChatIdentity,
  isDirectChatPost,
} from '../../../utils/sharedChatPresentation';
import { setActiveSharedChatPostId } from '../../../utils/socialNotificationPresentation';
import { withAlpha } from '../../../utils/colors';
import TextFieldEditSheet from '../../sheets/TextFieldEditSheet';

type SharedPostChatScreenProps = {
  directFriendUid?: string | string[] | null;
  initialResponseId?: string | string[] | null;
  postId: string;
};

type ChatThreadResponse = SharedPostChatThreadResponse;

type ReplyPreview = {
  authorLabel: string;
  body: string;
} | null;

type ReactionOverlay = {
  response: SharedPostResponse;
  pageX: number;
  pageY: number;
} | null;

type ChatMode = 'direct' | 'memory';

type ChatRenderContext = {
  canSendMessage: boolean;
  composerPlaceholder: string;
  hasPost: boolean;
  isResolvingInitialChat: boolean;
  notFoundBody: string;
  notFoundTitle: string;
  shouldRenderChatShell: boolean;
  shouldRenderPendingThread: boolean;
  shouldShowIdentityHeader: boolean;
};

const RESPONSE_SKELETON_ROWS = [
  { key: 'incoming-short', isSelf: false, width: '44%', minHeight: 40 },
  { key: 'self-reaction', isSelf: true, width: 54, minHeight: 44 },
  { key: 'incoming-long', isSelf: false, width: '68%', minHeight: 62 },
  { key: 'self-medium', isSelf: true, width: '50%', minHeight: 40 },
] as const;
const QUICK_RESPONSES = ['💛', '🥹', '✨', '😂'] as const;
const RESPONSE_PAGE_SIZE = 24;
const INFO_MESSAGE_VISIBLE_MS = 1800;
const COMPOSER_KEYBOARD_GAP = 4;
const COMPACT_REACTION_TRAY_WIDTH = 260;
const REACTION_TRAY_WITH_DETAILS_WIDTH = 316;
const REACTION_TRAY_ESTIMATED_HEIGHT = 58;
const TYPING_IDLE_HIDE_MS = 1500;
const TYPING_REFRESH_MS = 900;
const THREAD_SCROLL_POSITION_CONFIG = {
  startRenderingFromBottom: true,
  autoscrollToBottomThreshold: 0.25,
  animateAutoScrollToBottom: false,
} as const;

function scheduleKeyboardLayout(event: KeyboardEvent) {
  if (Platform.OS === 'ios') {
    Keyboard.scheduleLayoutAnimation(event);
  }
}

function getHeaderTopInset(topInset: number) {
  if (topInset > 0) {
    return topInset;
  }

  return Platform.OS === 'ios' ? 44 : StatusBar.currentHeight ?? 24;
}

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
  iconColor,
  isSelf,
  containerStyle,
  onReply,
  onLongPress,
  style,
}: {
  children: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  iconColor: string;
  isSelf: boolean;
  onReply: () => void;
  onLongPress: (event: GestureResponderEvent) => void;
  style: StyleProp<ViewStyle>;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const swipeDirection = isSelf ? -1 : 1;
  const iconOpacity = translateX.interpolate({
    inputRange: isSelf ? [-54, -18, 0] : [0, 18, 54],
    outputRange: isSelf ? [1, 0, 0] : [0, 0, 1],
    extrapolate: 'clamp',
  });
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
      style={[containerStyle, { transform: [{ translateX }] }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.replySwipeHint,
          isSelf ? styles.selfReplySwipeHint : styles.friendReplySwipeHint,
          { opacity: iconOpacity },
        ]}
      >
        <Ionicons name="return-up-back" size={18} color={iconColor} />
      </Animated.View>
      <Pressable onLongPress={onLongPress} delayLongPress={260} style={style}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

function ReactionTrayButton({
  emoji,
  index,
  label,
  onPress,
  selected,
  colors,
}: {
  emoji: string;
  index: number;
  label: string;
  onPress: () => void;
  selected: boolean;
  colors: {
    primary: string;
    primarySoft: string;
  };
}) {
  const entrance = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(entrance, {
      toValue: 1,
      delay: index * 28,
      damping: 13,
      stiffness: 260,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [entrance, index]);

  return (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [
          {
            translateY: entrance.interpolate({
              inputRange: [0, 1],
              outputRange: [5, 0],
            }),
          },
          {
            scale: Animated.multiply(
              pressScale,
              entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [0.82, 1],
              })
            ),
          },
        ],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        onPressIn={() => {
          Animated.spring(pressScale, {
            toValue: 0.88,
            damping: 12,
            stiffness: 360,
            mass: 0.5,
            useNativeDriver: true,
          }).start();
        }}
        onPressOut={() => {
          Animated.spring(pressScale, {
            toValue: 1,
            damping: 12,
            stiffness: 360,
            mass: 0.5,
            useNativeDriver: true,
          }).start();
        }}
        style={[
          styles.reactionTrayButton,
          {
            backgroundColor: selected ? colors.primarySoft : 'transparent',
            borderColor: selected ? colors.primary : 'transparent',
          },
        ]}
      >
        <Text style={styles.reactionTrayText}>{emoji}</Text>
      </Pressable>
    </Animated.View>
  );
}

function TypingIndicatorDots({ color }: { color: string }) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 520,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 520,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.Text
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.typingDotsText, { color, opacity }]}
    >
      •••
    </Animated.Text>
  );
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

function SharedChatHeaderTitle({
  avatarInitial,
  avatarUri,
  colors,
  label,
  presenceStatus,
  shouldShowIdentity,
  shouldShowPresence,
  subtitle,
  titleFallback,
}: {
  avatarInitial: string;
  avatarUri: string | null;
  colors: ReturnType<typeof useTheme>['colors'];
  label: string;
  presenceStatus: 'online' | 'offline' | 'unknown';
  shouldShowIdentity: boolean;
  shouldShowPresence: boolean;
  subtitle: string | null;
  titleFallback: string;
}) {
  if (!shouldShowIdentity) {
    return (
      <Text numberOfLines={1} style={[styles.headerFallbackTitle, { color: colors.text }]}>
        {titleFallback}
      </Text>
    );
  }

  return (
    <View style={styles.headerIdentity}>
      <View style={styles.headerAvatarHost}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.headerAvatar} contentFit="cover" />
        ) : (
          <View style={[styles.headerAvatar, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.headerAvatarLabel, { color: colors.primary }]}>
              {avatarInitial}
            </Text>
          </View>
        )}
        {shouldShowPresence ? (
          <View
            style={[
              styles.headerPresenceDot,
              {
                backgroundColor:
                  presenceStatus === 'online' ? colors.success : colors.secondaryText,
                borderColor: colors.background,
                opacity: presenceStatus === 'unknown' ? 0.42 : 1,
              },
            ]}
          />
        ) : null}
      </View>
      <View style={styles.headerCopy}>
        <Text numberOfLines={1} style={[styles.headerIdentityText, { color: colors.text }]}>
          {label}
        </Text>
        {subtitle ? (
          <View style={styles.headerSubtitleRow}>
            <Text
              numberOfLines={1}
              style={[styles.headerSubtitle, { color: colors.secondaryText }]}
            >
              {subtitle}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function SharedPostChatScreen({
  directFriendUid,
  initialResponseId,
  postId,
}: SharedPostChatScreenProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const headerTopInset = getHeaderTopInset(insets.top);
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const { user } = useAuth();
  const { isOnline } = useConnectivity();
  const {
    friends = [],
    friendPresence = {},
    loading,
    refreshSharedFeed,
    sharedPosts = [],
    getDirectChatThreadPost = async () => null,
    getOrCreateDirectChatPost = async () => {
      throw new Error(t('shared.directChatStartFailed', 'Could not start chat.'));
    },
    getSharedChatThreadPost = async () => null,
    getSharedPostResponsesPage = async () => [],
    subscribeToSharedPostResponses,
    subscribeToSharedPostTyping = () => ({
      setTyping: () => undefined,
      unsubscribe: () => undefined,
    }),
    updateFriendNickname = async () => undefined,
    createSharedPostResponseReaction = async () => {
      throw new Error(t('shared.responseSendFailed', 'Could not send response.'));
    },
    deleteSharedPostResponseReaction = async () => undefined,
    markSharedThreadRead = async () => null,
    createSharedPostResponse = async () => {
      throw new Error(t('shared.responseSendFailed', 'Could not send response.'));
    },
  } = useSharedFeedStore();
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isNicknameEditorVisible, setIsNicknameEditorVisible] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [nicknameErrorMessage, setNicknameErrorMessage] = useState<string | null>(null);
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [replyTarget, setReplyTarget] = useState<SharedPostResponse | null>(null);
  const [reactionOverlay, setReactionOverlay] = useState<ReactionOverlay>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loadedChatPost, setLoadedChatPost] = useState<SharedPost | null>(() =>
    getRememberedSharedChatThreadPost(postId)
  );
  const [isLoadingChatPost, setIsLoadingChatPost] = useState(false);
  const [chatPostErrorMessage, setChatPostErrorMessage] = useState<string | null>(null);
  const [highlightedResponseId, setHighlightedResponseId] = useState<string | null>(null);
  const [isThreadFirstPaintReady, setIsThreadFirstPaintReady] = useState(false);
  const [isJumpToLatestMounted, setIsJumpToLatestMounted] = useState(false);
  const [composerHeight, setComposerHeight] = useState(96);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const listRef = useRef<FlashListRef<ChatListItem> | null>(null);
  const composerFocusedRef = useRef(false);
  const highlightResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const infoMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMarkedReadSignatureRef = useRef<string | null>(null);
  const optimisticSequenceRef = useRef(0);
  const reactionOverlayProgress = useRef(new Animated.Value(0)).current;
  const jumpToLatestProgress = useRef(new Animated.Value(0)).current;
  const sendButtonPulse = useRef(new Animated.Value(0)).current;
  const pendingInitialResponseIdRef = useRef<string | null>(null);
  const canLoadOlderResponsesRef = useRef(false);
  const lastThreadScrollYRef = useRef<number | null>(null);

  const normalizedDirectFriendUid = Array.isArray(directFriendUid)
    ? directFriendUid[0]?.trim() || null
    : directFriendUid?.trim() || null;
  const sharedPostForRoute = sharedPosts.find((item) => item.id === postId) ?? null;
  const sharedDirectPostForFriend = normalizedDirectFriendUid
    ? sharedPosts.find(
        (item) =>
          isDirectChatPost(item) && item.audienceUserIds.includes(normalizedDirectFriendUid)
      ) ?? null
    : null;
  const loadedChatPostMatchesRoute =
    loadedChatPost?.id === postId ||
    Boolean(
      loadedChatPost &&
        normalizedDirectFriendUid &&
        isDirectChatPost(loadedChatPost) &&
        loadedChatPost.audienceUserIds.includes(normalizedDirectFriendUid)
    );
  const post =
    sharedPostForRoute ??
    sharedDirectPostForFriend ??
    (loadedChatPostMatchesRoute ? loadedChatPost : null);
  const isDirectChat = Boolean(
    normalizedDirectFriendUid ||
      (post ? isDirectChatPost(post) : postId.startsWith('direct-chat-'))
  );
  const activePostId = post?.id ?? postId;
  const pendingDirectFriend = normalizedDirectFriendUid
    ? friends.find((friend) => friend.userId === normalizedDirectFriendUid) ?? null
    : null;
  const normalizedInitialResponseId = Array.isArray(initialResponseId)
    ? initialResponseId[0]?.trim() || null
    : initialResponseId?.trim() || null;
  const isSyntheticDirectChatRoute = Boolean(
    normalizedDirectFriendUid && postId.trim() === `direct-${normalizedDirectFriendUid}`
  );
  const {
    clearNewMessageCount,
    connectionStatus,
    errorMessage,
    hasHydratedResponses,
    hasOlderResponses,
    isLoadingOlderResponses,
    isLoadingResponses,
    isThreadEndVisible,
    isThreadEndVisibleRef,
    loadOlderResponses,
    newMessageCount,
    pendingResponsesRef,
    responses,
    setErrorMessage,
    setThreadEndVisible,
    updateResponses,
  } = useSharedPostChatResponses({
    enabled: Boolean(post),
    getSharedPostResponsesPage,
    isOnline,
    pageSize: RESPONSE_PAGE_SIZE,
    postId: activePostId,
    responseLoadFailedMessage: t('shared.responseLoadFailed', 'Could not load responses.'),
    subscribeToSharedPostResponses,
  });
  const {
    clearTypingIdleTimer,
    handleDraftChange: handleTypingDraftChange,
    publishTypingState,
    typingUsers,
  } = useSharedPostTypingPresence({
    enabled: Boolean(post && user?.uid),
    heartbeatMs: TYPING_REFRESH_MS,
    idleMs: TYPING_IDLE_HIDE_MS,
    postId: activePostId,
    subscribeToSharedPostTyping,
  });
  const chatThreadLabels = useMemo(
    () => ({
      today: t('common.today', 'Today'),
      yesterday: t('common.yesterday', 'Yesterday'),
    }),
    [t]
  );
  const { responseById, responseGroups } = useSharedPostChatThreadPresentation(
    responses,
    chatThreadLabels
  );
  const shouldShowJumpToLatest = !isThreadEndVisible && responses.length > 0;
  const friendById = useMemo(() => {
    const next = new Map<string, (typeof friends)[number]>();
    for (const friend of friends) {
      next.set(friend.userId, friend);
    }
    return next;
  }, [friends]);

  const getAuthorIdentity = useCallback(
    (
      authorUid: string,
      displayName: string | null | undefined,
      photoURLSnapshot?: string | null
    ) => {
      return getSharedChatIdentity(
        {
          currentUserUid: user?.uid,
          displayNameSnapshot: displayName,
          friend: friendById.get(authorUid) ?? null,
          photoURLSnapshot,
          userId: authorUid,
        },
        {
          friendFallback: t('shared.friendFallback', 'Friend'),
          someone: t('shared.someone', 'Someone'),
          you: t('shared.chatYou', 'You'),
        }
      );
    },
    [friendById, t, user?.uid]
  );
  const getAuthorLabel = useCallback(
    (authorUid: string, displayName: string | null | undefined) => {
      return getAuthorIdentity(authorUid, displayName).label;
    },
    [getAuthorIdentity]
  );
  const getResponseReplyPreview = useCallback(
    (response: ChatThreadResponse): ReplyPreview => {
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
        body: formatSharedResponseBody(target),
      };
    },
    [getAuthorLabel, responseById]
  );

  const clearHighlightResetTimer = useCallback(() => {
    if (highlightResetTimerRef.current) {
      clearTimeout(highlightResetTimerRef.current);
      highlightResetTimerRef.current = null;
    }
  }, []);

  const clearInfoMessageTimer = useCallback(() => {
    if (infoMessageTimerRef.current) {
      clearTimeout(infoMessageTimerRef.current);
      infoMessageTimerRef.current = null;
    }
  }, []);

  const showInfoMessage = useCallback(
    (message: string) => {
      clearInfoMessageTimer();
      setInfoMessage(message);
      infoMessageTimerRef.current = setTimeout(() => {
        infoMessageTimerRef.current = null;
        setInfoMessage(null);
      }, INFO_MESSAGE_VISIBLE_MS);
    },
    [clearInfoMessageTimer]
  );

  const handleDraftChange = useCallback(
    (nextDraft: string) => {
      handleTypingDraftChange(nextDraft, setDraft);
    },
    [handleTypingDraftChange]
  );

  useEffect(() => {
    setActiveSharedChatPostId(activePostId);
    return () => {
      setActiveSharedChatPostId(null);
    };
  }, [activePostId]);

  useEffect(() => {
    pendingInitialResponseIdRef.current = normalizedInitialResponseId;
  }, [activePostId, normalizedInitialResponseId]);

  useEffect(() => {
    if (sharedPostForRoute || sharedDirectPostForFriend || loadedChatPostMatchesRoute) {
      return;
    }

    setLoadedChatPost(getRememberedSharedChatThreadPost(postId));
  }, [loadedChatPostMatchesRoute, postId, sharedDirectPostForFriend, sharedPostForRoute]);

  useEffect(() => {
    if (post) {
      rememberSharedChatThreadPost(post);
    }
  }, [post]);

  useEffect(() => {
    lastMarkedReadSignatureRef.current = null;
    canLoadOlderResponsesRef.current = false;
    lastThreadScrollYRef.current = null;
    setReplyTarget(null);
    setIsThreadFirstPaintReady(false);
  }, [activePostId]);

  useEffect(() => clearHighlightResetTimer, [clearHighlightResetTimer]);
  useEffect(() => clearInfoMessageTimer, [clearInfoMessageTimer]);

  useEffect(() => {
    Animated.spring(reactionOverlayProgress, {
      toValue: reactionOverlay ? 1 : 0,
      useNativeDriver: true,
      damping: 16,
      stiffness: 260,
      mass: 0.7,
    }).start();
  }, [reactionOverlay, reactionOverlayProgress]);

  useEffect(() => {
    if (shouldShowJumpToLatest) {
      setIsJumpToLatestMounted(true);
      Animated.spring(jumpToLatestProgress, {
        toValue: 1,
        useNativeDriver: true,
        damping: 17,
        stiffness: 360,
        mass: 0.7,
      }).start();
      return;
    }

    Animated.timing(jumpToLatestProgress, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsJumpToLatestMounted(false);
      }
    });
  }, [jumpToLatestProgress, shouldShowJumpToLatest]);

  const postAuthorLabel = post
    ? getAuthorLabel(post.authorUid, post.authorDisplayName)
    : pendingDirectFriend
      ? getAuthorIdentity(
          pendingDirectFriend.userId,
          pendingDirectFriend.displayNameSnapshot,
          pendingDirectFriend.photoURLSnapshot
        ).label
      : t('shared.someone', 'Someone');
  const participantIds = useMemo(() => {
    if (!post && normalizedDirectFriendUid) {
      return [normalizedDirectFriendUid];
    }

    if (!post) {
      return [];
    }

    return Array.from(new Set([post.authorUid, ...post.audienceUserIds])).filter(
      (participantUid) => participantUid !== user?.uid
    );
  }, [normalizedDirectFriendUid, post, user?.uid]);
  const participantLabels = useMemo(() => {
    if (!post && pendingDirectFriend) {
      return [
        getAuthorIdentity(
          pendingDirectFriend.userId,
          pendingDirectFriend.displayNameSnapshot,
          pendingDirectFriend.photoURLSnapshot
        ).label,
      ];
    }

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
  }, [getAuthorIdentity, getAuthorLabel, participantIds, pendingDirectFriend, post, postAuthorLabel]);
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
    () =>
      primaryParticipantUid
        ? getAuthorIdentity(primaryParticipantUid, primaryFriend?.displayNameSnapshot ?? null)
            .publicLabel
        : null,
    [getAuthorIdentity, primaryFriend?.displayNameSnapshot, primaryParticipantUid]
  );
  const headerIdentityLabel = useMemo(() => {
    if (!post) {
      return (
        primaryFriend?.nickname?.trim() ||
        (primaryFriend?.username ? `@${primaryFriend.username}` : null) ||
        primaryParticipantLabel ||
        t('shared.chatTitle', 'Chat')
      );
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
  const headerIdentity = primaryParticipantUid
    ? getAuthorIdentity(
        primaryParticipantUid,
        primaryParticipantUid === post?.authorUid
          ? post?.authorDisplayName
          : primaryFriend?.displayNameSnapshot,
        primaryParticipantUid === post?.authorUid ? post?.authorPhotoURLSnapshot : null
      )
    : null;
  const headerAvatarUri = headerIdentity?.avatarUri ?? null;
  const headerAvatarInitial =
    headerIdentity?.avatarInitial ?? headerIdentityLabel.replace(/^@/, '').charAt(0).toUpperCase();
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
      if (!normalizedDirectFriendUid) {
        return null;
      }

      if (!isOnline) {
        return t('shared.chatOfflineConnection', 'Offline');
      }

      return isLoadingChatPost
        ? t('shared.chatConnecting', 'Syncing')
        : chatPostErrorMessage ?? t('shared.chatWaitingForConnection', 'Waiting for connection');
    }

    if (participantIds.length > 1) {
      return t('shared.chatParticipantsCount', '{{count}} people can reply', {
        count: participantIds.length,
      });
    }

    if (!isOnline) {
      return t('shared.chatOfflineConnection', 'Offline');
    }

    if (connectionStatus === 'connecting') {
      return t('shared.chatConnecting', 'Syncing');
    }

    if (connectionStatus === 'disconnected') {
      return t('shared.chatWaitingForConnection', 'Waiting for connection');
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
    return presenceText;
  }, [
    headerPresenceStatus,
    chatPostErrorMessage,
    connectionStatus,
    isLoadingChatPost,
    isOnline,
    normalizedDirectFriendUid,
    participantIds.length,
    post,
    primaryPresence?.lastSeenAt,
    t,
  ]);
  const shouldShowHeaderPresence = Boolean((post || normalizedDirectFriendUid) && participantIds.length <= 1);

  useEffect(() => {
    if (!post && !loading && !isDirectChat) {
      void refreshSharedFeed?.().catch(() => undefined);
    }
  }, [isDirectChat, loading, post, refreshSharedFeed]);

  useEffect(() => {
    if (post || loading) {
      return;
    }

    let cancelled = false;
    setIsLoadingChatPost(true);

    const loadChatPost = isSyntheticDirectChatRoute && normalizedDirectFriendUid
      ? getDirectChatThreadPost(normalizedDirectFriendUid)
      : getSharedChatThreadPost(postId);

    void loadChatPost
      .then((nextPost) => {
        if (!cancelled) {
          setChatPostErrorMessage(null);
          rememberSharedChatThreadPost(nextPost);
          setLoadedChatPost(nextPost);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadedChatPost(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingChatPost(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    getDirectChatThreadPost,
    getSharedChatThreadPost,
    isSyntheticDirectChatRoute,
    loading,
    normalizedDirectFriendUid,
    post,
    postId,
  ]);

  const markThreadReadThroughLatest = useCallback(() => {
    const lastResponse = responses[responses.length - 1] ?? null;
    const nextSignature = `${activePostId}:${lastResponse?.id ?? 'empty'}`;
    if (lastMarkedReadSignatureRef.current === nextSignature) {
      return;
    }

    lastMarkedReadSignatureRef.current = nextSignature;
    void markSharedThreadRead(activePostId, lastResponse?.id ?? null).catch(() => {
      lastMarkedReadSignatureRef.current = null;
    });
  }, [activePostId, markSharedThreadRead, responses]);

  useEffect(() => {
    if (isLoadingResponses || !isThreadEndVisibleRef.current) {
      return;
    }

    markThreadReadThroughLatest();
  }, [isLoadingResponses, isThreadEndVisibleRef, markThreadReadThroughLatest, responses]);

  const handleThreadScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const previousScrollY = lastThreadScrollYRef.current;
      if (
        previousScrollY !== null &&
        contentOffset.y < previousScrollY - 12
      ) {
        canLoadOlderResponsesRef.current = true;
      }
      lastThreadScrollYRef.current = contentOffset.y;
      const distanceFromEnd =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      const isNearEnd = distanceFromEnd < 96;
      setThreadEndVisible(isNearEnd);
      if (isNearEnd && !isLoadingResponses) {
        clearNewMessageCount();
        markThreadReadThroughLatest();
      }
    },
    [clearNewMessageCount, isLoadingResponses, markThreadReadThroughLatest, setThreadEndVisible]
  );
  const handleLoadOlderResponses = useCallback(() => {
    if (!canLoadOlderResponsesRef.current) {
      return;
    }

    void loadOlderResponses();
  }, [loadOlderResponses]);

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

  useEffect(() => {
    if (!draft.trim() || isSending) {
      sendButtonPulse.stopAnimation();
      sendButtonPulse.setValue(0);
      return;
    }

    Animated.sequence([
      Animated.timing(sendButtonPulse, {
        toValue: 1,
        duration: 130,
        useNativeDriver: true,
      }),
      Animated.timing(sendButtonPulse, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [draft, isSending, sendButtonPulse]);

  const sendResponse = useCallback(
    async (
      emoji?: string,
      explicitReplyToResponseId?: string | null,
      retryResponse?: ChatThreadResponse
    ) => {
      if (isSending) {
        return;
      }

      const text = retryResponse ? retryResponse.text.trim() : draft.trim();
      const responseEmoji = retryResponse ? retryResponse.emoji ?? undefined : emoji;
      if (!responseEmoji && !text) {
        return;
      }

      if (!post && normalizedDirectFriendUid) {
        if (!isOnline) {
          setErrorMessage(t('shared.chatOfflineSendMessage', 'You are offline. Retry when connected.'));
          return;
        }

        setIsSending(true);
        setChatPostErrorMessage(null);
        setErrorMessage(null);
        try {
          const nextPost = await getOrCreateDirectChatPost(normalizedDirectFriendUid);
          const response = await createSharedPostResponse(nextPost.id, {
            emoji: responseEmoji ?? null,
            text: responseEmoji ? null : text,
            replyToResponseId: replyTarget?.id ?? null,
          });
          rememberSharedPostResponses(nextPost.id, [response]);
          rememberSharedChatThreadPost(nextPost);
          setLoadedChatPost(nextPost);
          if (!retryResponse && !responseEmoji) {
            setDraft('');
            clearTypingIdleTimer();
            publishTypingState(false, { force: true });
          }
          if (!retryResponse && !explicitReplyToResponseId) {
            setReplyTarget(null);
          }
        } catch (error) {
          const failureMessage =
            error instanceof Error
              ? error.message
              : t('shared.directChatStartFailed', 'Could not start chat.');
          setChatPostErrorMessage(failureMessage);
          setErrorMessage(failureMessage);
        } finally {
          setIsSending(false);
        }
        return;
      }

      if (!post) {
        return;
      }

      optimisticSequenceRef.current += 1;
      const optimisticId =
        retryResponse?.id ?? `local-shared-response-${Date.now()}-${optimisticSequenceRef.current}`;
      const replyToResponseId =
        explicitReplyToResponseId ?? retryResponse?.replyToResponseId ?? replyTarget?.id ?? null;
      const optimisticResponse: ChatThreadResponse = {
        id: optimisticId,
        postId: post.id,
        authorUid: user?.uid ?? '',
        authorDisplayName: user ? getUserSocialName(user) : t('shared.chatYou', 'You'),
        authorPhotoURLSnapshot: user?.photoURL ?? null,
        emoji: responseEmoji ?? null,
        text: responseEmoji ? '' : text,
        replyToResponseId,
        createdAt: new Date().toISOString(),
        deliveryStatus: isOnline ? 'sending' : 'offline',
        failureMessage: isOnline
          ? null
          : t('shared.chatOfflineSendMessage', 'You are offline. Retry when connected.'),
      };
      pendingResponsesRef.current.set(optimisticId, optimisticResponse);
      updateResponses((current) => {
        const withoutRetry = retryResponse
          ? current.filter((item) => item.id !== retryResponse.id)
          : current;
        return mergeChatResponses(withoutRetry, [optimisticResponse]);
      });
      if (!retryResponse && !responseEmoji) {
        setDraft('');
        clearTypingIdleTimer();
        publishTypingState(false, { force: true });
      }
      if (!retryResponse && !explicitReplyToResponseId) {
        setReplyTarget(null);
      }
      markThreadReadThroughLatest();

      if (!isOnline) {
        pendingResponsesRef.current.delete(optimisticId);
        setIsSending(false);
        return;
      }

      setIsSending(true);
      setReactionOverlay(null);
      setErrorMessage(null);
      try {
        const response = await createSharedPostResponse(post.id, {
          emoji: responseEmoji ?? null,
          text: responseEmoji ? null : text,
          replyToResponseId,
        });
        pendingResponsesRef.current.delete(optimisticId);
        updateResponses((current) =>
          mergeChatResponses(
            current.filter((item) => item.id !== optimisticId),
            [response]
          )
        );
        markThreadReadThroughLatest();
      } catch (error) {
        pendingResponsesRef.current.delete(optimisticId);
        const failureMessage =
          error instanceof Error
            ? error.message
            : t('shared.responseSendFailed', 'Could not send response.');
        updateResponses((current) => {
          const failedStatus: ChatDeliveryStatus = isOnline ? 'failed' : 'offline';
          return current.map((item) =>
            item.id === optimisticId
              ? {
                  ...item,
                  deliveryStatus: failedStatus,
                  failureMessage,
                }
              : item
          );
        });
        setErrorMessage(failureMessage);
      } finally {
        setIsSending(false);
      }
    },
    [
      clearTypingIdleTimer,
      createSharedPostResponse,
      draft,
      getOrCreateDirectChatPost,
      isSending,
      isOnline,
      markThreadReadThroughLatest,
      normalizedDirectFriendUid,
      pendingResponsesRef,
      post,
      publishTypingState,
      replyTarget,
      setErrorMessage,
      setLoadedChatPost,
      t,
      updateResponses,
      user,
    ]
  );

  const retryFailedResponse = useCallback(
    (response: ChatThreadResponse) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      void sendResponse(response.emoji ?? undefined, response.replyToResponseId, response);
    },
    [sendResponse]
  );

  const removeFailedResponse = useCallback(
    (responseId: string) => {
      void Haptics.selectionAsync();
      pendingResponsesRef.current.delete(responseId);
      updateResponses((current) => current.filter((response) => response.id !== responseId));
    },
    [pendingResponsesRef, updateResponses]
  );

  const copyResponseText = useCallback(
    async (response: SharedPostResponse) => {
      const body = formatSharedResponseBody(response).trim();
      if (!body) {
        return;
      }

      try {
        await Clipboard.setStringAsync(body);
        setReactionOverlay(null);
        showInfoMessage(t('shared.chatCopiedMessage', 'Copied message'));
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : t('shared.chatCopyFailed', 'Could not copy message.')
        );
      }
    },
    [setErrorMessage, showInfoMessage, t]
  );

  const sendReaction = useCallback(
    async (targetResponse: SharedPostResponse, emoji: string) => {
      if (!post || !user?.uid) {
        return;
      }

      const currentTargetResponse = responseById.get(targetResponse.id) ?? targetResponse;
      const previousReaction =
        currentTargetResponse.reactions?.find((reaction) => reaction.authorUid === user.uid) ??
        null;
      const isRemovingReaction = previousReaction?.emoji === emoji;
      if (isRemovingReaction) {
        setReactionOverlay(null);
        updateResponses((current) =>
          current.map((response) =>
            response.id === targetResponse.id
              ? {
                  ...response,
                  reactions: (response.reactions ?? []).filter(
                    (reaction) => reaction.authorUid !== user.uid
                  ),
                }
              : response
          )
        );

        try {
          await deleteSharedPostResponseReaction(post.id, targetResponse.id);
        } catch (error) {
          if (previousReaction) {
            updateResponses((current) =>
              current.map((response) =>
                response.id === targetResponse.id
                  ? {
                      ...response,
                      reactions: [
                        ...(response.reactions ?? []).filter(
                          (reaction) => reaction.authorUid !== previousReaction.authorUid
                        ),
                        previousReaction,
                      ],
                    }
                  : response
              )
            );
          }
          setErrorMessage(
            error instanceof Error
              ? error.message
              : t('shared.responseSendFailed', 'Could not send response.')
          );
        }
        return;
      }

      const optimisticReaction = {
        id: `local-shared-response-reaction-${Date.now()}`,
        postId: post.id,
        responseId: targetResponse.id,
        authorUid: user.uid,
        authorDisplayName: user ? getUserSocialName(user) : t('shared.chatYou', 'You'),
        authorPhotoURLSnapshot: user.photoURL ?? null,
        emoji,
        createdAt: new Date().toISOString(),
      };
      setReactionOverlay(null);
      updateResponses((current) =>
        current.map((response) =>
          response.id === targetResponse.id
            ? {
                ...response,
                reactions: [
                  ...(response.reactions ?? []).filter(
                    (reaction) => reaction.authorUid !== user.uid
                  ),
                  optimisticReaction,
                ],
              }
            : response
        )
      );

      try {
        const reaction = await createSharedPostResponseReaction(post.id, targetResponse.id, emoji);
        updateResponses((current) =>
          current.map((response) =>
            response.id === targetResponse.id
              ? {
                  ...response,
                  reactions: [
                    ...(response.reactions ?? []).filter(
                      (item) =>
                        item.authorUid !== reaction.authorUid &&
                        item.id !== optimisticReaction.id
                    ),
                    reaction,
                  ],
                }
              : response
          )
        );
      } catch (error) {
        updateResponses((current) =>
          current.map((response) =>
            response.id === targetResponse.id
              ? {
                  ...response,
                  reactions: (response.reactions ?? []).filter(
                    (reaction) => reaction.id !== optimisticReaction.id
                  ),
                }
              : response
          )
        );
        setErrorMessage(
          error instanceof Error
            ? error.message
            : t('shared.responseSendFailed', 'Could not send response.')
        );
      }
    },
    [
      createSharedPostResponseReaction,
      deleteSharedPostResponseReaction,
      post,
      responseById,
      setErrorMessage,
      t,
      updateResponses,
      user,
    ]
  );

  const scrollToResponse = useCallback(
    (responseId: string | null | undefined) => {
      if (!responseId) {
        return;
      }

      const itemIndex = responseGroups.findIndex(
        (item) =>
          item.type === 'group' &&
          item.responses.some((response) => response.id === responseId)
      );
      if (itemIndex < 0) {
        return;
      }

      setHighlightedResponseId(responseId);
      listRef.current?.scrollToIndex({
        index: itemIndex,
        animated: true,
        viewPosition: 0.45,
      });
      clearHighlightResetTimer();
      highlightResetTimerRef.current = setTimeout(() => {
        highlightResetTimerRef.current = null;
        setHighlightedResponseId(null);
      }, 1200);
    },
    [clearHighlightResetTimer, responseGroups]
  );

  useEffect(() => {
    const targetResponseId = pendingInitialResponseIdRef.current;
    if (!targetResponseId || isLoadingResponses) {
      return;
    }

    if (responseById.has(targetResponseId)) {
      pendingInitialResponseIdRef.current = null;
      requestAnimationFrame(() => scrollToResponse(targetResponseId));
      return;
    }

    if (!hasOlderResponses || isLoadingOlderResponses) {
      return;
    }

    void loadOlderResponses();
  }, [
    hasOlderResponses,
    isLoadingOlderResponses,
    isLoadingResponses,
    loadOlderResponses,
    responseById,
    scrollToResponse,
  ]);

  const scrollToThreadEnd = useCallback((animated = true) => {
    clearNewMessageCount();
    setThreadEndVisible(true);
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, [clearNewMessageCount, setThreadEndVisible]);

  const settleThreadEndIfVisible = useCallback(() => {
    if (!isThreadEndVisibleRef.current) {
      return;
    }

    scrollToThreadEnd(false);
  }, [isThreadEndVisibleRef, scrollToThreadEnd]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        scheduleKeyboardLayout(event);
        setKeyboardHeight(Math.max(0, screenHeight - event.endCoordinates.screenY));
        if (composerFocusedRef.current) {
          requestAnimationFrame(settleThreadEndIfVisible);
        }
      }
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (event) => {
        scheduleKeyboardLayout(event);
        setKeyboardHeight(0);
      }
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [screenHeight, settleThreadEndIfVisible]);

  const handleComposerLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextHeight = Math.ceil(event.nativeEvent.layout.height);
      setComposerHeight((currentHeight) => {
        if (Math.abs(currentHeight - nextHeight) <= 1) {
          return currentHeight;
        }

        return nextHeight;
      });
    },
    []
  );

  const isKeyboardVisible = keyboardHeight > 0;
  const composerKeyboardOffset = Math.max(
    0,
    isKeyboardVisible ? keyboardHeight + COMPOSER_KEYBOARD_GAP : 0
  );
  const contentBottomPadding =
    composerHeight +
    composerKeyboardOffset +
    (typingUsers.some((typingUser) => typingUser.userId !== user?.uid) ? 32 : 18);
  const threadVerticalPaddingStyle = useMemo(
    () => ({
      paddingBottom: contentBottomPadding,
      paddingTop: 20,
    }),
    [contentBottomPadding]
  );

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(settleThreadEndIfVisible);
    });
  }, [contentBottomPadding, replyTarget, settleThreadEndIfVisible]);

  const isThreadHydrating = isLoadingResponses && responses.length === 0;
  const shouldPrepareThreadFirstPaint = !hasHydratedResponses && !isThreadFirstPaintReady;
  const initialThreadScrollIndex = responseGroups.length > 0 ? responseGroups.length - 1 : null;
  const handleThreadListLoad = useCallback(() => {
    scrollToThreadEnd(false);
  }, [scrollToThreadEnd]);
  useEffect(() => {
    if (isThreadHydrating || isThreadFirstPaintReady) {
      return;
    }

    if (responseGroups.length === 0) {
      setIsThreadFirstPaintReady(true);
      return;
    }

    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: false });
      requestAnimationFrame(() => {
        setIsThreadFirstPaintReady(true);
      });
    });
  }, [isThreadFirstPaintReady, isThreadHydrating, responseGroups.length]);

  const renderEmptyThread = useCallback(
    () =>
      isDirectChat ? null : (
        <View style={styles.messageList}>
          <Text style={[styles.emptyThreadHint, { color: colors.secondaryText }]}>
            {t('shared.chatEmptyHint', 'Start with a quick reaction.')}
          </Text>
        </View>
      ),
    [colors.secondaryText, isDirectChat, t]
  );
  const renderMessageSeparator = useCallback(() => <View style={styles.messageSeparator} />, []);
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
    ({ item }: { item: ChatListItem }) => {
      if (item.type === 'day') {
        return (
          <View style={styles.daySeparatorWrap}>
            <Text style={[styles.daySeparatorText, { color: colors.secondaryText }]}>
              {item.label}
            </Text>
          </View>
        );
      }

      const group = item;
      const isSelf = group.authorUid === user?.uid;
      const authorIdentity = getAuthorIdentity(
        group.authorUid,
        group.authorDisplayName,
        group.authorPhotoURLSnapshot
      );
      const authorLabel = authorIdentity.label;
      const avatarLabel = authorIdentity.avatarInitial;
      const avatarUri = authorIdentity.avatarUri;
      const shouldShowAuthorLabel = !isSelf && !isDirectChat;
      const shouldShowGroupTime = Boolean(group.showTimeLabel && group.timeLabel);
      const shouldShowStatus =
        isSelf &&
        group.responses.some((response) => getResponseDeliveryStatus(response) === 'sending');
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
                style={[
                  styles.messageAvatar,
                  shouldShowGroupTime ? styles.messageAvatarAlignedToBubble : null,
                ]}
                contentFit="cover"
              />
            ) : (
              <View
                style={[
                  styles.messageAvatar,
                  shouldShowGroupTime ? styles.messageAvatarAlignedToBubble : null,
                  { backgroundColor: colors.primarySoft },
                ]}
              >
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
            {shouldShowAuthorLabel ? (
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
                const hasReplyPreview = Boolean(replyPreview);
                const reactions = response.reactions ?? [];
                const isHighlighted = highlightedResponseId === response.id;
                const isReactionOverlayTarget = reactionOverlay?.response.id === response.id;
                const deliveryStatus = getResponseDeliveryStatus(response);
                const isFailedDelivery =
                  deliveryStatus === 'failed' || deliveryStatus === 'offline';
                return (
                  <View
                    key={response.id}
                    style={[
                      styles.messageInteractionWrap,
                      hasReplyPreview ? styles.messageInteractionWrapWithReply : null,
                    ]}
                  >
                    {replyPreview ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('shared.chatJumpToReply', 'Jump to replied message')}
                        onPress={() => {
                          scrollToResponse(response.replyToResponseId);
                        }}
                        style={({ pressed }) => [
                          styles.replyPreviewBubble,
                          isSelf ? styles.selfReplyPreviewBubble : styles.friendReplyPreviewBubble,
                          {
                            backgroundColor: isSelf ? colors.primarySoft : colors.surface,
                            borderColor: colors.border,
                            opacity: pressed ? 0.72 : 1,
                          },
                        ]}
                      >
                        <View style={styles.replyPreviewCopy}>
                          <View style={styles.replyPreviewLabelRow}>
                            <Ionicons
                              name="return-up-back"
                              size={12}
                              color={colors.secondaryText}
                              style={styles.replyPreviewIcon}
                            />
                            <Text
                              numberOfLines={1}
                              style={[styles.replyPreviewLabel, { color: colors.secondaryText }]}
                            >
                              {t('shared.chatReplyingToName', 'Replying to {{name}}', {
                                name: replyPreview.authorLabel,
                              })}
                            </Text>
                          </View>
                          <Text
                            numberOfLines={1}
                            style={[styles.replyPreviewBody, { color: colors.secondaryText }]}
                          >
                            {replyPreview.body}
                          </Text>
                        </View>
                      </Pressable>
                    ) : null}
                    <ReplyableBubble
                      isSelf={isSelf}
                      containerStyle={hasReplyPreview ? styles.replyMessageBubbleContainer : null}
                      iconColor={colors.secondaryText}
                      onReply={() => {
                        setReplyTarget(response);
                        setReactionOverlay(null);
                      }}
                      onLongPress={(event) => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setReactionOverlay({
                          response,
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
                        hasReplyPreview
                          ? isSelf
                            ? styles.selfBubbleWithReply
                            : styles.friendBubbleWithReply
                          : null,
                        {
                          backgroundColor: isSelf ? colors.primary : colors.surface,
                          borderColor: isHighlighted || isReactionOverlayTarget
                            ? colors.primary
                            : isSelf
                              ? 'transparent'
                              : colors.border,
                        },
                      ]}
                    >
                      <Text
                        android_hyphenationFrequency="normal"
                        lineBreakStrategyIOS="standard"
                        style={[
                          styles.messageText,
                          isReactionOnly ? styles.reactionMessageText : null,
                          { color: isSelf ? colors.onPrimary : colors.text },
                        ]}
                      >
                        {formatSharedResponseBody(response)}
                      </Text>
                    </ReplyableBubble>
                    {reactions.length > 0 ? (
                      <View
                        style={[
                          styles.reactionChip,
                          isSelf ? styles.selfReactionChip : styles.friendReactionChip,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text style={styles.reactionChipText}>
                          {reactions.map((reaction) => reaction.emoji).join(' ')}
                        </Text>
                      </View>
                    ) : null}
                    {isSelf && isFailedDelivery ? (
                      <View style={styles.failedMessageActions}>
                        <Text numberOfLines={1} style={[styles.failedMessageText, { color: colors.danger }]}>
                          {deliveryStatus === 'offline'
                            ? t('shared.chatOfflineSendShort', 'Offline')
                            : response.failureMessage ??
                              t('shared.responseSendFailed', 'Could not send response.')}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('shared.chatRetryMessage', 'Retry message')}
                          onPress={() => retryFailedResponse(response)}
                          style={({ pressed }) => [
                            styles.failedMessageIconButton,
                            { borderColor: colors.border, opacity: pressed ? 0.72 : 1 },
                          ]}
                        >
                          <Ionicons name="refresh" size={14} color={colors.primary} />
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('shared.chatRemoveFailedMessage', 'Remove failed message')}
                          onPress={() => removeFailedResponse(response.id)}
                          style={({ pressed }) => [
                            styles.failedMessageIconButton,
                            { borderColor: colors.border, opacity: pressed ? 0.72 : 1 },
                          ]}
                        >
                          <Ionicons name="close" size={14} color={colors.secondaryText} />
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
            {shouldShowGroupTime ? (
              <View style={styles.messageTimeRow}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.messageTime,
                    {
                      color: colors.secondaryText,
                      textAlign: isSelf ? 'right' : 'left',
                    },
                  ]}
                >
                  {group.timeLabel}
                </Text>
              </View>
            ) : null}
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
      getAuthorIdentity,
      getResponseReplyPreview,
      highlightedResponseId,
      isDirectChat,
      reactionOverlay?.response.id,
      removeFailedResponse,
      retryFailedResponse,
      scrollToResponse,
      t,
      user?.uid,
    ]
  );
  const activeReactionOverlayResponse = reactionOverlay
    ? responseById.get(reactionOverlay.response.id) ?? reactionOverlay.response
    : null;
  const selectedReactionEmoji =
    activeReactionOverlayResponse?.reactions?.find(
      (reaction) => reaction.authorUid === user?.uid
    )?.emoji ?? null;
  const reactionDetailsLabel = activeReactionOverlayResponse?.reactions?.length
    ? activeReactionOverlayResponse.reactions
        .map((reaction) => {
          const identity = getAuthorIdentity(
            reaction.authorUid,
            reaction.authorDisplayName,
            reaction.authorPhotoURLSnapshot
          );
          return `${reaction.emoji} ${identity.label}`;
        })
        .join('  ·  ')
    : null;
  const reactionOverlayWidth = Math.min(
    reactionDetailsLabel ? REACTION_TRAY_WITH_DETAILS_WIDTH : COMPACT_REACTION_TRAY_WIDTH,
    screenWidth - 24
  );
  const reactionOverlayLeft = reactionOverlay
    ? Math.min(
        Math.max(reactionOverlay.pageX - reactionOverlayWidth / 2, 12),
        Math.max(12, screenWidth - reactionOverlayWidth - 12)
      )
    : 0;
  const reactionOverlayTop = reactionOverlay
    ? Math.min(
        Math.max(headerTopInset + 10, reactionOverlay.pageY - 72),
        Math.max(
          headerTopInset + 10,
          screenHeight - contentBottomPadding - REACTION_TRAY_ESTIMATED_HEIGHT - 12
        )
      )
    : 0;
  const visibleTypingUsers = typingUsers.filter((typingUser) => typingUser.userId !== user?.uid);
  const typingIndicatorLabel =
    visibleTypingUsers.length === 0
      ? null
      : visibleTypingUsers.length === 1
        ? t('shared.chatTypingOne', '{{name}} is typing', {
            name: getAuthorIdentity(
              visibleTypingUsers[0].userId,
              visibleTypingUsers[0].displayName,
              visibleTypingUsers[0].photoURL
            ).label,
          })
        : t('shared.chatTypingMany', '{{count}} people are typing', {
            count: visibleTypingUsers.length,
          });
  const latestResponse = responses[responses.length - 1] ?? null;
  const jumpToLatestPreviewLabel =
    newMessageCount > 0 && latestResponse
      ? t('shared.chatThreadLatestBy', '{{name}}: {{message}}', {
          name: getAuthorLabel(latestResponse.authorUid, latestResponse.authorDisplayName),
          message:
            formatSharedResponseBody(latestResponse).trim() ||
            t('shared.chatThreadActivity', 'New activity'),
        })
      : null;
  const chatContext: ChatRenderContext = useMemo(() => {
    const mode: ChatMode = isDirectChat ? 'direct' : 'memory';
    const canComposePendingDirectChat = Boolean(mode === 'direct' && normalizedDirectFriendUid);
    const isResolvingPendingDirectChat = Boolean(
      !post && canComposePendingDirectChat && (loading || isLoadingChatPost)
    );
    const isResolvingInitialChat = !post && !canComposePendingDirectChat && (loading || isLoadingChatPost);
    const shouldRenderPendingThread =
      mode === 'direct' && (isResolvingInitialChat || isResolvingPendingDirectChat);
    const hasPost = Boolean(post);
    return {
      canSendMessage: Boolean((post || canComposePendingDirectChat) && draft.trim() && !isSending),
      composerPlaceholder:
        mode === 'direct'
          ? t('shared.directChatComposerPlaceholder', 'Message')
          : t('shared.chatComposerPlaceholder', 'Reply to this memory'),
      hasPost,
      isResolvingInitialChat,
      notFoundBody:
        chatPostErrorMessage ??
        t('shared.chatNotFoundBody', 'This chat may no longer be available.'),
      notFoundTitle:
        mode === 'direct'
          ? t('shared.directChatStartFailed', 'Could not start chat.')
          : t('shared.detailNotFound', 'Shared moment not found'),
      shouldRenderChatShell: Boolean(post || shouldRenderPendingThread || canComposePendingDirectChat),
      shouldRenderPendingThread,
      shouldShowIdentityHeader: Boolean(post || primaryParticipantUid),
    };
  }, [
    chatPostErrorMessage,
    draft,
    isDirectChat,
    isLoadingChatPost,
    isSending,
    loading,
    normalizedDirectFriendUid,
    post,
    primaryParticipantUid,
    t,
  ]);
  const shouldShowDirectEmptyNudge =
    chatContext.shouldRenderChatShell &&
    isDirectChat &&
    responseGroups.length === 0 &&
    !isLoadingResponses &&
    !chatContext.shouldRenderPendingThread;
  const renderHeaderTitle = useCallback(
    () =>
      <SharedChatHeaderTitle
        avatarInitial={headerAvatarInitial}
        avatarUri={headerAvatarUri}
        colors={colors}
        label={headerIdentityLabel}
        presenceStatus={headerPresenceStatus}
        shouldShowIdentity={chatContext.shouldShowIdentityHeader}
        shouldShowPresence={shouldShowHeaderPresence}
        subtitle={headerSubtitle}
        titleFallback={t('shared.chatTitle', 'Chat')}
      />,
    [
      chatContext.shouldShowIdentityHeader,
      colors,
      headerAvatarInitial,
      headerAvatarUri,
      headerIdentityLabel,
      headerPresenceStatus,
      headerSubtitle,
      shouldShowHeaderPresence,
      t,
    ]
  );
  const renderHeaderRight = useCallback(
    () =>
      canEditHeaderNickname ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('shared.friendNicknameEdit', 'Edit nickname')}
          hitSlop={8}
          onPress={openNicknameEditor}
          style={({ pressed }) => [
            styles.chatHeaderSideButton,
            {
              opacity: pressed ? 0.64 : 1,
            },
          ]}
        >
          <Ionicons name="pencil-outline" size={21} color={colors.text} />
        </Pressable>
      ) : (
        <View style={styles.chatHeaderSideButton} />
      ),
    [canEditHeaderNickname, colors.text, openNicknameEditor, t]
  );
  const screenOptions = useMemo(
    () => ({
      headerRight: renderHeaderRight,
      headerTitle: renderHeaderTitle,
      headerTitleAlign: 'left' as const,
    }),
    [renderHeaderRight, renderHeaderTitle]
  );

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Stack.Screen options={screenOptions} />

      {!chatContext.hasPost &&
      !chatContext.shouldRenderChatShell &&
      chatContext.isResolvingInitialChat ? (
        <View style={styles.loadingChatContent} pointerEvents="none">
          {!isDirectChat ? (
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
          ) : null}
          <View
            style={[
              styles.loadingResponseSkeletonHost,
              { paddingBottom: contentBottomPadding },
            ]}
          >
            {renderResponseLoadingFooter()}
          </View>
        </View>
      ) : !chatContext.shouldRenderChatShell ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {chatContext.notFoundTitle}
          </Text>
          <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
            {chatContext.notFoundBody}
          </Text>
        </View>
      ) : (
        <>
          {chatContext.shouldRenderPendingThread ? (
            <View
              testID="shared-chat-thread-skeleton"
              style={styles.threadList}
              pointerEvents="none"
            >
              <View
                style={[
                  styles.threadContent,
                  styles.threadSkeletonContent,
                  threadVerticalPaddingStyle,
                ]}
              >
                {renderResponseLoadingFooter()}
              </View>
            </View>
          ) : isThreadHydrating ? (
            <View style={styles.threadList} pointerEvents="none">
              <View
                style={[
                  styles.threadContent,
                  styles.threadSkeletonContent,
                  threadVerticalPaddingStyle,
                ]}
              >
                {renderResponseLoadingFooter()}
              </View>
            </View>
          ) : (
            <View style={styles.threadList}>
              <FlashList
                key={activePostId}
                ref={listRef}
                style={[
                  styles.threadList,
                  shouldPrepareThreadFirstPaint ? styles.threadListPreparing : null,
                ]}
                data={responseGroups}
                keyExtractor={(item) => item.id}
                renderItem={renderResponseItem}
                extraData={responses}
                initialScrollIndex={initialThreadScrollIndex}
                ItemSeparatorComponent={renderMessageSeparator}
                ListEmptyComponent={renderEmptyThread}
                maintainVisibleContentPosition={THREAD_SCROLL_POSITION_CONFIG}
                onContentSizeChange={settleThreadEndIfVisible}
                onLoad={handleThreadListLoad}
                onStartReached={handleLoadOlderResponses}
                onStartReachedThreshold={0.2}
                onScroll={handleThreadScroll}
                onScrollEndDrag={handleThreadScroll}
                onMomentumScrollEnd={handleThreadScroll}
                scrollEventThrottle={120}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                  styles.threadContent,
                  threadVerticalPaddingStyle,
                ]}
              />
              {shouldPrepareThreadFirstPaint ? (
                <View style={styles.threadPreparingOverlay} pointerEvents="none">
                  <View
                    style={[
                      styles.threadContent,
                      styles.threadSkeletonContent,
                      threadVerticalPaddingStyle,
                    ]}
                  >
                    {renderResponseLoadingFooter()}
                  </View>
                </View>
              ) : null}
            </View>
            )}
            {isJumpToLatestMounted ? (
              <Animated.View
                pointerEvents={shouldShowJumpToLatest ? 'auto' : 'none'}
                style={[
                  styles.jumpToLatestHost,
                  {
                    bottom: contentBottomPadding + 10,
                    opacity: jumpToLatestProgress,
                    transform: [
                      {
                        translateY: jumpToLatestProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [8, 0],
                        }),
                      },
                      {
                        scale: jumpToLatestProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.82, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('shared.chatJumpToLatest', 'Jump to latest messages')}
                  onPress={() => scrollToThreadEnd(true)}
                  style={({ pressed }) => [
                    styles.jumpToLatestButton,
                    jumpToLatestPreviewLabel ? styles.jumpToLatestButtonWithPreview : null,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.82 : 1,
                    },
                  ]}
                >
                  <Ionicons name="arrow-down" size={17} color={colors.onPrimary} />
                  {jumpToLatestPreviewLabel ? (
                    <Text
                      numberOfLines={1}
                      style={[styles.jumpToLatestText, { color: colors.onPrimary }]}
                    >
                      {jumpToLatestPreviewLabel}
                    </Text>
                  ) : null}
                  {newMessageCount > 0 ? (
                    <View style={[styles.jumpToLatestBadge, { backgroundColor: colors.danger }]}>
                      <Text style={[styles.jumpToLatestBadgeText, { color: colors.onPrimary }]}>
                        {newMessageCount > 9 ? '9+' : newMessageCount}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              </Animated.View>
            ) : null}
            {shouldShowDirectEmptyNudge ? (
              <View
                pointerEvents="none"
                style={[
                  styles.emptyDirectChatNudgeHost,
                  {
                    bottom: contentBottomPadding + 18,
                  },
                ]}
              >
                <View
                  style={[
                    styles.emptyDirectChatNudge,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.emptyDirectChatNudgeText, { color: colors.secondaryText }]}>
                    {t('shared.directChatEmptyHint', 'Say hi to start the chat.')}
                  </Text>
                </View>
              </View>
            ) : null}

            <View
              onLayout={handleComposerLayout}
              style={[
                styles.composerShell,
                {
                  bottom: composerKeyboardOffset,
                  paddingBottom: isKeyboardVisible ? 6 : Math.max(insets.bottom, 12),
                },
              ]}
            >
              <LinearGradient
                pointerEvents="none"
                colors={[withAlpha(colors.background, 0), withAlpha(colors.background, 0.85)]}
                locations={[0, 1]}
                style={styles.composerFade}
              />
              {typingIndicatorLabel ? (
                <View
                  accessibilityRole="text"
                  accessibilityLabel={typingIndicatorLabel}
                  style={styles.typingIndicator}
                >
                  <TypingIndicatorDots color={colors.primary} />
                  <Text
                    numberOfLines={1}
                    style={[styles.typingIndicatorText, { color: colors.secondaryText }]}
                  >
                    {typingIndicatorLabel}
                  </Text>
                </View>
              ) : null}
            {errorMessage ? (
              <View style={styles.errorRow}>
                <Text style={[styles.errorText, { color: colors.danger }]} numberOfLines={2}>
                  {errorMessage}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('shared.chatDismissError', 'Dismiss chat error')}
                  onPress={() => setErrorMessage(null)}
                  style={styles.errorDismissButton}
                >
                  <Ionicons name="close" size={15} color={colors.danger} />
                </Pressable>
              </View>
            ) : null}
            {infoMessage ? (
              <View style={styles.composerStatusLine}>
                <Ionicons name="checkmark-circle" size={15} color={colors.primary} />
                <Text style={[styles.composerStatusText, { color: colors.secondaryText }]} numberOfLines={1}>
                  {infoMessage}
                </Text>
              </View>
            ) : null}
            {!isOnline ? (
              <View style={styles.composerStatusLine}>
                <Ionicons name="cloud-offline-outline" size={15} color={colors.secondaryText} />
                <Text style={[styles.composerStatusText, { color: colors.secondaryText }]} numberOfLines={1}>
                  {t('shared.chatComposerOfflineHint', 'Offline replies stay here until you retry.')}
                </Text>
              </View>
            ) : null}
            {replyTarget ? (
              <View
                style={[
                  styles.composerReplyPreview,
                  {
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <View style={styles.composerReplyCopy}>
                  <Text
                    numberOfLines={1}
                    style={[styles.composerReplyLabel, { color: colors.primary }]}
                  >
                    {t('shared.chatReplyingToName', 'Replying to {{name}}', {
                      name: getAuthorLabel(replyTarget.authorUid, replyTarget.authorDisplayName),
                    })}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[styles.composerReplyBody, { color: colors.secondaryText }]}
                  >
                    {formatSharedResponseBody(replyTarget)}
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
                onChangeText={handleDraftChange}
                placeholder={
                  chatContext.composerPlaceholder
                }
                placeholderTextColor={colors.secondaryText}
                accessibilityLabel={t('shared.chatComposerA11y', 'Message')}
                maxLength={160}
                returnKeyType="send"
                multiline
                textAlignVertical="top"
                underlineColorAndroid="transparent"
                style={[styles.composerInput, { color: colors.text }]}
                onFocus={() => {
                  composerFocusedRef.current = true;
                  if (draft.trim()) {
                    publishTypingState(true, { force: true });
                  }
                  settleThreadEndIfVisible();
                }}
                onBlur={() => {
                  composerFocusedRef.current = false;
                  clearTypingIdleTimer();
                  publishTypingState(false, { force: true });
                }}
                onSubmitEditing={() => {
                  void sendResponse();
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  isSending ? t('shared.chatSending', 'Sending...') : t('common.send', 'Send')
                }
                accessibilityState={{ disabled: !chatContext.canSendMessage }}
                onPress={() => {
                  void sendResponse();
                }}
                disabled={!chatContext.canSendMessage}
                style={({ pressed }) => [
                  styles.sendButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: !chatContext.canSendMessage ? 0.44 : pressed ? 0.82 : 1,
                  },
                ]}
              >
                <Animated.View
                  style={{
                    transform: [
                      {
                        scale: sendButtonPulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.08],
                        }),
                      },
                      {
                        translateY: sendButtonPulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -1],
                        }),
                      },
                    ],
                  }}
                >
                  <Ionicons
                    name={isSending ? 'time-outline' : 'send'}
                    size={16}
                    color={colors.onPrimary}
                  />
                </Animated.View>
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
            style={[StyleSheet.absoluteFill, styles.reactionOverlayScrim]}
            onPress={() => setReactionOverlay(null)}
          />
          <Animated.View
            style={[
              styles.reactionTray,
              {
                left: reactionOverlayLeft,
                top: reactionOverlayTop,
                width: reactionOverlayWidth,
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: reactionOverlayProgress,
                transform: [
                  {
                    scale: reactionOverlayProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.92, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.reactionTrayReactionRow}>
              {QUICK_RESPONSES.map((reactionEmoji, index) => (
                <ReactionTrayButton
                  key={`${reactionOverlay.response.id}:${reactionEmoji}`}
                  emoji={reactionEmoji}
                  index={index}
                  selected={selectedReactionEmoji === reactionEmoji}
                  colors={{
                    primary: colors.primary,
                    primarySoft: colors.primarySoft,
                  }}
                  label={
                    selectedReactionEmoji === reactionEmoji
                      ? t('shared.chatRemoveReaction', 'Remove {{emoji}} reaction', {
                          emoji: reactionEmoji,
                        })
                      : t('shared.chatReactWith', 'React with {{emoji}}', {
                          emoji: reactionEmoji,
                        })
                  }
                  onPress={() => {
                    void Haptics.selectionAsync();
                    void sendReaction(reactionOverlay.response, reactionEmoji);
                  }}
                />
              ))}
            </View>
            <View style={[styles.reactionTrayVerticalDivider, { backgroundColor: colors.border }]} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('shared.chatReplyToMessage', 'Reply to message')}
              onPress={() => {
                const target =
                  responseById.get(reactionOverlay.response.id) ?? reactionOverlay.response;
                void Haptics.selectionAsync();
                setReplyTarget(target);
                setReactionOverlay(null);
              }}
              style={({ pressed }) => [
                styles.reactionTrayIconAction,
                {
                  backgroundColor: pressed ? colors.primarySoft : 'transparent',
                },
              ]}
            >
              <Ionicons name="return-up-back" size={18} color={colors.primary} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('shared.chatCopyMessage', 'Copy message')}
              onPress={() => {
                void Haptics.selectionAsync();
                void copyResponseText(
                  responseById.get(reactionOverlay.response.id) ?? reactionOverlay.response
                );
              }}
              style={({ pressed }) => [
                styles.reactionTrayIconAction,
                {
                  backgroundColor: pressed ? colors.primarySoft : 'transparent',
                },
              ]}
            >
              <Ionicons name="copy-outline" size={18} color={colors.primary} />
            </Pressable>
            {reactionDetailsLabel ? (
              <Text
                numberOfLines={2}
                style={[styles.reactionDetailsText, { color: colors.secondaryText }]}
              >
                {reactionDetailsLabel}
              </Text>
            ) : null}
          </Animated.View>
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
    </View>
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
  threadListPreparing: {
    opacity: 0,
  },
  threadPreparingOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  threadSkeletonContent: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  loadingChatContent: {
    flex: 1,
    paddingHorizontal: Layout.screenPadding,
    paddingTop: 20,
  },
  loadingResponseSkeletonHost: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingTop: 20,
  },
  headerIdentity: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 9,
    marginLeft: 22,
    minWidth: 0,
  },
  headerAvatarHost: {
    width: 34,
    height: 34,
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
    alignItems: 'flex-start',
  },
  chatHeaderSideButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
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
    maxWidth: '100%',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    fontFamily: 'Noto Sans',
    textAlign: 'center',
  },
  headerPresenceDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  memoryPreviewBlock: {
    width: '100%',
    minHeight: 62,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 7,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memoryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
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
  loadingMemoryCard: {
    width: 48,
    height: 48,
    borderRadius: 14,
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
  daySeparatorWrap: {
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 10,
  },
  daySeparatorText: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
    overflow: 'hidden',
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
  messageInteractionWrapWithReply: {
    gap: 0,
    marginTop: 8,
  },
  replyMessageBubbleContainer: {
    marginTop: -1,
  },
  replySwipeHint: {
    position: 'absolute',
    top: '50%',
    marginTop: -9,
  },
  selfReplySwipeHint: {
    left: -30,
  },
  friendReplySwipeHint: {
    right: -30,
    transform: [{ scaleX: -1 }],
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageAvatarAlignedToBubble: {
    marginBottom: 18,
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
    minWidth: 152,
    maxWidth: 230,
    minHeight: 44,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 11,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  selfReplyPreviewBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 7,
  },
  friendReplyPreviewBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 7,
  },
  replyPreviewCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  replyPreviewLabelRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  replyPreviewIcon: {
    opacity: 0.82,
  },
  replyPreviewLabel: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    fontFamily: 'Noto Sans',
  },
  replyPreviewBody: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  reactionChip: {
    minHeight: 24,
    minWidth: 32,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: -6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  selfReactionChip: {
    alignSelf: 'flex-end',
    marginRight: 6,
  },
  friendReactionChip: {
    alignSelf: 'flex-start',
    marginLeft: 6,
  },
  reactionChipText: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: 'Noto Sans',
  },
  failedMessageActions: {
    alignSelf: 'flex-end',
    maxWidth: '92%',
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 7,
  },
  failedMessageText: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  failedMessageIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionTray: {
    position: 'absolute',
    zIndex: 10,
    minHeight: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 6,
  },
  reactionTrayReactionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 2,
  },
  reactionTrayButton: {
    width: 37,
    height: 37,
    borderRadius: 18.5,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionTrayVerticalDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    alignSelf: 'center',
    opacity: 0.38,
  },
  reactionTrayIconAction: {
    width: 37,
    height: 37,
    borderRadius: 18.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionDetailsText: {
    maxWidth: 92,
    paddingHorizontal: 4,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'Noto Sans',
  },
  reactionTrayText: {
    fontSize: 23,
    lineHeight: 28,
  },
  typingDotsText: {
    width: 34,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
    textAlign: 'center',
    fontFamily: 'Noto Sans',
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
  selfBubbleWithReply: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 6,
  },
  friendBubbleWithReply: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 18,
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
  messageTimeRow: {
    minHeight: 14,
    justifyContent: 'center',
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
  emptyDirectChatNudgeHost: {
    position: 'absolute',
    left: Layout.screenPadding,
    right: Layout.screenPadding,
    alignItems: 'center',
    zIndex: 7,
  },
  emptyDirectChatNudge: {
    minHeight: 34,
    maxWidth: '86%',
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDirectChatNudgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
    textAlign: 'center',
  },
  jumpToLatestHost: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 8,
  },
  jumpToLatestButton: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  jumpToLatestButtonWithPreview: {
    maxWidth: 260,
    paddingRight: 13,
  },
  jumpToLatestText: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: 198,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
  },
  jumpToLatestBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jumpToLatestBadgeText: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
    fontFamily: 'Noto Sans',
  },
  composerShell: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: Layout.screenPadding,
    paddingTop: 6,
    gap: 5,
  },
  composerFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -20,
    bottom: 0,
  },
  typingIndicator: {
    alignSelf: 'flex-start',
    maxWidth: '82%',
    minHeight: 22,
    paddingLeft: 3,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typingIndicatorText: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  reactionOverlayLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
  },
  reactionOverlayScrim: {
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  errorText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  errorRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorDismissButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerStatusLine: {
    minHeight: 22,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  composerStatusText: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  composerReplyPreview: {
    minHeight: 44,
    borderRadius: 22,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  composerReplyCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  composerReplyLabel: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    fontFamily: 'Noto Sans',
  },
  composerReplyBody: {
    fontSize: 14,
    lineHeight: 18,
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
    minHeight: 44,
    maxHeight: 108,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  composerInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 88,
    paddingTop: 7,
    paddingBottom: 7,
    fontFamily: 'Noto Sans',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

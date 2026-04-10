import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../ui/GlassView';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '../../hooks/useTheme';
import { SharedPost } from '../../services/sharedFeedService';
import { isOlderIOS } from '../../utils/platform';
import MapPreviewSheet from './MapPreviewSheet';
import {
  getOverlayBorderColor,
  getOverlayFallbackColor,
  getOverlayScrimColor,
  mapOverlayTokens,
} from './overlayTokens';

const PREVIEW_HORIZONTAL_INSET = 14;
const PREVIEW_MEDIA_SIZE = 56;
const PREVIEW_ROW_GAP = 12;
const PREVIEW_FOOTER_OFFSET = PREVIEW_MEDIA_SIZE + PREVIEW_ROW_GAP;

function getPreviewText(post: SharedPost, photoLabel: string, noContentLabel: string) {
  if (post.type === 'photo') {
    return photoLabel;
  }

  const normalized = post.text.trim();
  if (!normalized) {
    return noContentLabel;
  }

  return normalized.substring(0, 120) + (normalized.length > 120 ? '…' : '');
}

interface MapFriendsPreviewCardProps {
  visible: boolean;
  posts: SharedPost[];
  activePostId: string | null;
  bottomOffset: number;
  onOpen: () => void;
  onDismiss: () => void;
  onFocusPost: (postId: string) => void;
  onInteraction?: () => void;
  reduceMotionEnabled: boolean;
}

export default function MapFriendsPreviewCard({
  visible,
  posts,
  activePostId,
  bottomOffset,
  onOpen,
  onDismiss,
  onFocusPost,
  onInteraction,
  reduceMotionEnabled,
}: MapFriendsPreviewCardProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const previewListRef = useRef<any>(null);
  const previewDraggingRef = useRef(false);
  const pageWidth = useMemo(
    () => Math.max(0, windowWidth - PREVIEW_HORIZONTAL_INSET * 2 - mapOverlayTokens.overlayPadding * 2),
    [windowWidth]
  );

  const [isMounted, setIsMounted] = useState(visible);

  useEffect(() => {
    if (visible && !isMounted) {
      setIsMounted(true);
    }
  }, [visible, isMounted]);

  const handleFullyClosed = useCallback(() => {
    setIsMounted(false);
  }, []);

  const activeIndex = useMemo(() => {
    if (posts.length === 0) {
      return -1;
    }

    const index = posts.findIndex((post) => post.id === activePostId);
    return index >= 0 ? index : 0;
  }, [activePostId, posts]);

  const activePost = activeIndex >= 0 ? posts[activeIndex] ?? posts[0] : null;

  // Survive parent state clearing the posts while we animate out
  const lastValidDataRef = useRef<{
    posts: SharedPost[];
    activeIndex: number;
    activePost: SharedPost;
  } | null>(null);

  if (activePost && posts.length > 0) {
    lastValidDataRef.current = {
      posts,
      activeIndex,
      activePost,
    };
  }

  const renderData = (activePost && posts.length > 0)
    ? { posts, activeIndex, activePost }
    : lastValidDataRef.current;

  useEffect(() => {
    if (!previewListRef.current || activeIndex < 0) {
      return;
    }

    previewListRef.current.scrollToOffset({
      offset: activeIndex * pageWidth,
      animated: !reduceMotionEnabled,
    });
  }, [activeIndex, pageWidth, reduceMotionEnabled]);

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!previewDraggingRef.current) {
        return;
      }
      previewDraggingRef.current = false;

      const xOffset = event.nativeEvent.contentOffset.x;
      const nextIndex = Math.round(xOffset / pageWidth);
      const boundedIndex = Math.max(0, Math.min(nextIndex, posts.length - 1));
      const item = posts[boundedIndex];
      if (!item) {
        return;
      }

      onFocusPost(item.id);
    },
    [onFocusPost, pageWidth, posts]
  );

  if (!isMounted && !visible) {
    return null;
  }

  if (!renderData) {
    return null;
  }

  const {
    posts: renderPosts,
    activeIndex: renderIndex,
    activePost: renderPost,
  } = renderData;

  const previewCountLabel = `${Math.max(renderIndex, 0) + 1}/${renderPosts.length}`;

  return (
    <MapPreviewSheet
      isVisible={visible}
      onFullyClosed={handleFullyClosed}
      shellTestID="map-friends-preview-shell"
      dismissTestID="map-friends-preview-dismiss"
      bottomOffset={bottomOffset}
      handleColor={isDark ? 'rgba(255,255,255,0.34)' : 'rgba(60,60,67,0.22)'}
      onDismiss={onDismiss}
      reduceMotionEnabled={reduceMotionEnabled}
    >
      <View
        style={[
          styles.inner,
          {
            borderColor: getOverlayBorderColor(isDark),
            backgroundColor: getOverlayFallbackColor(isDark),
          },
        ]}
      >
        <GlassView
          pointerEvents="none"
          glassEffectStyle="regular"
          colorScheme={isDark ? 'dark' : 'light'}
          fallbackColor="transparent"
          style={StyleSheet.absoluteFill}
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: Platform.OS === 'android' ? getOverlayScrimColor(isDark) : isDark ? 'rgba(24,24,28,0.24)' : 'rgba(255,255,255,0.44)' },
          ]}
        />
        {isOlderIOS ? (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: getOverlayFallbackColor(isDark),
                borderRadius: mapOverlayTokens.overlayRadius,
              },
            ]}
          />
        ) : null}

        <View style={styles.cardContent}>
          <FlashList
            ref={previewListRef}
            testID="map-friends-preview-list"
            horizontal
            data={renderPosts}
            keyExtractor={(item) => item.id}
            drawDistance={pageWidth * 2}
            renderItem={({ item }) => {
              const authorLabel = item.authorDisplayName?.trim() || t('shared.someone', 'Someone');
              const previewText = getPreviewText(
                item,
                t('shared.photoMemory', 'Photo memory'),
                t('map.noContent', 'No note content')
              );

              return (
                <Pressable
                  testID={`map-friends-preview-item-${item.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: item.id === renderPost.id }}
                  style={[styles.previewPage, { width: pageWidth }]}
                  onPress={() => {
                    previewDraggingRef.current = false;
                    onInteraction?.();
                    onFocusPost(item.id);
                  }}
                >
                  <View style={styles.previewPageInner}>
                    {item.authorPhotoURLSnapshot ? (
                      <Image source={{ uri: item.authorPhotoURLSnapshot }} style={styles.avatar} contentFit="cover" />
                    ) : (
                      <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
                        <Text style={[styles.avatarLabel, { color: colors.primary }]}>
                          {authorLabel.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View style={styles.copyWrap}>
                      <Text
                        style={[styles.title, { color: item.id === renderPost.id ? colors.primary : colors.text }]}
                        numberOfLines={1}
                      >
                        {item.placeName || t('shared.sharedNow', 'Shared now')}
                      </Text>
                      <Text style={[styles.content, { color: colors.secondaryText }]} numberOfLines={2}>
                        {previewText}
                      </Text>
                      <View style={styles.metaRow}>
                        <Ionicons name="sparkles-outline" size={12} color={colors.primary} />
                        <Text style={[styles.metaText, { color: colors.primary }]}>
                          {t('map.friendFrom', 'From {{name}}', { name: authorLabel })}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            }}
            style={styles.previewList}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.previewListContent}
            snapToInterval={pageWidth > 0 ? pageWidth : undefined}
            decelerationRate="fast"
            snapToAlignment="start"
            disableIntervalMomentum
            bounces={false}
            scrollEnabled={renderPosts.length > 1}
            onScrollBeginDrag={() => {
              previewDraggingRef.current = true;
            }}
            onMomentumScrollEnd={handleMomentumEnd}
          />

          <View style={styles.footer}>
            <View style={styles.indexWrap}>
              <Text testID="map-friends-preview-index" style={[styles.indexText, { color: colors.secondaryText }]}>
                {previewCountLabel}
              </Text>
            </View>

            <Pressable
              testID="map-friends-preview-open"
              style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.72 : 1 }]}
              onPress={() => {
                onInteraction?.();
                onOpen();
              }}
            >
              <Ionicons name="arrow-forward-circle" size={14} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.primary }]}>
                {t('map.openShared', 'Open shared')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </MapPreviewSheet>
  );
}

const styles = StyleSheet.create({
  inner: {
    borderWidth: Platform.OS === 'android' ? 1 : StyleSheet.hairlineWidth,
    borderRadius: mapOverlayTokens.overlayRadius,
    overflow: 'hidden',
  },
  cardContent: {
    paddingHorizontal: mapOverlayTokens.overlayPadding,
    paddingTop: 20,
    paddingBottom: 12,
  },
  previewList: {
    marginBottom: 8,
  },
  previewListContent: {
    gap: 0,
  },
  previewPage: {
    minHeight: 76,
  },
  previewPageInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: PREVIEW_ROW_GAP,
    minHeight: 76,
  },
  avatar: {
    width: PREVIEW_MEDIA_SIZE,
    height: PREVIEW_MEDIA_SIZE,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontSize: 17,
    fontWeight: '800',
  },
  copyWrap: {
    flex: 1,
    minWidth: 0,
    paddingTop: 2,
  },
  metaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Noto Sans',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 6,
    fontFamily: 'Noto Sans',
  },
  content: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Noto Sans',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'space-between',
    marginTop: 4,
    paddingLeft: PREVIEW_FOOTER_OFFSET,
  },
  indexWrap: {
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Noto Sans',
  },
  actionButton: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
});

import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
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
import type { SharedValue } from 'react-native-reanimated';
import { GlassView } from '../ui/GlassView';
import { useTheme } from '../../hooks/useTheme';
import { getSharedPostPreviewText } from '../../services/noteTextPresentation';
import { SharedPost } from '../../services/sharedFeedService';
import { isOlderIOS } from '../../utils/platform';
import { MapPreviewPositionPill } from './MapPreviewFooterControls';
import MapPreviewSheet from './MapPreviewSheet';
import {
  getOverlayBorderColor,
  getOverlayFallbackColor,
  getOverlayScrimColor,
  mapOverlayTokens,
} from './overlayTokens';

const PREVIEW_HORIZONTAL_INSET = 14;
const PREVIEW_MEDIA_SIZE = 64;
const PREVIEW_ROW_GAP = 12;

function getPreviewText(post: SharedPost, photoLabel: string, noContentLabel: string) {
  return getSharedPostPreviewText(post, {
    photoLabel,
    emptyLabel: noContentLabel,
    maxLength: 120,
  });
}

function getPostPhotoUri(post: SharedPost) {
  if (post.type !== 'photo') {
    return null;
  }

  return (
    post.dualPrimaryPhotoLocalUri?.trim() ||
    post.photoLocalUri?.trim() ||
    post.dualSecondaryPhotoLocalUri?.trim() ||
    null
  );
}

interface MapFriendsPreviewCardProps {
  visible: boolean;
  posts: SharedPost[];
  activePostId: string | null;
  bottomOffset: number;
  onOpen: (postId?: string) => void;
  onDismiss: () => void;
  onFocusPost: (postId: string) => void;
  onInteraction?: () => void;
  reduceMotionEnabled: boolean;
  externalExpansionProgress?: SharedValue<number>;
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
  externalExpansionProgress,
}: MapFriendsPreviewCardProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const previewListRef = useRef<any>(null);
  const previewDraggingRef = useRef(false);
  const fullSurfaceWidth = Math.max(0, windowWidth - PREVIEW_HORIZONTAL_INSET * 2);
  const pageWidth = useMemo(
    () => Math.max(0, fullSurfaceWidth - mapOverlayTokens.overlayPadding * 2),
    [fullSurfaceWidth]
  );

  const [isMounted, setIsMounted] = useState(visible);

  useEffect(() => {
    if (visible && !isMounted) {
      setIsMounted(true);
    }
  }, [visible, isMounted]);

  useEffect(() => {
    if (externalExpansionProgress) {
      externalExpansionProgress.value = 0;
    }
  }, [externalExpansionProgress, visible]);

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

  const renderData =
    activePost && posts.length > 0 ? { posts, activeIndex, activePost } : lastValidDataRef.current;

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

  const handleItemPress = useCallback(
    (postId: string) => {
      previewDraggingRef.current = false;
      onInteraction?.();

      if (postId !== activePostId) {
        onFocusPost(postId);
        return;
      }

      onOpen(postId);
    },
    [activePostId, onFocusPost, onInteraction, onOpen]
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
  const showPreviewCount = renderPosts.length > 1;
  const previewPosition = Math.max(renderIndex, 0) + 1;

  return (
    <MapPreviewSheet
      isVisible={visible}
      onFullyClosed={handleFullyClosed}
      shellTestID="map-friends-preview-shell"
      dismissTestID="map-friends-preview-dismiss"
      bottomOffset={bottomOffset}
      onDismiss={onDismiss}
      reduceMotionEnabled={reduceMotionEnabled}
      allowHandlePress={false}
      allowDismiss
      allowDragDismiss
      allowExpand={false}
      handleVisible
    >
      <View style={[styles.surfaceHost, { width: fullSurfaceWidth }]}>
        <View
          style={[
            styles.surface,
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
              {
                backgroundColor: Platform.OS === 'android'
                  ? getOverlayScrimColor(isDark)
                  : isDark
                    ? 'rgba(24,24,28,0.24)'
                    : 'rgba(255,255,255,0.44)',
              },
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
                const photoUri = getPostPhotoUri(item);
                const previewText = getPreviewText(
                  item,
                  t('shared.photoMemory', 'Photo memory'),
                  t('map.noContent', 'No note content')
                );
                const isActive = item.id === renderPost.id;

                return (
                  <Pressable
                    testID={`map-friends-preview-item-${item.id}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    style={({ pressed }) => [
                      styles.previewPage,
                      { width: pageWidth, opacity: pressed ? 0.88 : 1 },
                    ]}
                    onPress={() => handleItemPress(item.id)}
                  >
                    <View style={styles.previewPageInner}>
                      {photoUri ? (
                        <View style={styles.previewMediaWrap}>
                          <Image source={{ uri: photoUri }} style={styles.previewPhoto} contentFit="cover" />
                          <View style={[styles.previewAvatarBadgeWrap, { backgroundColor: colors.card }]}>
                            {item.authorPhotoURLSnapshot ? (
                              <Image
                                source={{ uri: item.authorPhotoURLSnapshot }}
                                style={styles.previewAvatarBadge}
                                contentFit="cover"
                              />
                            ) : (
                              <View style={[styles.previewAvatarBadge, { backgroundColor: colors.primarySoft }]}>
                                <Text style={[styles.avatarBadgeLabel, { color: colors.primary }]}>
                                  {authorLabel.charAt(0).toUpperCase()}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      ) : item.authorPhotoURLSnapshot ? (
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
                          style={[styles.title, { color: isActive ? colors.primary : colors.text }]}
                          numberOfLines={1}
                        >
                          {item.placeName || t('shared.sharedNow', 'Shared now')}
                        </Text>
                        <Text style={[styles.content, { color: colors.secondaryText }]} numberOfLines={2}>
                          {previewText}
                        </Text>
                        <View style={styles.metaRow}>
                          <Ionicons name="sparkles-outline" size={12} color={colors.primary} />
                          <Text style={[styles.metaText, { color: colors.primary }]} numberOfLines={1}>
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
              {showPreviewCount ? (
                <MapPreviewPositionPill
                  current={previewPosition}
                  total={renderPosts.length}
                  testID="map-friends-preview-index"
                />
              ) : (
                <View />
              )}

              <Pressable
                testID="map-friends-preview-open"
                style={({ pressed }) => [
                  styles.actionButton,
                  { backgroundColor: `${colors.primary}14`, opacity: pressed ? 0.72 : 1 },
                ]}
                onPress={() => {
                  onInteraction?.();
                  onOpen(renderPost.id);
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
      </View>
    </MapPreviewSheet>
  );
}

const styles = StyleSheet.create({
  surfaceHost: {
    alignSelf: 'center',
  },
  surface: {
    borderWidth: Platform.OS === 'android' ? 1 : StyleSheet.hairlineWidth,
    borderRadius: mapOverlayTokens.overlayRadius,
    overflow: 'hidden',
  },
  cardContent: {
    paddingHorizontal: mapOverlayTokens.overlayPadding,
    paddingTop: 14,
    paddingBottom: 12,
  },
  previewList: {
    marginBottom: 10,
  },
  previewListContent: {
    gap: 0,
  },
  previewPage: {
    minHeight: 82,
  },
  previewPageInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: PREVIEW_ROW_GAP,
    minHeight: 82,
  },
  avatar: {
    width: PREVIEW_MEDIA_SIZE,
    height: PREVIEW_MEDIA_SIZE,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewMediaWrap: {
    width: PREVIEW_MEDIA_SIZE,
    height: PREVIEW_MEDIA_SIZE,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  previewPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  previewAvatarBadgeWrap: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewAvatarBadge: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
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
    flex: 1,
  },
  avatarBadgeLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
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
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
    flexShrink: 1,
  },
});

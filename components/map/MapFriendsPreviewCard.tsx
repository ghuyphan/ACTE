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
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { SharedPost } from '../../services/sharedFeedService';
import { isOlderIOS } from '../../utils/platform';
import {
  MapPreviewExpandButton,
  MapPreviewPositionPill,
  mapPreviewFooterStyles,
} from './MapPreviewFooterControls';
import MapPreviewSheet from './MapPreviewSheet';
import {
  getOverlayBorderColor,
  getOverlayFallbackColor,
  getOverlayScrimColor,
  mapOverlayTokens,
} from './overlayTokens';

const PREVIEW_HORIZONTAL_INSET = 14;
const PREVIEW_HEIGHT = 152;
const EXPANDED_PREVIEW_HEIGHT = 332;
const EXPANDED_BODY_HEIGHT = EXPANDED_PREVIEW_HEIGHT - PREVIEW_HEIGHT;
const PREVIEW_MEDIA_SIZE = 56;
const PREVIEW_ROW_GAP = 12;
const PREVIEW_MORPH_SPRING = {
  damping: 24,
  stiffness: 220,
  mass: 0.84,
} as const;

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
  const fullSurfaceWidth = Math.max(0, windowWidth - PREVIEW_HORIZONTAL_INSET * 2);
  const pageWidth = useMemo(
    () => Math.max(0, fullSurfaceWidth - mapOverlayTokens.overlayPadding * 2),
    [fullSurfaceWidth]
  );

  const [isMounted, setIsMounted] = useState(visible);
  const [isExpanded, setIsExpanded] = useState(false);
  const sheetExpansionProgress = useSharedValue(0);

  useEffect(() => {
    if (visible && !isMounted) {
      setIsMounted(true);
    }
  }, [visible, isMounted]);

  useEffect(() => {
    if (!visible && isExpanded) {
      setIsExpanded(false);
    }
  }, [isExpanded, visible]);

  useEffect(() => {
    const nextValue = visible && isExpanded ? 1 : 0;
    if (reduceMotionEnabled) {
      sheetExpansionProgress.value = nextValue;
      return;
    }

    sheetExpansionProgress.value = withSpring(nextValue, PREVIEW_MORPH_SPRING);
  }, [isExpanded, reduceMotionEnabled, sheetExpansionProgress, visible]);

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

  const animatedShellStyle = useAnimatedStyle(
    () => ({
      height: PREVIEW_HEIGHT + EXPANDED_BODY_HEIGHT * sheetExpansionProgress.value,
    }),
    [sheetExpansionProgress]
  );

  const animatedExpandedBodyStyle = useAnimatedStyle(
    () => ({
      height: EXPANDED_BODY_HEIGHT * sheetExpansionProgress.value,
      opacity: sheetExpansionProgress.value,
      transform: [{ translateY: (1 - sheetExpansionProgress.value) * 8 }],
    }),
    [sheetExpansionProgress]
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
      allowDismiss={false}
      allowExpand
      isExpanded={isExpanded}
      expansionProgress={sheetExpansionProgress}
      expansionGestureRange={EXPANDED_BODY_HEIGHT}
      onExpand={() => setIsExpanded(true)}
      onCollapse={() => setIsExpanded(false)}
    >
      <View style={[styles.surfaceHost, { width: fullSurfaceWidth }]}>
        <Animated.View style={[styles.inner, animatedShellStyle]}>
          <Animated.View
            style={[
              styles.surface,
              animatedShellStyle,
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

              <View style={mapPreviewFooterStyles.footer}>
                <View style={mapPreviewFooterStyles.metaRow}>
                  <MapPreviewPositionPill
                    current={previewPosition}
                    total={renderPosts.length}
                    testID="map-friends-preview-index"
                  />
                  <MapPreviewExpandButton
                    isExpanded={isExpanded}
                    onPress={() => {
                      onInteraction?.();
                      setIsExpanded((current) => !current);
                    }}
                  />
                </View>

                <Pressable
                  testID="map-friends-preview-open"
                  style={({ pressed }) => [
                    mapPreviewFooterStyles.actionButton,
                    { opacity: pressed ? 0.72 : 1 },
                  ]}
                  onPress={() => {
                    onInteraction?.();
                    onOpen();
                  }}
                >
                  <Ionicons name="arrow-forward-circle" size={14} color={colors.primary} />
                  <Text style={[mapPreviewFooterStyles.actionText, { color: colors.primary }]}>
                    {t('map.openShared', 'Open shared')}
                  </Text>
                </Pressable>
              </View>

              <Animated.View style={[styles.expandedBody, animatedExpandedBodyStyle]} pointerEvents={isExpanded ? 'auto' : 'none'}>
                <View style={[styles.expandedDivider, { backgroundColor: `${colors.border}B8` }]} />
                <View style={styles.expandedHeaderRow}>
                  <Text style={[styles.expandedHeaderTitle, { color: colors.text }]}>
                    {t('shared.viewAllTitle', 'Shared moments')}
                  </Text>
                  <Text style={[styles.expandedHeaderCaption, { color: colors.secondaryText }]}>
                    {t('shared.postsCount', '{{count}} shared', { count: renderPosts.length })}
                  </Text>
                </View>
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.expandedListContent}
                >
                  {renderPosts.map((item) => {
                    const authorLabel = item.authorDisplayName?.trim() || t('shared.someone', 'Someone');
                    const previewText = getPreviewText(
                      item,
                      t('shared.photoMemory', 'Photo memory'),
                      t('map.noContent', 'No note content')
                    );
                    const isActive = item.id === renderPost.id;

                    return (
                      <Pressable
                        key={item.id}
                        testID={`map-friends-preview-expanded-item-${item.id}`}
                        accessibilityRole="button"
                        onPress={() => {
                          onInteraction?.();
                          onFocusPost(item.id);
                        }}
                        style={({ pressed }) => [
                          styles.expandedRow,
                          {
                            backgroundColor: isActive ? colors.primarySoft : 'transparent',
                            borderColor: isActive ? `${colors.primary}2E` : `${colors.border}88`,
                            opacity: pressed ? 0.78 : 1,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.expandedIndexBadge,
                            {
                              backgroundColor: isActive ? colors.primary : `${colors.secondaryText}1A`,
                            },
                          ]}
                        >
                          <Ionicons
                            name="sparkles"
                            size={11}
                            color={isActive ? colors.background : colors.secondaryText}
                          />
                        </View>
                        <View style={styles.expandedCopyWrap}>
                          <Text style={[styles.expandedRowTitle, { color: colors.text }]} numberOfLines={1}>
                            {item.placeName || t('shared.sharedNow', 'Shared now')}
                          </Text>
                          <Text style={[styles.expandedRowText, { color: colors.secondaryText }]} numberOfLines={2}>
                            {previewText}
                          </Text>
                        </View>
                        <View style={styles.expandedMetaWrap}>
                          <Text
                            style={[
                              styles.expandedMetaText,
                              { color: isActive ? colors.primary : colors.secondaryText },
                            ]}
                            numberOfLines={2}
                          >
                            {t('map.friendFrom', 'From {{name}}', { name: authorLabel })}
                          </Text>
                          <Ionicons
                            name={isActive ? 'arrow-forward-circle' : 'chevron-forward'}
                            size={15}
                            color={isActive ? colors.primary : colors.secondaryText}
                          />
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </Animated.View>
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </MapPreviewSheet>
  );
}

const styles = StyleSheet.create({
  surfaceHost: {
    alignSelf: 'center',
  },
  inner: {
    alignSelf: 'center',
    width: '100%',
  },
  surface: {
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
  expandedBody: {
    overflow: 'hidden',
  },
  expandedDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  expandedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  expandedHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  expandedHeaderCaption: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: 'Noto Sans',
  },
  expandedListContent: {
    gap: 8,
    paddingBottom: 4,
  },
  expandedRow: {
    minHeight: 64,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  expandedIndexBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedCopyWrap: {
    flex: 1,
    minWidth: 0,
  },
  expandedRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
    fontFamily: 'Noto Sans',
  },
  expandedRowText: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Noto Sans',
  },
  expandedMetaWrap: {
    alignItems: 'flex-end',
    gap: 4,
    maxWidth: 96,
  },
  expandedMetaText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    textAlign: 'right',
    fontFamily: 'Noto Sans',
  },
});

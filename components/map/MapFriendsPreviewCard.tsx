import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../ui/GlassView';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { SharedPost } from '../../services/sharedFeedService';
import { isOlderIOS } from '../../utils/platform';
import { getOverlayBorderColor, getOverlayFallbackColor, mapOverlayTokens } from './overlayTokens';

const PREVIEW_HORIZONTAL_INSET = 14;

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
  onFocusPost,
  onInteraction,
  reduceMotionEnabled,
}: MapFriendsPreviewCardProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const previewListRef = useRef<FlatList<SharedPost>>(null);
  const previewDraggingRef = useRef(false);
  const pageWidth = useMemo(
    () => Math.max(0, windowWidth - PREVIEW_HORIZONTAL_INSET * 2 - mapOverlayTokens.overlayPadding * 2),
    [windowWidth]
  );

  const activeIndex = useMemo(() => {
    if (posts.length === 0) {
      return -1;
    }

    const index = posts.findIndex((post) => post.id === activePostId);
    return index >= 0 ? index : 0;
  }, [activePostId, posts]);

  const activePost = activeIndex >= 0 ? posts[activeIndex] ?? posts[0] : null;

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

  if (!visible || !activePost) {
    return null;
  }

  const previewCountLabel = `${Math.max(activeIndex, 0) + 1}/${posts.length}`;

  return (
    <View
      testID="map-friends-preview-shell"
      style={[
        styles.wrapper,
        { bottom: bottomOffset },
      ]}
      pointerEvents="auto"
    >
      <View
        style={[
          styles.inner,
          { borderColor: getOverlayBorderColor(isDark) },
        ]}
      >
        <GlassView
          pointerEvents="none"
          glassEffectStyle="regular"
          colorScheme={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFillObject}
        />
        {isOlderIOS ? (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: getOverlayFallbackColor(isDark),
                borderRadius: mapOverlayTokens.overlayRadius,
              },
            ]}
          />
        ) : null}

        <View style={styles.cardContent}>
          <FlatList
            ref={previewListRef}
            testID="map-friends-preview-list"
            horizontal
            data={posts}
            keyExtractor={(item) => item.id}
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
                  accessibilityState={{ selected: item.id === activePost.id }}
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
                      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                        {item.placeName || t('shared.sharedNow', 'Shared now')}
                      </Text>
                      <Text style={[styles.content, { color: colors.secondaryText }]} numberOfLines={1}>
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
            scrollEnabled={posts.length > 1}
            onScrollBeginDrag={() => {
              previewDraggingRef.current = true;
            }}
            onMomentumScrollEnd={handleMomentumEnd}
            onScrollToIndexFailed={() => undefined}
          />

          <View style={styles.footer}>
            <View style={styles.indexWrap}>
              <Text testID="map-friends-preview-index" style={[styles.indexText, { color: colors.secondaryText }]}>
                {previewCountLabel}
              </Text>
            </View>

            <Pressable
              testID="map-friends-preview-open"
              style={[
                styles.actionButton,
                { backgroundColor: `${colors.primary}1F`, borderColor: `${colors.primary}36` },
              ]}
              onPress={() => {
                onInteraction?.();
                onOpen();
              }}
            >
              <Text style={[styles.actionText, { color: colors.primary }]}>
                {t('map.openShared', 'Open shared')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: PREVIEW_HORIZONTAL_INSET,
    right: PREVIEW_HORIZONTAL_INSET,
    zIndex: 12,
  },
  inner: {
    borderWidth: 1,
    borderRadius: mapOverlayTokens.overlayRadius,
    overflow: 'hidden',
    ...mapOverlayTokens.overlayShadow,
  },
  cardContent: {
    paddingHorizontal: mapOverlayTokens.overlayPadding,
    paddingTop: mapOverlayTokens.overlayPadding + 1,
    paddingBottom: mapOverlayTokens.overlayPadding,
  },
  previewList: {
    marginBottom: 6,
  },
  previewListContent: {
    gap: 0,
  },
  previewPage: {
    minHeight: 64,
  },
  previewPageInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: mapOverlayTokens.overlayGap,
    minHeight: 64,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
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
  },
  metaRow: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'System',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 3,
    fontFamily: 'System',
  },
  content: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: 'System',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  indexWrap: {
    minWidth: 34,
  },
  indexText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'System',
  },
  actionButton: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'System',
  },
});

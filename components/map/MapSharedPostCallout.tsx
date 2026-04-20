import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import type { ThemeColors } from '../../hooks/useTheme';
import { getSharedPostPreviewText } from '../../services/noteTextPresentation';
import type { SharedPost } from '../../services/sharedFeedService';

interface MapSharedPostCalloutProps {
  post: SharedPost;
  colors: ThemeColors;
  visible: boolean;
  reduceMotionEnabled: boolean;
  photoUri: string | null;
}

function MapSharedPostCallout({
  post,
  colors,
  visible,
  reduceMotionEnabled,
  photoUri,
}: MapSharedPostCalloutProps) {
  const { t } = useTranslation();
  const visibilityProgress = useSharedValue(visible ? 1 : 0);
  const authorLabel = post.authorDisplayName?.trim() || t('shared.someone', 'Someone');
  const placeLabel = post.placeName?.trim() || t('shared.sharedNow', 'Shared now');
  const previewText = getSharedPostPreviewText(
    post,
    {
      photoLabel: t('shared.photoMemory', 'Photo memory'),
      emptyLabel: t('map.noContent', 'No note content'),
      maxLength: photoUri ? 74 : 96,
    }
  );

  useEffect(() => {
    if (reduceMotionEnabled) {
      visibilityProgress.value = visible ? 1 : 0;
      return;
    }

    visibilityProgress.value = visible
      ? withSpring(1, {
          damping: 20,
          stiffness: 220,
          mass: 0.82,
        })
      : withTiming(0, {
          duration: 180,
        });
  }, [reduceMotionEnabled, visibilityProgress, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: visibilityProgress.value,
    transform: [
      { translateY: interpolate(visibilityProgress.value, [0, 1], [10, 0]) },
      { scale: interpolate(visibilityProgress.value, [0, 1], [0.96, 1]) },
    ],
  }), [visibilityProgress]);

  return (
    <Animated.View
      testID={`shared-post-callout-${post.id}`}
      style={[styles.container, animatedStyle]}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            shadowColor: colors.border,
          },
        ]}
      >
        {photoUri ? (
          <View style={styles.mediaWrap}>
            <Image
              source={{ uri: photoUri }}
              style={styles.media}
              contentFit="cover"
              transition={0}
            />
            <View
              style={[
                styles.avatarBadgeWrap,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.card,
                },
              ]}
            >
              {post.authorPhotoURLSnapshot ? (
                <Image
                  source={{ uri: post.authorPhotoURLSnapshot }}
                  style={styles.avatarBadge}
                  contentFit="cover"
                  transition={0}
                />
              ) : (
                <View style={[styles.avatarBadge, { backgroundColor: colors.primarySoft }]}>
                  <Text style={[styles.avatarInitial, { color: colors.primary }]}>
                    {authorLabel.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </View>
        ) : null}

        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {placeLabel}
          </Text>
          <Text style={[styles.text, { color: colors.secondaryText }]} numberOfLines={photoUri ? 2 : 3}>
            {previewText}
          </Text>
          <Text style={[styles.meta, { color: colors.primary }]} numberOfLines={1}>
            {t('map.friendFrom', 'From {{name}}', { name: authorLabel })}
          </Text>
        </View>

        {!photoUri ? (
          <View
            style={[
              styles.textAvatarWrap,
              {
                backgroundColor: colors.card,
                borderColor: colors.card,
              },
            ]}
          >
            {post.authorPhotoURLSnapshot ? (
              <Image
                source={{ uri: post.authorPhotoURLSnapshot }}
                style={styles.textAvatar}
                contentFit="cover"
                transition={0}
              />
            ) : (
              <View style={[styles.textAvatar, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.avatarInitial, { color: colors.primary }]}>
                  {authorLabel.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </View>

      <View style={styles.pointerWrap}>
        <View
          style={[
            styles.pointer,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

export default memo(MapSharedPostCallout);

const styles = StyleSheet.create({
  container: {
    width: 184,
    alignItems: 'center',
  },
  card: {
    width: 184,
    minHeight: 98,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  mediaWrap: {
    width: '100%',
    height: 124,
  },
  media: {
    width: '100%',
    height: '100%',
  },
  avatarBadgeWrap: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  avatarBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  textAvatarWrap: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  avatarInitial: {
    fontSize: 11,
    lineHeight: 12,
    fontWeight: '800',
    fontFamily: 'Noto Sans',
    textAlign: 'center',
  },
  copy: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 13,
    paddingRight: 52,
  },
  title: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
    marginBottom: 3,
  },
  text: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
    fontFamily: 'Noto Sans',
  },
  meta: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    fontFamily: 'Noto Sans',
    marginTop: 7,
  },
  pointerWrap: {
    marginTop: -7,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointer: {
    width: 14,
    height: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    transform: [{ rotate: '45deg' }],
  },
});

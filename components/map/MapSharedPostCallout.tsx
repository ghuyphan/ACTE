import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import type { ThemeColors } from '../../hooks/useTheme';
import { getSharedPostPreviewText } from '../../services/noteTextPresentation';
import type { SharedPost } from '../../services/sharedFeedService';

interface MapSharedPostCalloutProps {
  post: SharedPost;
  colors: ThemeColors;
  photoUri: string | null;
}

function MapSharedPostCallout({
  post,
  colors,
  photoUri,
}: MapSharedPostCalloutProps) {
  const { t } = useTranslation();
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

  return (
    <View testID={`shared-post-callout-${post.id}`} style={styles.container}>
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
    </View>
  );
}

export default memo(MapSharedPostCallout);

const styles = StyleSheet.create({
  container: {
    width: 196,
    alignItems: 'center',
  },
  card: {
    width: 196,
    minHeight: 104,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },
  mediaWrap: {
    width: '100%',
    height: 120,
  },
  media: {
    width: '100%',
    height: '100%',
  },
  avatarBadgeWrap: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
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
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  textAvatarWrap: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
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
    paddingRight: 50,
  },
  title: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
    marginBottom: 3,
  },
  text: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    fontFamily: 'Noto Sans',
  },
  meta: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
    marginTop: 8,
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

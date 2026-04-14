import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Layout } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { getSharedPostPreviewText } from '../../services/noteTextPresentation';
import { SharedPost } from '../../services/sharedFeedService';
import { SHARED_POST_MEDIA_BUCKET } from '../../services/remoteMedia';
import ImageMemoryCard from '../notes/ImageMemoryCard';
import type { DebugTiltState } from '../notes/StickerPhysicsDebugControls';
import TextMemoryCard from '../notes/TextMemoryCard';
import type { SharedValue } from 'react-native-reanimated';

export default function SharedPostCardVisual({
  post,
  fallbackText,
  isActive = false,
  debugTiltOverride,
}: {
  post: SharedPost;
  fallbackText: string;
  isActive?: boolean;
  debugTiltOverride?: SharedValue<DebugTiltState>;
}) {
  const { colors } = useTheme();
  const previewText = getSharedPostPreviewText(post, {
    photoLabel: fallbackText,
    emptyLabel: fallbackText,
  });
  const shouldShowFallbackText =
    previewText === fallbackText &&
    !post.doodleStrokesJson &&
    !post.stickerPlacementsJson &&
    !post.hasStickers;
  const photoUri = post.type === 'photo' ? post.photoLocalUri ?? null : null;
  const pairedVideoUri = post.type === 'photo' ? post.pairedVideoLocalUri ?? null : null;

  if (post.type === 'photo') {
    if (photoUri) {
      return (
        <ImageMemoryCard
          imageUrl={photoUri}
          caption={post.text}
          isLivePhoto={post.isLivePhoto}
          pairedVideoUri={pairedVideoUri}
          showLiveBadge={false}
          enablePlayback={isActive}
          autoPreviewOnceOnEnable={isActive}
          doodleStrokesJson={post.doodleStrokesJson}
          stickerPlacementsJson={post.stickerPlacementsJson}
          remoteBucket={SHARED_POST_MEDIA_BUCKET}
          isActive={isActive}
          debugTiltOverride={debugTiltOverride}
        />
      );
    }

    return (
      <View
        testID="shared-post-photo-placeholder"
        style={[
          styles.photoPlaceholder,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.photoPlaceholderBadge,
            { backgroundColor: colors.primarySoft },
          ]}
        >
          <Ionicons name="image-outline" size={22} color={colors.primary} />
        </View>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <TextMemoryCard
      text={shouldShowFallbackText ? fallbackText : previewText}
      noteId={post.id}
      noteColor={post.noteColor}
      doodleStrokesJson={post.doodleStrokesJson}
      stickerPlacementsJson={post.stickerPlacementsJson}
      remoteBucket={SHARED_POST_MEDIA_BUCKET}
      isActive={isActive}
      debugTiltOverride={debugTiltOverride}
    />
  );
}

const styles = StyleSheet.create({
  photoPlaceholder: {
    flex: 1,
    borderRadius: Layout.cardRadius,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  photoPlaceholderBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

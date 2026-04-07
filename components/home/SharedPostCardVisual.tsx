import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Layout } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { SharedPost } from '../../services/sharedFeedService';
import {
  downloadPairedVideoFromStorage,
  downloadPhotoFromStorage,
  SHARED_POST_MEDIA_BUCKET,
} from '../../services/remoteMedia';
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
  const normalizedText = post.text.trim();
  const shouldShowFallbackText =
    normalizedText.length === 0 &&
    !post.doodleStrokesJson &&
    !post.stickerPlacementsJson &&
    !post.hasStickers;
  
  const [photoUri, setPhotoUri] = useState<string | null>(
    post.type === 'photo' ? post.photoLocalUri ?? null : null
  );
  const [pairedVideoUri, setPairedVideoUri] = useState<string | null>(
    post.type === 'photo' ? post.pairedVideoLocalUri ?? null : null
  );

  useEffect(() => {
    if (post.type !== 'photo') {
      setPhotoUri(null);
      setPairedVideoUri(null);
      return;
    }

    setPhotoUri(post.photoLocalUri ?? null);
    setPairedVideoUri(post.pairedVideoLocalUri ?? null);
  }, [post]);

  useEffect(() => {
    let active = true;

    if (post.type !== 'photo' || photoUri || !post.photoPath) {
      return;
    }

    downloadPhotoFromStorage(SHARED_POST_MEDIA_BUCKET, post.photoPath, post.id)
      .then((downloadedUri) => {
        if (active && downloadedUri) {
          setPhotoUri(downloadedUri);
        }
      })
      .catch(() => {
        // Fallback or ignore for now, activity indicator remains
      });

    return () => {
      active = false;
    };
  }, [post.id, post.type, post.photoPath, photoUri]);

  useEffect(() => {
    let active = true;

    if (
      post.type !== 'photo' ||
      !post.isLivePhoto ||
      pairedVideoUri ||
      !post.pairedVideoPath
    ) {
      return;
    }

    downloadPairedVideoFromStorage(
      SHARED_POST_MEDIA_BUCKET,
      post.pairedVideoPath,
      `${post.id}-motion`
    )
      .then((downloadedUri) => {
        if (active && downloadedUri) {
          setPairedVideoUri(downloadedUri);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [pairedVideoUri, post.id, post.isLivePhoto, post.pairedVideoPath, post.type]);

  if (post.type === 'photo') {
    if (photoUri) {
      return (
        <ImageMemoryCard
          imageUrl={photoUri}
          caption={post.text}
          isLivePhoto={post.isLivePhoto}
          pairedVideoUri={pairedVideoUri}
          showLiveBadge={false}
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
      text={shouldShowFallbackText ? fallbackText : post.text}
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

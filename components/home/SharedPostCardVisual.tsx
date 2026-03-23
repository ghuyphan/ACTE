import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Layout } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { SharedPost } from '../../services/sharedFeedService';
import { downloadPhotoFromStorage, SHARED_POST_MEDIA_BUCKET } from '../../services/remoteMedia';
import ImageMemoryCard from '../ImageMemoryCard';
import TextMemoryCard from '../TextMemoryCard';

export default function SharedPostCardVisual({
  post,
  fallbackText,
}: {
  post: SharedPost;
  fallbackText: string;
}) {
  const { colors } = useTheme();
  
  const [photoUri, setPhotoUri] = useState<string | null>(
    post.type === 'photo' ? post.photoLocalUri ?? null : null
  );

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

  if (post.type === 'photo') {
    if (photoUri) {
      return <ImageMemoryCard imageUrl={photoUri} doodleStrokesJson={post.doodleStrokesJson} />;
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

  return <TextMemoryCard text={post.text || fallbackText} noteId={post.id} doodleStrokesJson={post.doodleStrokesJson} />;
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

import { useEffect, useState } from 'react';
import ImageMemoryCard from '../ImageMemoryCard';
import TextMemoryCard from '../TextMemoryCard';
import { SharedPost } from '../../services/sharedFeedService';
import { downloadPhotoFromStorage, SHARED_POST_MEDIA_BUCKET } from '../../services/remoteMedia';

export default function SharedPostCardVisual({
  post,
  fallbackText,
}: {
  post: SharedPost;
  fallbackText: string;
}) {
  const [photoUri, setPhotoUri] = useState(post.photoLocalUri);

  useEffect(() => {
    setPhotoUri(post.photoLocalUri ?? null);
  }, [post.photoLocalUri]);

  useEffect(() => {
    if (post.type !== 'photo' || photoUri || !post.photoPath) {
      return;
    }

    let cancelled = false;

    void downloadPhotoFromStorage(
      SHARED_POST_MEDIA_BUCKET,
      post.photoPath,
      `shared-post-${post.id}`
    )
      .then((nextUri) => {
        if (!cancelled && nextUri) {
          setPhotoUri(nextUri);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('[shared-post] Failed to hydrate photo:', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [photoUri, post.id, post.photoPath, post.type]);

  if (post.type === 'photo' && photoUri) {
    return <ImageMemoryCard imageUrl={photoUri} doodleStrokesJson={post.doodleStrokesJson} />;
  }

  return <TextMemoryCard text={post.text || fallbackText} noteId={post.id} doodleStrokesJson={post.doodleStrokesJson} />;
}

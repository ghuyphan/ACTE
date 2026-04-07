import { useEffect, useMemo, useRef, useState } from 'react';
import { SharedPost } from '../../../services/sharedFeedService';
import {
  downloadPhotoFromStorage,
  SHARED_POST_MEDIA_BUCKET,
} from '../../../services/remoteMedia';

const SHARED_GRID_PHOTO_PREFETCH_LIMIT = 6;
const SHARED_GRID_PHOTO_HYDRATION_CONCURRENCY = 2;
const sharedGridPhotoUriCache = new Map<string, string>();

type SharedGridPhotoEntry = {
  cacheKey: string;
  uri: string | null;
};

function normalizePath(path: string | null | undefined) {
  const normalizedPath = typeof path === 'string' ? path.trim() : '';
  return normalizedPath || null;
}

function getSharedGridPhotoCacheKey(post: Pick<SharedPost, 'id' | 'photoPath'>) {
  const photoPath = normalizePath(post.photoPath);
  if (!photoPath) {
    return null;
  }

  return `${SHARED_POST_MEDIA_BUCKET}::${post.id}::${photoPath}`;
}

function dedupeSharedPostsById(sharedPosts: SharedPost[]) {
  const next = new Map<string, SharedPost>();
  for (const post of sharedPosts) {
    if (!next.has(post.id)) {
      next.set(post.id, post);
    }
  }

  return Array.from(next.values());
}

function getCandidateSharedPhotoPosts(
  sharedPhotoPosts: SharedPost[],
  visibleSharedPhotoIds: readonly string[]
) {
  const prioritizedSet = new Set(visibleSharedPhotoIds);
  const prioritizedPosts = sharedPhotoPosts.filter((post) => prioritizedSet.has(post.id));
  const fallbackPosts =
    prioritizedPosts.length > 0 ? [] : sharedPhotoPosts.slice(0, SHARED_GRID_PHOTO_PREFETCH_LIMIT);

  return dedupeSharedPostsById([...prioritizedPosts, ...fallbackPosts]);
}

async function hydrateSharedGridPhoto(post: SharedPost) {
  const cacheKey = getSharedGridPhotoCacheKey(post);
  if (!cacheKey) {
    return null;
  }

  const cachedUri = sharedGridPhotoUriCache.get(cacheKey) ?? null;
  if (cachedUri) {
    return cachedUri;
  }

  try {
    const downloadedUri = await downloadPhotoFromStorage(
      SHARED_POST_MEDIA_BUCKET,
      post.photoPath,
      post.id
    );

    if (downloadedUri) {
      sharedGridPhotoUriCache.set(cacheKey, downloadedUri);
    }

    return downloadedUri;
  } catch (error) {
    console.warn('[notes-grid] Failed to hydrate shared photo:', error);
    return null;
  }
}

export function useNotesGridSharedPhotoHydration(
  sharedPhotoPosts: SharedPost[],
  visibleSharedPhotoIds: readonly string[] = []
) {
  const [sharedPhotoEntriesById, setSharedPhotoEntriesById] = useState<
    Record<string, SharedGridPhotoEntry>
  >({});
  const sharedPhotoEntriesRef = useRef(sharedPhotoEntriesById);

  useEffect(() => {
    sharedPhotoEntriesRef.current = sharedPhotoEntriesById;
  }, [sharedPhotoEntriesById]);

  const candidateSharedPhotoPosts = useMemo(
    () => getCandidateSharedPhotoPosts(sharedPhotoPosts, visibleSharedPhotoIds),
    [sharedPhotoPosts, visibleSharedPhotoIds]
  );

  useEffect(() => {
    if (candidateSharedPhotoPosts.length === 0) {
      return;
    }

    let cancelled = false;
    const pendingPosts: SharedPost[] = [];
    const currentEntries = sharedPhotoEntriesRef.current;
    const nextEntries = { ...currentEntries };
    let didChange = false;

    for (const post of candidateSharedPhotoPosts) {
      const cacheKey = getSharedGridPhotoCacheKey(post);
      const localUri = normalizePath(post.photoLocalUri);
      const cachedUri = cacheKey ? sharedGridPhotoUriCache.get(cacheKey) ?? null : null;
      const nextUri = localUri ?? cachedUri;
      const currentEntry = currentEntries[post.id];

      if (!cacheKey || !nextUri) {
        pendingPosts.push(post);
      }

      if (
        !currentEntry ||
        currentEntry.cacheKey !== cacheKey ||
        currentEntry.uri !== nextUri
      ) {
        nextEntries[post.id] = {
          cacheKey: cacheKey ?? '',
          uri: nextUri,
        };
        didChange = true;
      }
    }

    if (didChange) {
      setSharedPhotoEntriesById(nextEntries);
    }

    if (pendingPosts.length === 0) {
      return undefined;
    }

    const queue = pendingPosts.slice();
    const workerCount = Math.min(SHARED_GRID_PHOTO_HYDRATION_CONCURRENCY, queue.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (!cancelled) {
        const nextPost = queue.shift();
        if (!nextPost) {
          return;
        }

        const nextUri = await hydrateSharedGridPhoto(nextPost);
        if (cancelled || !nextUri) {
          continue;
        }

        const cacheKey = getSharedGridPhotoCacheKey(nextPost);
        if (!cacheKey) {
          continue;
        }

        setSharedPhotoEntriesById((current) => {
          const currentEntry = current[nextPost.id];
          if (currentEntry?.cacheKey === cacheKey && currentEntry.uri === nextUri) {
            return current;
          }

          return {
            ...current,
            [nextPost.id]: {
              cacheKey,
              uri: nextUri,
            },
          };
        });
      }
    });

    void Promise.all(workers).catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [candidateSharedPhotoPosts]);

  return useMemo(
    () =>
      Object.fromEntries(
        Object.entries(sharedPhotoEntriesById).map(([id, entry]) => [id, entry.uri] as const)
      ) as Record<string, string | null>,
    [sharedPhotoEntriesById]
  );
}

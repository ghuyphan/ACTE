import { useCallback, useMemo } from 'react';
import type { Note } from '../../services/database';
import type { SharedPost } from '../../services/sharedFeedService';
import {
  buildHomeFeedItems,
  findHomeFeedItemIndex,
  type HomeFeedItem,
} from '../../components/home/feedItems';

interface UseHomeFeedPaginationOptions {
  notesScope: string;
  sharedCacheUserUid?: string | null;
  notesSignal: Note[];
  sharedSignal: SharedPost[];
}

interface UseHomeFeedPaginationResult {
  items: HomeFeedItem[];
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  loadNextPage: () => Promise<HomeFeedItem[]>;
  ensureTargetLoaded: (target: Pick<HomeFeedItem, 'id' | 'kind'>) => Promise<number>;
}

export function useHomeFeedPagination({
  notesScope: _notesScope,
  sharedCacheUserUid,
  notesSignal,
  sharedSignal,
}: UseHomeFeedPaginationOptions): UseHomeFeedPaginationResult {
  const visibleSharedPosts = useMemo(
    () =>
      sharedSignal.filter((post) =>
        sharedCacheUserUid ? post.authorUid !== sharedCacheUserUid : true
      ),
    [sharedCacheUserUid, sharedSignal]
  );

  const items = useMemo(
    () => buildHomeFeedItems(notesSignal, visibleSharedPosts),
    [notesSignal, visibleSharedPosts]
  );

  const loadNextPage = useCallback(async () => items, [items]);

  const ensureTargetLoaded = useCallback(
    async (target: Pick<HomeFeedItem, 'id' | 'kind'>) => findHomeFeedItemIndex(items, target),
    [items]
  );

  return {
    items,
    hasMore: false,
    isLoading: false,
    isLoadingMore: false,
    loadNextPage,
    ensureTargetLoaded,
  };
}

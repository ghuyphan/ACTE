import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getNotesPageForScope, type Note } from '../../services/database';
import { getCachedSharedPostsPage } from '../../services/sharedFeedCache';
import type { SharedPost } from '../../services/sharedFeedService';
import {
  buildHomeFeedItems,
  findHomeFeedItemIndex,
  type HomeFeedItem,
} from '../../components/home/feedItems';

const HOME_FEED_PAGE_SIZE = 24;

interface FeedWindow {
  notes: number;
  sharedPosts: number;
}

interface HomeFeedSnapshot {
  notes: Note[];
  sharedPosts: SharedPost[];
  hasMoreNotes: boolean;
  hasMoreSharedPosts: boolean;
}

interface UseHomeFeedPaginationOptions {
  notesScope: string;
  sharedCacheUserUid?: string | null;
  notesSignal: unknown;
  sharedSignal: unknown;
}

interface UseHomeFeedPaginationResult {
  items: HomeFeedItem[];
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  loadNextPage: () => Promise<HomeFeedItem[]>;
  ensureTargetLoaded: (target: Pick<HomeFeedItem, 'id' | 'kind'>) => Promise<number>;
}

function buildInitialWindow(sharedCacheUserUid?: string | null): FeedWindow {
  return {
    notes: HOME_FEED_PAGE_SIZE,
    sharedPosts: sharedCacheUserUid ? HOME_FEED_PAGE_SIZE : 0,
  };
}

export function useHomeFeedPagination({
  notesScope,
  sharedCacheUserUid,
  notesSignal,
  sharedSignal,
}: UseHomeFeedPaginationOptions): UseHomeFeedPaginationResult {
  const isMountedRef = useRef(true);
  const previousSourceKeyRef = useRef<string | null>(null);
  const requestedWindowRef = useRef<FeedWindow>(buildInitialWindow(sharedCacheUserUid));
  const loadSequenceRef = useRef(0);
  const snapshotRef = useRef<HomeFeedSnapshot>({
    notes: [],
    sharedPosts: [],
    hasMoreNotes: true,
    hasMoreSharedPosts: Boolean(sharedCacheUserUid),
  });
  const loadChainRef = useRef<Promise<HomeFeedSnapshot>>(
    Promise.resolve({
      notes: [],
      sharedPosts: [],
      hasMoreNotes: true,
      hasMoreSharedPosts: Boolean(sharedCacheUserUid),
    })
  );
  const itemsRef = useRef<HomeFeedItem[]>([]);
  const hasMoreRef = useRef({
    notes: true,
    sharedPosts: Boolean(sharedCacheUserUid),
  });
  const [loadedNotes, setLoadedNotes] = useState<Note[]>([]);
  const [loadedSharedPosts, setLoadedSharedPosts] = useState<SharedPost[]>([]);
  const [hasMoreNotes, setHasMoreNotes] = useState(true);
  const [hasMoreSharedPosts, setHasMoreSharedPosts] = useState(Boolean(sharedCacheUserUid));
  const [isLoading, setIsLoading] = useState(true);
  const [hasResolvedInitialWindow, setHasResolvedInitialWindow] = useState(false);

  const items = useMemo(
    () => buildHomeFeedItems(loadedNotes, loadedSharedPosts),
    [loadedNotes, loadedSharedPosts]
  );

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    hasMoreRef.current = {
      notes: hasMoreNotes,
      sharedPosts: hasMoreSharedPosts,
    };
  }, [hasMoreNotes, hasMoreSharedPosts]);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    []
  );

  const fetchWindow = useCallback(
    async (window: FeedWindow): Promise<HomeFeedSnapshot> => {
      const [notesRows, sharedRows] = await Promise.all([
        getNotesPageForScope(notesScope, {
          limit: window.notes + 1,
        }),
        sharedCacheUserUid
          ? getCachedSharedPostsPage(sharedCacheUserUid, {
              limit: window.sharedPosts + 1,
              excludeAuthorUid: sharedCacheUserUid,
            })
          : Promise.resolve<SharedPost[]>([]),
      ]);

      return {
        notes: notesRows.slice(0, window.notes),
        sharedPosts: sharedRows.slice(0, window.sharedPosts),
        hasMoreNotes: notesRows.length > window.notes,
        hasMoreSharedPosts: sharedRows.length > window.sharedPosts,
      };
    },
    [notesScope, sharedCacheUserUid]
  );

  const commitSnapshot = useCallback((snapshot: HomeFeedSnapshot) => {
    const nextItems = buildHomeFeedItems(snapshot.notes, snapshot.sharedPosts);
    snapshotRef.current = snapshot;
    itemsRef.current = nextItems;
    hasMoreRef.current = {
      notes: snapshot.hasMoreNotes,
      sharedPosts: snapshot.hasMoreSharedPosts,
    };
    setLoadedNotes(snapshot.notes);
    setLoadedSharedPosts(snapshot.sharedPosts);
    setHasMoreNotes(snapshot.hasMoreNotes);
    setHasMoreSharedPosts(snapshot.hasMoreSharedPosts);
    setIsLoading(false);
    setHasResolvedInitialWindow(true);
  }, []);

  const runLoad = useCallback(
    (nextWindow: FeedWindow, options?: { resetVisibleItems?: boolean }) => {
      requestedWindowRef.current = nextWindow;
      const loadId = ++loadSequenceRef.current;

      if (isMountedRef.current) {
        setIsLoading(true);
        if (options?.resetVisibleItems) {
          itemsRef.current = [];
          snapshotRef.current = {
            notes: [],
            sharedPosts: [],
            hasMoreNotes: true,
            hasMoreSharedPosts: Boolean(sharedCacheUserUid),
          };
          setLoadedNotes([]);
          setLoadedSharedPosts([]);
          setHasMoreNotes(true);
          setHasMoreSharedPosts(Boolean(sharedCacheUserUid));
          setHasResolvedInitialWindow(false);
        }
      }

      const nextLoad = loadChainRef.current
        .catch(() => snapshotRef.current)
        .then(async () => {
          const snapshot = await fetchWindow(nextWindow);
          if (!isMountedRef.current || loadId !== loadSequenceRef.current) {
            return snapshot;
          }

          commitSnapshot(snapshot);
          return snapshot;
        })
        .catch((error) => {
          if (loadId === loadSequenceRef.current && isMountedRef.current) {
            console.warn('Failed to load Home feed page:', error);
            setIsLoading(false);
            setHasResolvedInitialWindow(true);
          }

          return {
            ...snapshotRef.current,
          };
        });

      loadChainRef.current = nextLoad;
      return nextLoad.then((snapshot) => buildHomeFeedItems(snapshot.notes, snapshot.sharedPosts));
    },
    [commitSnapshot, fetchWindow, sharedCacheUserUid]
  );

  useEffect(() => {
    const sourceKey = `${notesScope}:${sharedCacheUserUid ?? 'none'}`;
    const sourceChanged = previousSourceKeyRef.current !== sourceKey;
    previousSourceKeyRef.current = sourceKey;

    const nextWindow = sourceChanged
      ? buildInitialWindow(sharedCacheUserUid)
      : {
          notes: Math.max(requestedWindowRef.current.notes, HOME_FEED_PAGE_SIZE),
          sharedPosts: sharedCacheUserUid
            ? Math.max(requestedWindowRef.current.sharedPosts, HOME_FEED_PAGE_SIZE)
            : 0,
        };

    void runLoad(nextWindow, {
      resetVisibleItems: sourceChanged,
    });
  }, [notesScope, notesSignal, runLoad, sharedCacheUserUid, sharedSignal]);

  const loadNextPage = useCallback(async () => {
    const currentWindow = requestedWindowRef.current;
    const nextWindow: FeedWindow = {
      notes: hasMoreRef.current.notes ? currentWindow.notes + HOME_FEED_PAGE_SIZE : currentWindow.notes,
      sharedPosts: hasMoreRef.current.sharedPosts
        ? currentWindow.sharedPosts + HOME_FEED_PAGE_SIZE
        : currentWindow.sharedPosts,
    };

    if (
      nextWindow.notes === currentWindow.notes &&
      nextWindow.sharedPosts === currentWindow.sharedPosts
    ) {
      return itemsRef.current;
    }

    return runLoad(nextWindow);
  }, [runLoad]);

  const ensureTargetLoaded = useCallback(
    async (target: Pick<HomeFeedItem, 'id' | 'kind'>) => {
      let targetIndex = findHomeFeedItemIndex(itemsRef.current, target);
      if (targetIndex >= 0) {
        return targetIndex;
      }

      while (target.kind === 'note' ? hasMoreRef.current.notes : hasMoreRef.current.sharedPosts) {
        const currentWindow = requestedWindowRef.current;
        const nextWindow: FeedWindow = {
          notes:
            target.kind === 'note' && hasMoreRef.current.notes
              ? currentWindow.notes + HOME_FEED_PAGE_SIZE
              : currentWindow.notes,
          sharedPosts:
            target.kind === 'shared-post' && hasMoreRef.current.sharedPosts
              ? currentWindow.sharedPosts + HOME_FEED_PAGE_SIZE
              : currentWindow.sharedPosts,
        };

        if (
          nextWindow.notes === currentWindow.notes &&
          nextWindow.sharedPosts === currentWindow.sharedPosts
        ) {
          break;
        }

        const nextItems = await runLoad(nextWindow);
        targetIndex = findHomeFeedItemIndex(nextItems, target);
        if (targetIndex >= 0) {
          return targetIndex;
        }
      }

      return -1;
    },
    [runLoad]
  );

  return {
    items,
    hasMore: hasMoreNotes || hasMoreSharedPosts,
    isLoading: isLoading && !hasResolvedInitialWindow,
    isLoadingMore: isLoading && hasResolvedInitialWindow,
    loadNextPage,
    ensureTargetLoaded,
  };
}

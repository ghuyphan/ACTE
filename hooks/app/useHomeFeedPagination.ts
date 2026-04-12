import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Note } from '../../services/database';
import type { SharedPost } from '../../services/sharedFeedService';
import {
  buildHomeFeedItems,
  findHomeFeedItemIndex,
  type HomeFeedItem,
} from '../../components/home/feedItems';

const HOME_FEED_PAGE_SIZE = 24;
const EMPTY_NOTES: Note[] = [];
const EMPTY_SHARED_POSTS: SharedPost[] = [];

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
  seedNotes?: Note[];
  seedNoteCount?: number;
  notesLoading?: boolean;
  loadNextNotesPage?: () => Promise<Note[]>;
  seedSharedPosts?: SharedPost[];
  sharedLoading?: boolean;
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

function buildSnapshot(
  window: FeedWindow,
  options: {
    notes: Note[];
    noteCount: number;
    friendSharedPosts: SharedPost[];
  }
): HomeFeedSnapshot {
  const visibleNotes = options.notes.slice(0, window.notes);
  const visibleSharedPosts = options.friendSharedPosts.slice(0, window.sharedPosts);

  return {
    notes: visibleNotes,
    sharedPosts: visibleSharedPosts,
    hasMoreNotes: options.noteCount > visibleNotes.length,
    hasMoreSharedPosts: options.friendSharedPosts.length > visibleSharedPosts.length,
  };
}

export function useHomeFeedPagination({
  notesScope,
  sharedCacheUserUid,
  seedNotes = EMPTY_NOTES,
  seedNoteCount = 0,
  notesLoading = false,
  loadNextNotesPage,
  seedSharedPosts = EMPTY_SHARED_POSTS,
  sharedLoading = false,
  notesSignal: _notesSignal,
  sharedSignal: _sharedSignal,
}: UseHomeFeedPaginationOptions): UseHomeFeedPaginationResult {
  const sourceKey = `${notesScope}:${sharedCacheUserUid ?? 'none'}`;
  const initialWindow = useMemo(
    () => buildInitialWindow(sharedCacheUserUid),
    [sharedCacheUserUid]
  );
  const friendSharedPosts = useMemo(
    () =>
      sharedCacheUserUid
        ? seedSharedPosts.filter((post) => post.authorUid !== sharedCacheUserUid)
        : [],
    [seedSharedPosts, sharedCacheUserUid]
  );
  const [requestedWindow, setRequestedWindow] = useState<FeedWindow>(initialWindow);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const isMountedRef = useRef(true);
  const previousSourceKeyRef = useRef(sourceKey);
  const requestedWindowRef = useRef(requestedWindow);

  useEffect(() => {
    requestedWindowRef.current = requestedWindow;
  }, [requestedWindow]);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  useEffect(() => {
    if (previousSourceKeyRef.current === sourceKey) {
      return;
    }

    previousSourceKeyRef.current = sourceKey;
    setRequestedWindow(buildInitialWindow(sharedCacheUserUid));
    setIsLoadingMore(false);
  }, [sharedCacheUserUid, sourceKey]);

  const buildSnapshotForWindow = useCallback((
    window: FeedWindow,
    notesOverride?: Note[]
  ) => buildSnapshot(window, {
    notes: notesOverride ?? seedNotes,
    noteCount: seedNoteCount,
    friendSharedPosts,
  }), [friendSharedPosts, seedNoteCount, seedNotes]);

  const snapshot = useMemo(
    () => buildSnapshotForWindow(requestedWindow),
    [buildSnapshotForWindow, requestedWindow]
  );
  const items = useMemo(
    () => buildHomeFeedItems(snapshot.notes, snapshot.sharedPosts),
    [snapshot.notes, snapshot.sharedPosts]
  );
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const isWaitingForInitialData =
    (notesLoading && seedNotes.length === 0) ||
    Boolean(sharedCacheUserUid && sharedLoading && seedSharedPosts.length === 0);

  const expandWindow = useCallback(async (nextWindow: FeedWindow): Promise<HomeFeedSnapshot> => {
    requestedWindowRef.current = nextWindow;
    setRequestedWindow((current) => (
      current.notes === nextWindow.notes && current.sharedPosts === nextWindow.sharedPosts
        ? current
        : nextWindow
    ));

    let nextNotes = seedNotes;
    if (nextWindow.notes > nextNotes.length && seedNoteCount > nextNotes.length && loadNextNotesPage) {
      setIsLoadingMore(true);
      try {
        while (nextWindow.notes > nextNotes.length && seedNoteCount > nextNotes.length) {
          const previousLength = nextNotes.length;
          nextNotes = await loadNextNotesPage();
          if (nextNotes.length <= previousLength) {
            break;
          }
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoadingMore(false);
        }
      }
    }

    return buildSnapshotForWindow(nextWindow, nextNotes);
  }, [buildSnapshotForWindow, loadNextNotesPage, seedNoteCount, seedNotes]);

  const loadNextPage = useCallback(async () => {
    const currentWindow = requestedWindowRef.current;
    const currentSnapshot = buildSnapshotForWindow(currentWindow);
    const nextWindow: FeedWindow = {
      notes: currentSnapshot.hasMoreNotes && loadNextNotesPage
        ? currentWindow.notes + HOME_FEED_PAGE_SIZE
        : currentWindow.notes,
      sharedPosts: currentSnapshot.hasMoreSharedPosts
        ? currentWindow.sharedPosts + HOME_FEED_PAGE_SIZE
        : currentWindow.sharedPosts,
    };

    if (
      nextWindow.notes === currentWindow.notes &&
      nextWindow.sharedPosts === currentWindow.sharedPosts
    ) {
      return itemsRef.current;
    }

    const nextSnapshot = await expandWindow(nextWindow);
    return buildHomeFeedItems(nextSnapshot.notes, nextSnapshot.sharedPosts);
  }, [buildSnapshotForWindow, expandWindow, loadNextNotesPage]);

  const ensureTargetLoaded = useCallback(async (target: Pick<HomeFeedItem, 'id' | 'kind'>) => {
    let currentWindow = requestedWindowRef.current;
    let currentSnapshot = buildSnapshotForWindow(currentWindow);
    let currentItems = buildHomeFeedItems(currentSnapshot.notes, currentSnapshot.sharedPosts);
    let targetIndex = findHomeFeedItemIndex(currentItems, target);
    if (targetIndex >= 0) {
      return targetIndex;
    }

    while (target.kind === 'note' ? currentSnapshot.hasMoreNotes : currentSnapshot.hasMoreSharedPosts) {
      const nextWindow: FeedWindow = {
        notes:
          target.kind === 'note' && currentSnapshot.hasMoreNotes && loadNextNotesPage
            ? currentWindow.notes + HOME_FEED_PAGE_SIZE
            : currentWindow.notes,
        sharedPosts:
          target.kind === 'shared-post' && currentSnapshot.hasMoreSharedPosts
            ? currentWindow.sharedPosts + HOME_FEED_PAGE_SIZE
            : currentWindow.sharedPosts,
      };

      if (
        nextWindow.notes === currentWindow.notes &&
        nextWindow.sharedPosts === currentWindow.sharedPosts
      ) {
        break;
      }

      currentSnapshot = await expandWindow(nextWindow);
      currentWindow = nextWindow;
      currentItems = buildHomeFeedItems(currentSnapshot.notes, currentSnapshot.sharedPosts);
      targetIndex = findHomeFeedItemIndex(currentItems, target);
      if (targetIndex >= 0) {
        return targetIndex;
      }
    }

    return -1;
  }, [buildSnapshotForWindow, expandWindow, loadNextNotesPage]);

  return {
    items,
    hasMore: snapshot.hasMoreNotes || snapshot.hasMoreSharedPosts,
    isLoading: isWaitingForInitialData,
    isLoadingMore,
    loadNextPage,
    ensureTargetLoaded,
  };
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getNotesPageForScope, type Note } from '../../services/database';
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

function buildSeededSnapshot(
  window: FeedWindow,
  options: {
    seedNotes: Note[];
    seedNoteCount: number;
    seededFriendSharedPosts: SharedPost[];
  }
): HomeFeedSnapshot {
  const notes = options.seedNotes.slice(0, window.notes);
  const sharedPosts = options.seededFriendSharedPosts.slice(0, window.sharedPosts);

  return {
    notes,
    sharedPosts,
    hasMoreNotes: options.seedNoteCount > notes.length,
    hasMoreSharedPosts: options.seededFriendSharedPosts.length > sharedPosts.length,
  };
}

function snapshotsEqual(left: HomeFeedSnapshot, right: HomeFeedSnapshot) {
  if (
    left.hasMoreNotes !== right.hasMoreNotes ||
    left.hasMoreSharedPosts !== right.hasMoreSharedPosts ||
    left.notes.length !== right.notes.length ||
    left.sharedPosts.length !== right.sharedPosts.length
  ) {
    return false;
  }

  for (let index = 0; index < left.notes.length; index += 1) {
    const leftNote = left.notes[index];
    const rightNote = right.notes[index];
    if (!rightNote) {
      return false;
    }

    if (
      leftNote.id !== rightNote.id ||
      leftNote.updatedAt !== rightNote.updatedAt ||
      leftNote.createdAt !== rightNote.createdAt ||
      leftNote.content !== rightNote.content ||
      leftNote.caption !== rightNote.caption ||
      leftNote.isFavorite !== rightNote.isFavorite
    ) {
      return false;
    }
  }

  for (let index = 0; index < left.sharedPosts.length; index += 1) {
    const leftPost = left.sharedPosts[index];
    const rightPost = right.sharedPosts[index];
    if (!rightPost) {
      return false;
    }

    if (
      leftPost.id !== rightPost.id ||
      leftPost.updatedAt !== rightPost.updatedAt ||
      leftPost.createdAt !== rightPost.createdAt ||
      leftPost.text !== rightPost.text ||
      leftPost.placeName !== rightPost.placeName
    ) {
      return false;
    }
  }

  return true;
}

export function useHomeFeedPagination({
  notesScope,
  sharedCacheUserUid,
  seedNotes = EMPTY_NOTES,
  seedNoteCount = 0,
  notesLoading = false,
  seedSharedPosts = EMPTY_SHARED_POSTS,
  sharedLoading = false,
  notesSignal,
  sharedSignal,
}: UseHomeFeedPaginationOptions): UseHomeFeedPaginationResult {
  const sourceKey = `${notesScope}:${sharedCacheUserUid ?? 'none'}`;
  const initialWindow = buildInitialWindow(sharedCacheUserUid);
  const seededFriendSharedPosts = useMemo(
    () =>
      sharedCacheUserUid
        ? seedSharedPosts.filter((post) => post.authorUid !== sharedCacheUserUid)
        : [],
    [seedSharedPosts, sharedCacheUserUid]
  );
  const initialSeededSnapshot = useMemo(
    () =>
      buildSeededSnapshot(initialWindow, {
        seedNotes,
        seedNoteCount,
        seededFriendSharedPosts,
      }),
    [initialWindow.notes, initialWindow.sharedPosts, seedNoteCount, seedNotes, seededFriendSharedPosts]
  );
  const isWaitingForInitialData =
    (notesLoading && seedNotes.length === 0) ||
    Boolean(sharedCacheUserUid && sharedLoading && seedSharedPosts.length === 0);
  const isMountedRef = useRef(true);
  const previousSourceKeyRef = useRef<string | null>(sourceKey);
  const requestedWindowRef = useRef<FeedWindow>(initialWindow);
  const loadSequenceRef = useRef(0);
  const snapshotRef = useRef<HomeFeedSnapshot>(initialSeededSnapshot);
  const loadChainRef = useRef<Promise<HomeFeedSnapshot>>(Promise.resolve(initialSeededSnapshot));
  const itemsRef = useRef<HomeFeedItem[]>([]);
  const hasMoreRef = useRef({
    notes: initialSeededSnapshot.hasMoreNotes,
    sharedPosts: initialSeededSnapshot.hasMoreSharedPosts,
  });
  const [loadedNotes, setLoadedNotes] = useState<Note[]>(initialSeededSnapshot.notes);
  const [loadedSharedPosts, setLoadedSharedPosts] = useState<SharedPost[]>(initialSeededSnapshot.sharedPosts);
  const [hasMoreNotes, setHasMoreNotes] = useState(initialSeededSnapshot.hasMoreNotes);
  const [hasMoreSharedPosts, setHasMoreSharedPosts] = useState(initialSeededSnapshot.hasMoreSharedPosts);
  const [isLoading, setIsLoading] = useState(isWaitingForInitialData);
  const [hasResolvedInitialWindow, setHasResolvedInitialWindow] = useState(!isWaitingForInitialData);

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

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  const resolveSeededSnapshot = useCallback((window: FeedWindow): HomeFeedSnapshot | null => {
    const canServeNotesFromSeed =
      window.notes <= seedNotes.length || seedNoteCount <= seedNotes.length;
    if (!canServeNotesFromSeed) {
      return null;
    }

    return buildSeededSnapshot(window, {
      seedNotes,
      seedNoteCount,
      seededFriendSharedPosts,
    });
  }, [
    seedNoteCount,
    seedNotes,
    seededFriendSharedPosts,
  ]);

  const fetchWindow = useCallback(async (window: FeedWindow): Promise<HomeFeedSnapshot> => {
    const seededSnapshot = resolveSeededSnapshot(window);
    if (seededSnapshot) {
      return seededSnapshot;
    }

    const [notesRows, sharedRows] = await Promise.all([
      window.notes <= seedNotes.length && seedNoteCount <= seedNotes.length
        ? Promise.resolve(seedNotes.slice(0, window.notes))
        : getNotesPageForScope(notesScope, {
            limit: window.notes + 1,
          }),
      sharedCacheUserUid
        ? Promise.resolve(
            seededFriendSharedPosts.slice(0, window.sharedPosts)
          )
        : Promise.resolve<SharedPost[]>([]),
    ]);

    const seededNotesSatisfied =
      window.notes <= seedNotes.length && seedNoteCount <= seedNotes.length;

    return {
      notes: notesRows.slice(0, window.notes),
      sharedPosts: sharedRows.slice(0, window.sharedPosts),
      hasMoreNotes: seededNotesSatisfied ? seedNoteCount > window.notes : notesRows.length > window.notes,
      hasMoreSharedPosts: seededFriendSharedPosts.length > window.sharedPosts,
    };
  }, [
    notesScope,
    resolveSeededSnapshot,
    seedNoteCount,
    seedNotes,
    seededFriendSharedPosts,
    sharedCacheUserUid,
  ]);

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

  const runLoad = useCallback((
    nextWindow: FeedWindow,
    options?: { resetVisibleItems?: boolean }
  ) => {
    requestedWindowRef.current = nextWindow;
    const loadId = ++loadSequenceRef.current;
    const resetSnapshot =
      options?.resetVisibleItems ? resolveSeededSnapshot(nextWindow) : null;

    if (isMountedRef.current) {
      setIsLoading(true);
      if (options?.resetVisibleItems) {
        if (resetSnapshot) {
          const nextItems = buildHomeFeedItems(resetSnapshot.notes, resetSnapshot.sharedPosts);
          itemsRef.current = nextItems;
          snapshotRef.current = resetSnapshot;
          hasMoreRef.current = {
            notes: resetSnapshot.hasMoreNotes,
            sharedPosts: resetSnapshot.hasMoreSharedPosts,
          };
          setLoadedNotes(resetSnapshot.notes);
          setLoadedSharedPosts(resetSnapshot.sharedPosts);
          setHasMoreNotes(resetSnapshot.hasMoreNotes);
          setHasMoreSharedPosts(resetSnapshot.hasMoreSharedPosts);
          setHasResolvedInitialWindow(true);
        } else {
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
  }, [commitSnapshot, fetchWindow, sharedCacheUserUid]);

  useEffect(() => {
    if (notesLoading && seedNotes.length === 0) {
      return;
    }

    if (sharedCacheUserUid && sharedLoading && seedSharedPosts.length === 0) {
      return;
    }

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

    const seededSnapshot = resolveSeededSnapshot(nextWindow);
    if (seededSnapshot) {
      requestedWindowRef.current = nextWindow;
      loadChainRef.current = Promise.resolve(seededSnapshot);

      if (!snapshotsEqual(snapshotRef.current, seededSnapshot)) {
        commitSnapshot(seededSnapshot);
      } else if (isMountedRef.current) {
        setIsLoading(false);
        setHasResolvedInitialWindow(true);
      }

      return;
    }

    void runLoad(nextWindow, {
      resetVisibleItems: sourceChanged,
    });
  }, [
    notesLoading,
    notesScope,
    notesSignal,
    commitSnapshot,
    resolveSeededSnapshot,
    sourceKey,
    runLoad,
    seedNotes.length,
    seedSharedPosts.length,
    sharedCacheUserUid,
    sharedLoading,
    sharedSignal,
  ]);

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

  const ensureTargetLoaded = useCallback(async (target: Pick<HomeFeedItem, 'id' | 'kind'>) => {
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
  }, [runLoad]);

  return {
    items,
    hasMore: hasMoreNotes || hasMoreSharedPosts,
    isLoading: isLoading && !hasResolvedInitialWindow,
    isLoadingMore: isLoading && hasResolvedInitialWindow,
    loadNextPage,
    ensureTargetLoaded,
  };
}

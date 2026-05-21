import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SharedPost, SharedThreadSummary } from '../../../services/sharedFeedService';
import type { SharedThreadReadState } from '../../../services/sharedFeedCache';
import { isUnreadSharedThreadSummary } from './sharedThreadUnread';

type UseUnreadSharedChatCountOptions = {
  enabled: boolean;
  getSharedPostThreadSummaries: (postIds: string[]) => Promise<SharedThreadSummary[]>;
  getSharedThreadReadStates: () => Promise<SharedThreadReadState[]>;
  posts: SharedPost[];
  ready: boolean;
  userUid: string | null | undefined;
};

export function useUnreadSharedChatCount({
  enabled,
  getSharedPostThreadSummaries,
  getSharedThreadReadStates,
  posts,
  ready,
  userUid,
}: UseUnreadSharedChatCountOptions) {
  const [unreadSharedChatCount, setUnreadSharedChatCount] = useState(0);
  const unreadSharedChatCountRef = useRef(0);
  const postIdsKey = useMemo(() => posts.map((post) => post.id).join('|'), [posts]);
  const updateUnreadSharedChatCount = useCallback((nextCount: number) => {
    if (unreadSharedChatCountRef.current === nextCount) {
      return;
    }

    unreadSharedChatCountRef.current = nextCount;
    setUnreadSharedChatCount(nextCount);
  }, []);

  useEffect(() => {
    const postIds = postIdsKey ? postIdsKey.split('|') : [];
    if (!enabled || !ready || !userUid || postIds.length === 0) {
      updateUnreadSharedChatCount(0);
      return;
    }

    let cancelled = false;
    void Promise.all([
      getSharedPostThreadSummaries(postIds).catch(() => []),
      getSharedThreadReadStates().catch(() => []),
    ]).then(([summaries, readStates]) => {
      if (cancelled) {
        return;
      }

      const readStateByPostId = new Map(
        readStates.map((readState) => [readState.postId, readState])
      );
      updateUnreadSharedChatCount(
        summaries.filter((summary) =>
          isUnreadSharedThreadSummary(summary, readStateByPostId.get(summary.postId), userUid)
        ).length
      );
    });

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    getSharedPostThreadSummaries,
    getSharedThreadReadStates,
    postIdsKey,
    ready,
    updateUnreadSharedChatCount,
    userUid,
  ]);

  return unreadSharedChatCount;
}

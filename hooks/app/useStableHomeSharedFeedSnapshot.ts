import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NotesLoadPhase } from '../state/useNotesStore';
import type { SharedPost } from '../../services/sharedFeedService';

interface UseStableHomeSharedFeedSnapshotParams {
  userUid: string | null | undefined;
  notesPhase: NotesLoadPhase;
  sharedEnabled: boolean;
  sharedPosts: SharedPost[];
  startupInteractive: boolean;
  autoPromoteDelayMs?: number | null;
  presentationScope?: string;
}

function getSharedPostPresentationSignature(post: SharedPost) {
  return [
    post.id,
    post.authorUid,
    post.authorDisplayName ?? '',
    post.authorPhotoURLSnapshot ?? '',
    post.type,
    post.text,
    post.photoPath ?? '',
    post.photoLocalUri ?? '',
    post.captureVariant ?? '',
    post.dualPrimaryPhotoPath ?? '',
    post.dualSecondaryPhotoPath ?? '',
    post.dualPrimaryPhotoLocalUri ?? '',
    post.dualSecondaryPhotoLocalUri ?? '',
    post.isLivePhoto ? 'live' : 'still',
    post.pairedVideoPath ?? '',
    post.pairedVideoLocalUri ?? '',
    post.doodleStrokesJson ?? '',
    post.stickerPlacementsJson ?? '',
    post.noteColor ?? '',
    post.placeName ?? '',
    post.sourceNoteId ?? '',
    post.latitude ?? '',
    post.longitude ?? '',
    post.createdAt,
    post.updatedAt ?? '',
  ].join('\u001f');
}

function getSharedPostsPresentationSignature(posts: SharedPost[]) {
  return posts.map(getSharedPostPresentationSignature).join('\u001e');
}

function canFreezeInitialSharedSnapshot(notesPhase: NotesLoadPhase, startupInteractive: boolean) {
  return startupInteractive || notesPhase !== 'bootstrapping';
}

export function useStableHomeSharedFeedSnapshot({
  userUid,
  notesPhase,
  sharedEnabled,
  sharedPosts,
  startupInteractive,
  autoPromoteDelayMs = null,
  presentationScope = 'default',
}: UseStableHomeSharedFeedSnapshotParams) {
  const resetKey = `${userUid?.trim() || 'signed-out'}:${sharedEnabled ? 'shared' : 'local'}:${presentationScope}`;
  const sharedPostsSignature = useMemo(
    () => getSharedPostsPresentationSignature(sharedPosts),
    [sharedPosts]
  );
  const canFreezeInitialSnapshot = canFreezeInitialSharedSnapshot(notesPhase, startupInteractive);
  const [presentedSharedPosts, setPresentedSharedPosts] = useState(sharedPosts);
  const [pendingSharedPosts, setPendingSharedPosts] = useState<SharedPost[] | null>(null);
  const resetKeyRef = useRef(resetKey);
  const frozenRef = useRef(false);
  const presentedSignatureRef = useRef(sharedPostsSignature);
  const latestSharedPostsRef = useRef(sharedPosts);
  const latestSignatureRef = useRef(sharedPostsSignature);
  const pendingSharedPostsRef = useRef(pendingSharedPosts);
  const [promoteRequestId, setPromoteRequestId] = useState(0);

  useEffect(() => {
    latestSharedPostsRef.current = sharedPosts;
    latestSignatureRef.current = sharedPostsSignature;
  }, [sharedPosts, sharedPostsSignature]);

  useEffect(() => {
    pendingSharedPostsRef.current = pendingSharedPosts;
  }, [pendingSharedPosts]);

  const clearPendingSharedPosts = useCallback(() => {
    if (pendingSharedPostsRef.current) {
      pendingSharedPostsRef.current = null;
      setPendingSharedPosts(null);
    }
  }, []);

  const commitPresentedSnapshot = useCallback((nextSharedPosts: SharedPost[], nextSignature: string) => {
    presentedSignatureRef.current = nextSignature;
    frozenRef.current = true;
    clearPendingSharedPosts();
    setPresentedSharedPosts(nextSharedPosts);
  }, [clearPendingSharedPosts]);

  useEffect(() => {
    const resetChanged = resetKeyRef.current !== resetKey;
    if (resetChanged) {
      resetKeyRef.current = resetKey;
      frozenRef.current = canFreezeInitialSnapshot;
      presentedSignatureRef.current = sharedPostsSignature;
      clearPendingSharedPosts();
      setPresentedSharedPosts(sharedPosts);
      return;
    }

    if (!frozenRef.current) {
      presentedSignatureRef.current = sharedPostsSignature;
      clearPendingSharedPosts();
      setPresentedSharedPosts(sharedPosts);
      if (canFreezeInitialSnapshot) {
        frozenRef.current = true;
      }
      return;
    }

    if (sharedPostsSignature === presentedSignatureRef.current) {
      clearPendingSharedPosts();
      return;
    }

    if (presentedSharedPosts.length === 0 && sharedPosts.length > 0) {
      commitPresentedSnapshot(sharedPosts, sharedPostsSignature);
      return;
    }

    pendingSharedPostsRef.current = sharedPosts;
    setPendingSharedPosts(sharedPosts);
  }, [
    canFreezeInitialSnapshot,
    clearPendingSharedPosts,
    commitPresentedSnapshot,
    presentedSharedPosts.length,
    resetKey,
    sharedPosts,
    sharedPostsSignature,
  ]);

  const requestPromoteSharedPosts = useCallback(() => {
    setPromoteRequestId((current) => current + 1);
  }, []);

  useEffect(() => {
    if (promoteRequestId === 0) {
      return;
    }

    commitPresentedSnapshot(latestSharedPostsRef.current, latestSignatureRef.current);
  }, [commitPresentedSnapshot, promoteRequestId]);

  useEffect(() => {
    if (!pendingSharedPosts || autoPromoteDelayMs === null) {
      return;
    }

    const timeoutId = setTimeout(() => {
      commitPresentedSnapshot(latestSharedPostsRef.current, latestSignatureRef.current);
    }, Math.max(autoPromoteDelayMs, 0));

    return () => {
      clearTimeout(timeoutId);
    };
  }, [autoPromoteDelayMs, commitPresentedSnapshot, pendingSharedPosts]);

  const hasPendingSharedUpdates = Boolean(pendingSharedPosts);

  return {
    presentedSharedPosts,
    pendingSharedPosts,
    hasPendingSharedUpdates,
    requestPromoteSharedPosts,
  };
}

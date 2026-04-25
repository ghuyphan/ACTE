import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NotesLoadPhase } from '../state/useNotesStore';
import type { SharedFeedLoadPhase } from '../useSharedFeedStore';
import type { SharedPost } from '../../services/sharedFeedService';

interface UseStableHomeSharedFeedSnapshotParams {
  userUid: string | null | undefined;
  notesPhase: NotesLoadPhase;
  sharedEnabled: boolean;
  sharedPhase: SharedFeedLoadPhase;
  sharedPosts: SharedPost[];
  startupInteractive: boolean;
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

function isInitialHomeSnapshotReady({
  notesPhase,
  sharedEnabled,
  sharedPhase,
  startupInteractive,
}: Pick<
  UseStableHomeSharedFeedSnapshotParams,
  'notesPhase' | 'sharedEnabled' | 'sharedPhase' | 'startupInteractive'
>) {
  if (startupInteractive) {
    return true;
  }

  return notesPhase !== 'bootstrapping' && (!sharedEnabled || sharedPhase !== 'bootstrapping');
}

export function useStableHomeSharedFeedSnapshot({
  userUid,
  notesPhase,
  sharedEnabled,
  sharedPhase,
  sharedPosts,
  startupInteractive,
  presentationScope = 'default',
}: UseStableHomeSharedFeedSnapshotParams) {
  const resetKey = `${userUid?.trim() || 'signed-out'}:${sharedEnabled ? 'shared' : 'local'}:${presentationScope}`;
  const sharedPostsSignature = useMemo(
    () => getSharedPostsPresentationSignature(sharedPosts),
    [sharedPosts]
  );
  const canFreezeInitialSnapshot = isInitialHomeSnapshotReady({
    notesPhase,
    sharedEnabled,
    sharedPhase,
    startupInteractive,
  });
  const [presentedSharedPosts, setPresentedSharedPosts] = useState(sharedPosts);
  const [pendingSharedPosts, setPendingSharedPosts] = useState<SharedPost[] | null>(null);
  const resetKeyRef = useRef(resetKey);
  const frozenRef = useRef(false);
  const presentedSignatureRef = useRef(sharedPostsSignature);
  const latestSharedPostsRef = useRef(sharedPosts);
  const latestSignatureRef = useRef(sharedPostsSignature);
  const pendingSharedPostsRef = useRef<SharedPost[] | null>(null);
  const promoteRequestIdRef = useRef(0);
  const [promoteRequestId, setPromoteRequestId] = useState(0);

  const clearPendingSharedPosts = useCallback(() => {
    if (pendingSharedPostsRef.current === null) {
      return;
    }

    pendingSharedPostsRef.current = null;
    setPendingSharedPosts(null);
  }, []);

  useEffect(() => {
    latestSharedPostsRef.current = sharedPosts;
    latestSignatureRef.current = sharedPostsSignature;
  }, [sharedPosts, sharedPostsSignature]);

  const commitPresentedSnapshot = useCallback((nextSharedPosts: SharedPost[], nextSignature: string) => {
    presentedSignatureRef.current = nextSignature;
    clearPendingSharedPosts();
    frozenRef.current = true;
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

    pendingSharedPostsRef.current = sharedPosts;
    setPendingSharedPosts(sharedPosts);
  }, [
    canFreezeInitialSnapshot,
    clearPendingSharedPosts,
    resetKey,
    sharedPosts,
    sharedPostsSignature,
  ]);

  const requestPromoteSharedPosts = useCallback(() => {
    promoteRequestIdRef.current += 1;
    setPromoteRequestId(promoteRequestIdRef.current);
  }, []);

  useEffect(() => {
    if (promoteRequestId === 0) {
      return;
    }

    commitPresentedSnapshot(latestSharedPostsRef.current, latestSignatureRef.current);
  }, [commitPresentedSnapshot, promoteRequestId]);

  const hasPendingSharedUpdates = Boolean(pendingSharedPosts);

  return {
    presentedSharedPosts,
    pendingSharedPosts,
    hasPendingSharedUpdates,
    requestPromoteSharedPosts,
  };
}

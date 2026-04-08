import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NearbyNoteItem } from './mapDomain';
import type { SharedPost } from '../../services/sharedFeedService';

type NotesPreviewVisibility = 'visible' | 'collapsed';

interface NotesPreviewState {
  visibility: NotesPreviewVisibility;
  itemsOverride: NearbyNoteItem[] | null;
  persistsWhenAreaEmpty: boolean;
}

interface UseMapPreviewStateParams {
  nearbyItems: NearbyNoteItem[];
  friendPosts: SharedPost[];
}

export function useMapPreviewState({
  nearbyItems,
  friendPosts,
}: UseMapPreviewStateParams) {
  const [notesPreviewState, setNotesPreviewState] = useState<NotesPreviewState>({
    visibility: 'visible',
    itemsOverride: null,
    persistsWhenAreaEmpty: false,
  });
  const [activeNearbyNoteId, setActiveNearbyNoteId] = useState<string | null>(null);
  const [showFriendsPreview, setShowFriendsPreview] = useState(false);
  const [activeFriendPostId, setActiveFriendPostId] = useState<string | null>(null);

  const nearbyPreviewItems = useMemo(
    () => notesPreviewState.itemsOverride ?? nearbyItems,
    [nearbyItems, notesPreviewState.itemsOverride]
  );

  useEffect(() => {
    setActiveNearbyNoteId((current) => {
      if (nearbyPreviewItems.length === 0) {
        return null;
      }

      if (current && nearbyPreviewItems.some((item) => item.note.id === current)) {
        return current;
      }

      return nearbyPreviewItems[0].note.id;
    });
  }, [nearbyPreviewItems]);

  useEffect(() => {
    if (!friendPosts.length) {
      if (showFriendsPreview) {
        setShowFriendsPreview(false);
      }
      if (activeFriendPostId !== null) {
        setActiveFriendPostId(null);
      }
      return;
    }

    if (activeFriendPostId && friendPosts.some((post) => post.id === activeFriendPostId)) {
      return;
    }

    setActiveFriendPostId(friendPosts[0].id);
  }, [activeFriendPostId, friendPosts, showFriendsPreview]);

  const revealNotesPreview = useCallback((options?: { resetToNearby?: boolean }) => {
    setShowFriendsPreview(false);
    setNotesPreviewState((current) => ({
      visibility: 'visible',
      itemsOverride: options?.resetToNearby ? null : current.itemsOverride,
      persistsWhenAreaEmpty: options?.resetToNearby ? false : current.persistsWhenAreaEmpty,
    }));
  }, []);

  const collapseNotesPreview = useCallback(() => {
    setNotesPreviewState((current) => ({
      ...current,
      visibility: 'collapsed',
    }));
  }, []);

  const closeFriendsPreview = useCallback(() => {
    setShowFriendsPreview(false);
  }, []);

  const openFriendsPreview = useCallback(() => {
    setShowFriendsPreview(true);
  }, []);

  const toggleFriendsPreview = useCallback((fallbackPostId?: string | null) => {
    setShowFriendsPreview((current) => !current);
    setActiveFriendPostId((current) => current ?? fallbackPostId ?? null);
  }, []);

  const focusNearbyPreview = useCallback(
    (items: NearbyNoteItem[], noteId?: string | null) => {
      setShowFriendsPreview(false);
      setNotesPreviewState({
        visibility: 'visible',
        itemsOverride: items,
        persistsWhenAreaEmpty: true,
      });

      if (noteId !== undefined) {
        setActiveNearbyNoteId(noteId);
      }
    },
    []
  );

  const resetToNearbyPreview = useCallback(() => {
    setNotesPreviewState((current) =>
      current.itemsOverride === null && !current.persistsWhenAreaEmpty
        ? current
        : {
            ...current,
            itemsOverride: null,
            persistsWhenAreaEmpty: false,
          }
    );
  }, []);

  return {
    activeFriendPostId,
    activeNearbyNoteId,
    closeFriendsPreview,
    collapseNotesPreview,
    nearbyPreviewItems,
    notesPreviewPersistsWhenAreaEmpty: notesPreviewState.persistsWhenAreaEmpty,
    notesPreviewVisibility: notesPreviewState.visibility,
    openFriendsPreview,
    revealNotesPreview,
    setActiveFriendPostId,
    showFriendsPreview,
    toggleFriendsPreview,
    focusNearbyPreview,
    resetToNearbyPreview,
  };
}

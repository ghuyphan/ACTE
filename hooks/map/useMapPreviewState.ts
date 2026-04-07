import { useCallback, useEffect, useRef, useState } from 'react';
import type { NearbyNoteItem } from './mapDomain';
import type { SharedPost } from '../../services/sharedFeedService';

function areNearbyItemsEquivalent(left: NearbyNoteItem[], right: NearbyNoteItem[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => {
    const other = right[index];
    return (
      other != null &&
      other.note.id === item.note.id &&
      other.distanceMeters === item.distanceMeters
    );
  });
}

interface UseMapPreviewStateParams {
  nearbyItems: NearbyNoteItem[];
  friendPosts: SharedPost[];
}

export function useMapPreviewState({
  nearbyItems,
  friendPosts,
}: UseMapPreviewStateParams) {
  const [activeNearbyNoteId, setActiveNearbyNoteId] = useState<string | null>(null);
  const [nearbyPreviewItems, setNearbyPreviewItems] = useState<NearbyNoteItem[]>([]);
  const [notesPreviewDismissed, setNotesPreviewDismissed] = useState(false);
  const [notesPreviewCollapsed, setNotesPreviewCollapsed] = useState(false);
  const [showFriendsPreview, setShowFriendsPreview] = useState(false);
  const [activeFriendPostId, setActiveFriendPostId] = useState<string | null>(null);
  const shouldAdoptNearbyPreviewItemsRef = useRef(true);

  useEffect(() => {
    const shouldAdopt =
      shouldAdoptNearbyPreviewItemsRef.current ||
      nearbyPreviewItems.length === 0 ||
      (activeNearbyNoteId != null &&
        !nearbyPreviewItems.some((item) => item.note.id === activeNearbyNoteId));

    if (!shouldAdopt) {
      return;
    }

    setNearbyPreviewItems((current) =>
      areNearbyItemsEquivalent(current, nearbyItems) ? current : nearbyItems
    );
    setActiveNearbyNoteId((current) => {
      if (nearbyItems.length === 0) {
        return null;
      }

      if (current && nearbyItems.some((item) => item.note.id === current)) {
        return current;
      }

      return nearbyItems[0].note.id;
    });
    shouldAdoptNearbyPreviewItemsRef.current = false;
  }, [activeNearbyNoteId, nearbyItems, nearbyPreviewItems]);

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

  const requestNearbyPreviewAdoption = useCallback(() => {
    shouldAdoptNearbyPreviewItemsRef.current = true;
  }, []);

  const revealNotesPreview = useCallback((options?: { adoptNearbyItems?: boolean }) => {
    if (options?.adoptNearbyItems) {
      shouldAdoptNearbyPreviewItemsRef.current = true;
    }

    setShowFriendsPreview(false);
    setNotesPreviewDismissed(false);
    setNotesPreviewCollapsed(false);
  }, []);

  const dismissNotesPreview = useCallback(() => {
    setShowFriendsPreview(false);
    setNotesPreviewDismissed(true);
    setNotesPreviewCollapsed(false);
  }, []);

  const collapseNotesPreview = useCallback(() => {
    setNotesPreviewCollapsed(true);
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

  const presentNearbyPreviewItems = useCallback((items: NearbyNoteItem[]) => {
    setNearbyPreviewItems(items);
    setActiveNearbyNoteId((current) => {
      if (items.length === 0) {
        return null;
      }

      if (current && items.some((item) => item.note.id === current)) {
        return current;
      }

      return items[0].note.id;
    });
  }, []);

  return {
    activeFriendPostId,
    activeNearbyNoteId,
    closeFriendsPreview,
    collapseNotesPreview,
    dismissNotesPreview,
    nearbyPreviewItems,
    notesPreviewCollapsed,
    notesPreviewDismissed,
    openFriendsPreview,
    presentNearbyPreviewItems,
    requestNearbyPreviewAdoption,
    revealNotesPreview,
    setActiveFriendPostId,
    setActiveNearbyNoteId,
    showFriendsPreview,
    toggleFriendsPreview,
  };
}

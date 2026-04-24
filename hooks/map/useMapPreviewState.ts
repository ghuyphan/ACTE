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
  validNoteIds?: ReadonlySet<string>;
}

function haveSameNearbyOrder(left: NearbyNoteItem[], right: NearbyNoteItem[]) {
  return left.length === right.length && left.every((item, index) => item.note.id === right[index]?.note.id);
}

function getNearbyItemSignature(item: NearbyNoteItem) {
  const { note } = item;
  return [
    note.id,
    note.type,
    note.content,
    note.locationName ?? '',
    note.moodEmoji ?? '',
    note.noteColor ?? '',
    note.isFavorite ? '1' : '0',
    note.createdAt,
    note.updatedAt ?? '',
    note.latitude,
    note.longitude,
    item.distanceMeters.toFixed(2),
  ].join('\u001f');
}

function haveSameNearbyItems(left: NearbyNoteItem[], right: NearbyNoteItem[]) {
  return (
    haveSameNearbyOrder(left, right) &&
    left.every((item, index) => {
      const nextItem = right[index];
      return nextItem && getNearbyItemSignature(item) === getNearbyItemSignature(nextItem);
    })
  );
}

function mergeNearbyPreviewItems(current: NearbyNoteItem[], next: NearbyNoteItem[]) {
  if (next.length === 0) {
    return current.length === 0 ? current : [];
  }

  if (current.length === 0) {
    return next;
  }

  const nextById = new Map(next.map((item) => [item.note.id, item] as const));
  const overlappingItems = current
    .map((item) => nextById.get(item.note.id))
    .filter((item): item is NearbyNoteItem => Boolean(item));

  if (overlappingItems.length === 0) {
    return haveSameNearbyItems(current, next) ? current : next;
  }

  const preservedIds = new Set(overlappingItems.map((item) => item.note.id));
  const appendedItems = next.filter((item) => !preservedIds.has(item.note.id));
  const mergedItems = [...overlappingItems, ...appendedItems];
  return haveSameNearbyItems(current, mergedItems) ? current : mergedItems;
}

function filterValidNearbyItems(items: NearbyNoteItem[], validNoteIds?: ReadonlySet<string>) {
  return validNoteIds ? items.filter((item) => validNoteIds.has(item.note.id)) : items;
}

function reconcilePinnedPreviewItems(
  items: NearbyNoteItem[],
  nearbyItems: NearbyNoteItem[],
  validNoteIds?: ReadonlySet<string>
) {
  if (!validNoteIds) {
    return items;
  }

  const nearbyItemById = new Map(nearbyItems.map((item) => [item.note.id, item] as const));
  return items
    .filter((item) => validNoteIds.has(item.note.id))
    .map((item) => nearbyItemById.get(item.note.id) ?? item);
}

export function useMapPreviewState({
  nearbyItems,
  friendPosts,
  validNoteIds,
}: UseMapPreviewStateParams) {
  const [notesPreviewState, setNotesPreviewState] = useState<NotesPreviewState>({
    visibility: 'visible',
    itemsOverride: null,
    persistsWhenAreaEmpty: false,
  });
  const [activeNearbyNoteId, setActiveNearbyNoteId] = useState<string | null>(null);
  const [stableNearbyItems, setStableNearbyItems] = useState<NearbyNoteItem[]>(nearbyItems);
  const [showFriendsPreview, setShowFriendsPreview] = useState(false);
  const [activeFriendPostId, setActiveFriendPostId] = useState<string | null>(null);
  const nearbyItemsSignature = useMemo(
    () => nearbyItems.map(getNearbyItemSignature).join('|'),
    [nearbyItems]
  );
  const nearbyItemsSnapshot = useMemo(() => nearbyItems, [nearbyItemsSignature]);

  const nearbyPreviewItems = useMemo(() => {
    const items = notesPreviewState.itemsOverride ?? stableNearbyItems;
    return filterValidNearbyItems(items, validNoteIds);
  }, [notesPreviewState.itemsOverride, stableNearbyItems, validNoteIds]);

  useEffect(() => {
    if (notesPreviewState.itemsOverride !== null) {
      return;
    }

    setStableNearbyItems((current) => mergeNearbyPreviewItems(current, nearbyItemsSnapshot));
  }, [nearbyItemsSignature, nearbyItemsSnapshot, notesPreviewState.itemsOverride]);

  useEffect(() => {
    if (!validNoteIds) {
      return;
    }

    setNotesPreviewState((current) => {
      if (current.itemsOverride === null) {
        return current;
      }

      const reconciledItems = reconcilePinnedPreviewItems(
        current.itemsOverride,
        nearbyItemsSnapshot,
        validNoteIds
      );

      if (reconciledItems.length === 0) {
        return {
          ...current,
          itemsOverride: null,
          persistsWhenAreaEmpty: false,
        };
      }

      return haveSameNearbyItems(current.itemsOverride, reconciledItems)
        ? current
        : {
            ...current,
            itemsOverride: reconciledItems,
          };
    });
  }, [nearbyItemsSnapshot, validNoteIds]);

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
    if (options?.resetToNearby) {
      setStableNearbyItems(nearbyItemsSnapshot);
    }
  }, [nearbyItemsSnapshot]);

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
    setStableNearbyItems(nearbyItemsSnapshot);
    setNotesPreviewState((current) =>
      current.itemsOverride === null && !current.persistsWhenAreaEmpty
        ? current
        : {
            ...current,
            itemsOverride: null,
            persistsWhenAreaEmpty: false,
          }
    );
  }, [nearbyItemsSnapshot]);

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

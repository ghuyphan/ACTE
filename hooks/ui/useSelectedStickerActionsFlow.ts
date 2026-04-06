import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  bringStickerPlacementToFront,
  duplicateStickerPlacement,
  setStickerPlacementMotionLocked,
  setStickerPlacementOutlineEnabled,
  setStickerPlacementRenderMode,
  updateStickerPlacementTransform,
  type NoteStickerPlacement,
} from '../../services/noteStickers';
import type { StickerAction } from './stickerFlowTypes';

interface UseSelectedStickerActionsFlowOptions {
  dismissOverlay: () => void;
  dismissStickerUi: () => void;
  onChangeStickerPlacements?: (nextPlacements: NoteStickerPlacement[]) => void;
  selectSticker: (nextId: string | null) => void;
  selectedStickerId: string | null;
  stickerPlacements: NoteStickerPlacement[];
  toggleStickerMode: () => void;
}

export function useSelectedStickerActionsFlow({
  dismissOverlay,
  dismissStickerUi,
  onChangeStickerPlacements,
  selectSticker,
  selectedStickerId,
  stickerPlacements,
  toggleStickerMode,
}: UseSelectedStickerActionsFlowOptions) {
  const [showStickerActionsSheet, setShowStickerActionsSheet] = useState(false);
  const selectedStickerPlacement = useMemo(
    () => stickerPlacements.find((placement) => placement.id === selectedStickerId) ?? null,
    [selectedStickerId, stickerPlacements]
  );
  const selectedStickerIsStamp = selectedStickerPlacement?.renderMode === 'stamp';
  const selectedStickerOutlineEnabled = selectedStickerPlacement?.outlineEnabled !== false;
  const selectedStickerMotionLocked = selectedStickerPlacement?.motionLocked === true;

  const handleCloseStickerActionsSheet = useCallback(() => {
    setShowStickerActionsSheet(false);
  }, []);

  const handleShowStickerActions = useCallback(() => {
    if (!selectedStickerId) {
      return;
    }

    dismissStickerUi();
    setShowStickerActionsSheet(true);
  }, [dismissStickerUi, selectedStickerId]);

  const handleSelectedStickerAction = useCallback(
    (action: StickerAction) => {
      if (!selectedStickerId || !onChangeStickerPlacements) {
        return;
      }

      const currentPlacements = stickerPlacements;
      const placement = currentPlacements.find((candidate) => candidate.id === selectedStickerId);
      if (!placement && action !== 'duplicate' && action !== 'front' && action !== 'remove') {
        return;
      }

      let nextPlacements = currentPlacements;
      switch (action) {
        case 'duplicate':
          nextPlacements = duplicateStickerPlacement(currentPlacements, selectedStickerId);
          break;
        case 'front':
          nextPlacements = bringStickerPlacementToFront(currentPlacements, selectedStickerId);
          break;
        case 'outline-toggle':
          nextPlacements =
            placement && placement.renderMode !== 'stamp'
              ? setStickerPlacementOutlineEnabled(
                currentPlacements,
                selectedStickerId,
                placement.outlineEnabled === false
              )
              : currentPlacements;
          break;
        case 'motion-lock-toggle':
          nextPlacements = setStickerPlacementMotionLocked(
            currentPlacements,
            selectedStickerId,
            !selectedStickerMotionLocked
          );
          break;
        case 'stamp-toggle':
          nextPlacements = setStickerPlacementRenderMode(
            currentPlacements,
            selectedStickerId,
            selectedStickerIsStamp ? 'default' : 'stamp'
          );
          break;
        case 'remove':
          nextPlacements = currentPlacements.filter((candidate) => candidate.id !== selectedStickerId);
          selectSticker(null);
          break;
        case 'rotate-left':
          nextPlacements = updateStickerPlacementTransform(currentPlacements, selectedStickerId, {
            rotation: placement!.rotation - 15,
          });
          break;
        case 'rotate-right':
          nextPlacements = updateStickerPlacementTransform(currentPlacements, selectedStickerId, {
            rotation: placement!.rotation + 15,
          });
          break;
        case 'smaller':
          nextPlacements = updateStickerPlacementTransform(currentPlacements, selectedStickerId, {
            scale: placement!.scale - 0.12,
          });
          break;
        case 'larger':
          nextPlacements = updateStickerPlacementTransform(currentPlacements, selectedStickerId, {
            scale: placement!.scale + 0.12,
          });
          break;
      }

      if (nextPlacements !== currentPlacements) {
        onChangeStickerPlacements(nextPlacements);
      }
    },
    [
      onChangeStickerPlacements,
      selectSticker,
      selectedStickerId,
      selectedStickerIsStamp,
      selectedStickerMotionLocked,
      stickerPlacements,
    ]
  );

  const handleToggleStickerMode = useCallback(() => {
    setShowStickerActionsSheet(false);
    dismissOverlay();
    toggleStickerMode();
  }, [dismissOverlay, toggleStickerMode]);

  const handleSelectSticker = useCallback(
    (nextId: string | null) => {
      if (!nextId) {
        setShowStickerActionsSheet(false);
      }

      selectSticker(nextId);
    },
    [selectSticker]
  );

  const hideStickerActionsSheet = useCallback(() => {
    setShowStickerActionsSheet(false);
  }, []);

  useEffect(() => {
    if (!selectedStickerId) {
      setShowStickerActionsSheet(false);
    }
  }, [selectedStickerId]);

  return {
    handleCloseStickerActionsSheet,
    handleSelectSticker,
    handleSelectedStickerAction,
    handleShowStickerActions,
    handleToggleStickerMode,
    hideStickerActionsSheet,
    selectedStickerIsStamp,
    selectedStickerMotionLocked,
    selectedStickerOutlineEnabled,
    selectedStickerPlacement,
    showStickerActionsSheet,
  };
}

export default useSelectedStickerActionsFlow;

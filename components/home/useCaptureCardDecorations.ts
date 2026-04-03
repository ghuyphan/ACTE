import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DoodleStroke } from '../notes/NoteDoodleCanvas';
import {
  bringStickerPlacementToFront,
  duplicateStickerPlacement,
  setStickerPlacementMotionLocked,
  setStickerPlacementOutlineEnabled,
  updateStickerPlacementTransform,
  type NoteStickerPlacement,
} from '../../services/noteStickers';

interface UseCaptureCardDecorationsOptions {
  captureMode: 'text' | 'camera';
  capturedPhoto: string | null;
  captureCardTextColor: string;
  photoDoodleDefaultColor: string;
  primaryColor: string;
  dismissCaptureInputs: () => void;
  dismissPastePrompt: () => void;
  enablePhotoStickers: boolean;
}

function getUniqueColors(colors: string[]) {
  return colors.filter((color, index) => colors.indexOf(color) === index);
}

export function useCaptureCardDecorations({
  captureMode,
  capturedPhoto,
  captureCardTextColor,
  photoDoodleDefaultColor,
  primaryColor,
  dismissCaptureInputs,
  dismissPastePrompt,
  enablePhotoStickers,
}: UseCaptureCardDecorationsOptions) {
  const [doodleModeEnabled, setDoodleModeEnabled] = useState(false);
  const [stickerModeEnabled, setStickerModeEnabled] = useState(false);
  const [textDoodleStrokes, setTextDoodleStrokes] = useState<DoodleStroke[]>([]);
  const [photoDoodleStrokes, setPhotoDoodleStrokes] = useState<DoodleStroke[]>([]);
  const [textDoodleColor, setTextDoodleColor] = useState(captureCardTextColor);
  const [photoDoodleColor, setPhotoDoodleColor] = useState(photoDoodleDefaultColor);
  const [textStickerPlacements, setTextStickerPlacements] = useState<NoteStickerPlacement[]>([]);
  const [photoStickerPlacements, setPhotoStickerPlacements] = useState<NoteStickerPlacement[]>([]);
  const [textSelectedStickerId, setTextSelectedStickerId] = useState<string | null>(null);
  const [photoSelectedStickerId, setPhotoSelectedStickerId] = useState<string | null>(null);
  const previousTextDoodleDefaultColorRef = useRef(captureCardTextColor);

  const isCameraCaptureSurface = captureMode === 'camera';
  const isPhotoDoodleSurface = isCameraCaptureSurface && Boolean(capturedPhoto);
  const doodleStrokes = isCameraCaptureSurface ? photoDoodleStrokes : textDoodleStrokes;
  const doodleColor = isCameraCaptureSurface ? photoDoodleColor : textDoodleColor;
  const stickerPlacements = isCameraCaptureSurface ? photoStickerPlacements : textStickerPlacements;
  const selectedStickerId = isCameraCaptureSurface ? photoSelectedStickerId : textSelectedStickerId;
  const selectedStickerPlacement = useMemo(
    () => stickerPlacements.find((placement) => placement.id === selectedStickerId) ?? null,
    [selectedStickerId, stickerPlacements]
  );
  const selectedStickerIsStamp = selectedStickerPlacement?.renderMode === 'stamp';
  const selectedStickerOutlineEnabled = selectedStickerPlacement?.outlineEnabled !== false;
  const selectedStickerMotionLocked = selectedStickerPlacement?.motionLocked === true;
  const textDoodleColors = useMemo(
    () => getUniqueColors([captureCardTextColor, photoDoodleDefaultColor, primaryColor]),
    [captureCardTextColor, photoDoodleDefaultColor, primaryColor]
  );
  const photoDoodleColors = useMemo(
    () => getUniqueColors([photoDoodleDefaultColor, '#1C1C1E', primaryColor]),
    [photoDoodleDefaultColor, primaryColor]
  );
  const doodleColorOptions = isCameraCaptureSurface ? photoDoodleColors : textDoodleColors;

  useEffect(() => {
    const previousDefaultColor = previousTextDoodleDefaultColorRef.current;
    setTextDoodleColor((current) => (
      current === previousDefaultColor ? captureCardTextColor : current
    ));
    previousTextDoodleDefaultColorRef.current = captureCardTextColor;
  }, [captureCardTextColor]);

  const closeDecorateControls = useCallback(() => {
    setDoodleModeEnabled(false);
    setStickerModeEnabled(false);
    setTextSelectedStickerId(null);
    setPhotoSelectedStickerId(null);
  }, []);

  const resetDoodle = useCallback(() => {
    if (doodleModeEnabled) {
      setDoodleModeEnabled(false);
    }
    setTextDoodleStrokes([]);
    setPhotoDoodleStrokes([]);
    setTextDoodleColor(captureCardTextColor);
    setPhotoDoodleColor(photoDoodleDefaultColor);
  }, [captureCardTextColor, doodleModeEnabled, photoDoodleDefaultColor]);

  const resetStickers = useCallback(() => {
    if (stickerModeEnabled) {
      setStickerModeEnabled(false);
    }
    setTextStickerPlacements([]);
    setPhotoStickerPlacements([]);
    setTextSelectedStickerId(null);
    setPhotoSelectedStickerId(null);
  }, [stickerModeEnabled]);

  const toggleDoodleMode = useCallback(() => {
    dismissPastePrompt();
    dismissCaptureInputs();
    setStickerModeEnabled(false);
    if (isPhotoDoodleSurface) {
      setPhotoSelectedStickerId(null);
    } else {
      setTextSelectedStickerId(null);
    }
    setDoodleModeEnabled((current) => !current);
  }, [dismissCaptureInputs, dismissPastePrompt, isPhotoDoodleSurface]);

  const undoDoodle = useCallback(() => {
    if (isPhotoDoodleSurface) {
      setPhotoDoodleStrokes((current) => current.slice(0, -1));
      return;
    }

    setTextDoodleStrokes((current) => current.slice(0, -1));
  }, [isPhotoDoodleSurface]);

  const clearDoodle = useCallback(() => {
    if (isPhotoDoodleSurface) {
      setPhotoDoodleStrokes([]);
      return;
    }

    setTextDoodleStrokes([]);
  }, [isPhotoDoodleSurface]);

  const selectDoodleColor = useCallback((nextColor: string) => {
    if (isPhotoDoodleSurface) {
      setPhotoDoodleColor(nextColor);
      return;
    }

    setTextDoodleColor(nextColor);
  }, [isPhotoDoodleSurface]);

  const applyImportedSticker = useCallback((nextPlacement: NoteStickerPlacement) => {
    if (isPhotoDoodleSurface) {
      setPhotoStickerPlacements((current) => [...current, nextPlacement]);
      setPhotoSelectedStickerId(nextPlacement.id);
    } else {
      setTextStickerPlacements((current) => [...current, nextPlacement]);
      setTextSelectedStickerId(nextPlacement.id);
    }
    setStickerModeEnabled(true);
    setDoodleModeEnabled(false);
  }, [isPhotoDoodleSurface]);

  const toggleStickerMode = useCallback(() => {
    if (!enablePhotoStickers) {
      return;
    }

    dismissPastePrompt();
    dismissCaptureInputs();
    setDoodleModeEnabled(false);
    setStickerModeEnabled((current) => !current);
    if (stickerModeEnabled) {
      if (isPhotoDoodleSurface) {
        setPhotoSelectedStickerId(null);
      } else {
        setTextSelectedStickerId(null);
      }
    }
  }, [
    dismissCaptureInputs,
    dismissPastePrompt,
    enablePhotoStickers,
    isPhotoDoodleSurface,
    stickerModeEnabled,
  ]);

  const changeStickerPlacements = useCallback((nextPlacements: NoteStickerPlacement[]) => {
    if (isPhotoDoodleSurface) {
      setPhotoStickerPlacements(nextPlacements);
      return;
    }

    setTextStickerPlacements(nextPlacements);
  }, [isPhotoDoodleSurface]);

  const selectSticker = useCallback((nextId: string | null) => {
    if (isPhotoDoodleSurface) {
      setPhotoSelectedStickerId(nextId);
      return;
    }

    setTextSelectedStickerId(nextId);
  }, [isPhotoDoodleSurface]);

  const pressStickerCanvas = useCallback(() => {
    if (!stickerModeEnabled) {
      return;
    }

    dismissPastePrompt();

    if (selectedStickerId) {
      selectSticker(null);
      return;
    }

    closeDecorateControls();
  }, [closeDecorateControls, dismissPastePrompt, selectSticker, selectedStickerId, stickerModeEnabled]);

  const toggleStickerMotionLock = useCallback(() => {
    if (!selectedStickerId) {
      return;
    }

    changeStickerPlacements(
      setStickerPlacementMotionLocked(
        stickerPlacements,
        selectedStickerId,
        !selectedStickerMotionLocked
      )
    );
  }, [
    changeStickerPlacements,
    selectedStickerId,
    selectedStickerMotionLocked,
    stickerPlacements,
  ]);

  const applySelectedStickerAction = useCallback(
    (
      action:
        | 'rotate-left'
        | 'rotate-right'
        | 'smaller'
        | 'larger'
        | 'duplicate'
        | 'front'
        | 'remove'
        | 'outline-toggle'
    ) => {
      if (!selectedStickerId) {
        return;
      }

      const currentPlacements = stickerPlacements;
      let nextPlacements = currentPlacements;

      if (action === 'duplicate') {
        nextPlacements = duplicateStickerPlacement(currentPlacements, selectedStickerId);
      } else if (action === 'front') {
        nextPlacements = bringStickerPlacementToFront(currentPlacements, selectedStickerId);
      } else if (action === 'outline-toggle') {
        const placement = currentPlacements.find((candidate) => candidate.id === selectedStickerId);
        nextPlacements = placement && placement.renderMode !== 'stamp'
          ? setStickerPlacementOutlineEnabled(
              currentPlacements,
              selectedStickerId,
              placement.outlineEnabled === false
            )
          : currentPlacements;
      } else if (action === 'remove') {
        nextPlacements = currentPlacements.filter((placement) => placement.id !== selectedStickerId);
        selectSticker(null);
      } else {
        const placement = currentPlacements.find((candidate) => candidate.id === selectedStickerId);

        if (!placement) {
          nextPlacements = currentPlacements;
        } else if (action === 'rotate-left') {
          nextPlacements = updateStickerPlacementTransform(currentPlacements, selectedStickerId, {
            rotation: placement.rotation - 15,
          });
        } else if (action === 'rotate-right') {
          nextPlacements = updateStickerPlacementTransform(currentPlacements, selectedStickerId, {
            rotation: placement.rotation + 15,
          });
        } else if (action === 'smaller') {
          nextPlacements = updateStickerPlacementTransform(currentPlacements, selectedStickerId, {
            scale: placement.scale - 0.12,
          });
        } else if (action === 'larger') {
          nextPlacements = updateStickerPlacementTransform(currentPlacements, selectedStickerId, {
            scale: placement.scale + 0.12,
          });
        }
      }

      changeStickerPlacements(nextPlacements);
    },
    [changeStickerPlacements, selectSticker, selectedStickerId, stickerPlacements]
  );

  return useMemo(
    () => ({
      applyImportedSticker,
      applySelectedStickerAction,
      changeStickerPlacements,
      clearDoodle,
      closeDecorateControls,
      doodleColor,
      doodleColorOptions,
      doodleModeEnabled,
      doodleStrokes,
      photoDoodleStrokes,
      pressStickerCanvas,
      resetDoodle,
      resetStickers,
      selectDoodleColor,
      selectedStickerId,
      selectedStickerIsStamp,
      selectedStickerMotionLocked,
      selectedStickerOutlineEnabled,
      selectSticker,
      stickerModeEnabled,
      stickerPlacements,
      textDoodleStrokes,
      toggleDoodleMode,
      toggleStickerMode,
      toggleStickerMotionLock,
      undoDoodle,
      setPhotoDoodleStrokes,
      setTextDoodleStrokes,
    }),
    [
      applyImportedSticker,
      applySelectedStickerAction,
      changeStickerPlacements,
      clearDoodle,
      closeDecorateControls,
      doodleColor,
      doodleColorOptions,
      doodleModeEnabled,
      doodleStrokes,
      photoDoodleStrokes,
      pressStickerCanvas,
      resetDoodle,
      resetStickers,
      selectDoodleColor,
      selectedStickerId,
      selectedStickerIsStamp,
      selectedStickerMotionLocked,
      selectedStickerOutlineEnabled,
      selectSticker,
      stickerModeEnabled,
      stickerPlacements,
      textDoodleStrokes,
      toggleDoodleMode,
      toggleStickerMode,
      toggleStickerMotionLock,
      undoDoodle,
    ]
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DoodleStroke } from '../notes/NoteDoodleCanvas';
import { type NoteStickerPlacement } from '../../services/noteStickers';

interface UseCaptureCardDecorationsOptions {
  captureMode: 'text' | 'camera';
  capturedPhoto: string | null;
  captureCardTextColor: string;
  photoDoodleDefaultColor: string;
  primaryColor: string;
  dismissCaptureInputs: () => void;
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
    dismissCaptureInputs();
    setStickerModeEnabled(false);
    if (isPhotoDoodleSurface) {
      setPhotoSelectedStickerId(null);
    } else {
      setTextSelectedStickerId(null);
    }
    setDoodleModeEnabled((current) => !current);
  }, [dismissCaptureInputs, isPhotoDoodleSurface]);

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

    if (selectedStickerId) {
      selectSticker(null);
      return;
    }

    closeDecorateControls();
  }, [closeDecorateControls, selectSticker, selectedStickerId, stickerModeEnabled]);

  return useMemo(
    () => ({
      applyImportedSticker,
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
      selectSticker,
      stickerModeEnabled,
      stickerPlacements,
      textDoodleStrokes,
      toggleDoodleMode,
      toggleStickerMode,
      undoDoodle,
      setPhotoDoodleStrokes,
      setTextDoodleStrokes,
    }),
    [
      applyImportedSticker,
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
      selectSticker,
      stickerModeEnabled,
      stickerPlacements,
      textDoodleStrokes,
      toggleDoodleMode,
      toggleStickerMode,
      undoDoodle,
    ]
  );
}

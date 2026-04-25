import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DoodleStroke } from '../notes/NoteDoodleCanvas';
import {
  appendStickerPlacement,
  type NoteStickerPlacement,
} from '../../services/noteStickers';

interface UseCaptureCardDecorationsOptions {
  captureMode: 'text' | 'camera';
  capturedPhoto: string | null;
  photoDoodleDefaultColor: string;
  dismissCaptureInputs: () => void;
  enablePhotoStickers: boolean;
}

function getUniqueColors(colors: string[]) {
  return colors.filter((color, index) => colors.indexOf(color) === index);
}

const TEXT_DOODLE_DEFAULT_COLOR = '#1C1C1E';
const TEXT_DOODLE_COLOR_OPTIONS = [
  TEXT_DOODLE_DEFAULT_COLOR,
  '#FFFFFF',
  '#FF6B6B',
  '#FF8CC6',
  '#FFB86B',
  '#FFE66D',
  '#2F80ED',
  '#8ED1FF',
  '#34C759',
  '#7BE495',
  '#A855F7',
  '#C084FC',
  '#B8F7D4',
];
const PHOTO_DOODLE_COLOR_OPTIONS = [
  '#FFFFFF',
  '#1C1C1E',
  '#FF6B6B',
  '#FF8CC6',
  '#FFB86B',
  '#FFE66D',
  '#2F80ED',
  '#8ED1FF',
  '#34C759',
  '#7BE495',
  '#A855F7',
  '#C084FC',
  '#B8F7D4',
];

export function useCaptureCardDecorations({
  captureMode,
  capturedPhoto,
  photoDoodleDefaultColor,
  dismissCaptureInputs,
  enablePhotoStickers,
}: UseCaptureCardDecorationsOptions) {
  const [doodleModeEnabled, setDoodleModeEnabled] = useState(false);
  const [stickerModeEnabled, setStickerModeEnabled] = useState(false);
  const [textDoodleStrokes, setTextDoodleStrokes] = useState<DoodleStroke[]>([]);
  const [photoDoodleStrokes, setPhotoDoodleStrokes] = useState<DoodleStroke[]>([]);
  const [textDoodleColor, setTextDoodleColor] = useState(TEXT_DOODLE_DEFAULT_COLOR);
  const [photoDoodleColor, setPhotoDoodleColor] = useState(photoDoodleDefaultColor);
  const [textStickerPlacements, setTextStickerPlacements] = useState<NoteStickerPlacement[]>([]);
  const [photoStickerPlacements, setPhotoStickerPlacements] = useState<NoteStickerPlacement[]>([]);
  const [textSelectedStickerId, setTextSelectedStickerId] = useState<string | null>(null);
  const [photoSelectedStickerId, setPhotoSelectedStickerId] = useState<string | null>(null);
  const previousCapturedPhotoRef = useRef(capturedPhoto);
  const textStickerPlacementsRef = useRef<NoteStickerPlacement[]>([]);
  const photoStickerPlacementsRef = useRef<NoteStickerPlacement[]>([]);

  const isCameraCaptureSurface = captureMode === 'camera';
  const isPhotoDoodleSurface = isCameraCaptureSurface && Boolean(capturedPhoto);
  const doodleStrokes = isCameraCaptureSurface ? photoDoodleStrokes : textDoodleStrokes;
  const doodleColor = isCameraCaptureSurface ? photoDoodleColor : textDoodleColor;
  const stickerPlacements = isCameraCaptureSurface ? photoStickerPlacements : textStickerPlacements;
  const selectedStickerId = isCameraCaptureSurface ? photoSelectedStickerId : textSelectedStickerId;
  const textDoodleColors = useMemo(
    () => getUniqueColors(TEXT_DOODLE_COLOR_OPTIONS),
    []
  );
  const photoDoodleColors = useMemo(
    () => getUniqueColors([photoDoodleDefaultColor, ...PHOTO_DOODLE_COLOR_OPTIONS]),
    [photoDoodleDefaultColor]
  );
  const doodleColorOptions = isCameraCaptureSurface ? photoDoodleColors : textDoodleColors;

  useLayoutEffect(() => {
    const previousCapturedPhoto = previousCapturedPhotoRef.current;
    if (previousCapturedPhoto === capturedPhoto) {
      return;
    }

    previousCapturedPhotoRef.current = capturedPhoto;
    photoStickerPlacementsRef.current = [];
    setPhotoDoodleStrokes([]);
    setPhotoDoodleColor(photoDoodleDefaultColor);
    setPhotoStickerPlacements([]);
    setPhotoSelectedStickerId(null);
    setDoodleModeEnabled(false);
    setStickerModeEnabled(false);
  }, [capturedPhoto, photoDoodleDefaultColor]);

  useEffect(() => {
    textStickerPlacementsRef.current = textStickerPlacements;
  }, [textStickerPlacements]);

  useEffect(() => {
    photoStickerPlacementsRef.current = photoStickerPlacements;
  }, [photoStickerPlacements]);

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
    setTextDoodleColor(TEXT_DOODLE_DEFAULT_COLOR);
    setPhotoDoodleColor(photoDoodleDefaultColor);
  }, [doodleModeEnabled, photoDoodleDefaultColor]);

  const resetStickers = useCallback(() => {
    if (stickerModeEnabled) {
      setStickerModeEnabled(false);
    }
    textStickerPlacementsRef.current = [];
    photoStickerPlacementsRef.current = [];
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
      const insertion = appendStickerPlacement(photoStickerPlacementsRef.current, nextPlacement);
      photoStickerPlacementsRef.current = insertion.placements;
      setPhotoStickerPlacements(insertion.placements);
      setPhotoSelectedStickerId(insertion.placement.id);
    } else {
      const insertion = appendStickerPlacement(textStickerPlacementsRef.current, nextPlacement);
      textStickerPlacementsRef.current = insertion.placements;
      setTextStickerPlacements(insertion.placements);
      setTextSelectedStickerId(insertion.placement.id);
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
      photoStickerPlacementsRef.current = nextPlacements;
      setPhotoStickerPlacements(nextPlacements);
      return;
    }

    textStickerPlacementsRef.current = nextPlacements;
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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_NOTE_COLOR_ID } from '../../services/noteAppearance';

interface UseCaptureCardMetaSheetsOptions {
  captureMode: 'text' | 'camera';
  isSearching: boolean;
  onChangeNoteColor?: ((nextColor: string) => void) | null;
  onChangeRadius: (nextRadius: number) => void;
  onPressLockedNoteColor?: ((colorId: string) => void) | null;
  onHaptic: () => void;
}

export function useCaptureCardMetaSheets({
  captureMode,
  isSearching,
  onChangeNoteColor,
  onChangeRadius,
  onPressLockedNoteColor,
  onHaptic,
}: UseCaptureCardMetaSheetsOptions) {
  const [showNoteColorSheet, setShowNoteColorSheet] = useState(false);
  const [showRadiusSheet, setShowRadiusSheet] = useState(false);

  const handleOpenNoteColorSheet = useCallback(() => {
    if (!onChangeNoteColor) {
      return;
    }

    setShowNoteColorSheet(true);
  }, [onChangeNoteColor]);

  const handleCloseNoteColorSheet = useCallback(() => {
    setShowNoteColorSheet(false);
  }, []);

  const handleOpenRadiusSheet = useCallback(() => {
    setShowRadiusSheet(true);
  }, []);

  const handleCloseRadiusSheet = useCallback(() => {
    setShowRadiusSheet(false);
  }, []);

  const handleSelectNoteColor = useCallback(
    (nextColor: string | null) => {
      if (!onChangeNoteColor) {
        return;
      }

      onHaptic();
      onChangeNoteColor(nextColor ?? DEFAULT_NOTE_COLOR_ID);
      setShowNoteColorSheet(false);
    },
    [onChangeNoteColor, onHaptic]
  );

  const handleSelectRadius = useCallback(
    (nextRadius: number) => {
      onHaptic();
      onChangeRadius(nextRadius);
      setShowRadiusSheet(false);
    },
    [onChangeRadius, onHaptic]
  );

  const handlePressLockedNoteColor = useCallback(
    (colorId: string) => {
      onHaptic();
      onPressLockedNoteColor?.(colorId);
    },
    [onHaptic, onPressLockedNoteColor]
  );

  useEffect(() => {
    if (captureMode !== 'text' || !onChangeNoteColor) {
      setShowNoteColorSheet(false);
    }
  }, [captureMode, onChangeNoteColor]);

  useEffect(() => {
    if (isSearching) {
      setShowRadiusSheet(false);
    }
  }, [isSearching]);

  return useMemo(
    () => ({
      handleCloseNoteColorSheet,
      handleCloseRadiusSheet,
      handleOpenNoteColorSheet,
      handleOpenRadiusSheet,
      handlePressLockedNoteColor,
      handleSelectNoteColor,
      handleSelectRadius,
      showNoteColorSheet,
      showRadiusSheet,
    }),
    [
      handleCloseNoteColorSheet,
      handleCloseRadiusSheet,
      handleOpenNoteColorSheet,
      handleOpenRadiusSheet,
      handlePressLockedNoteColor,
      handleSelectNoteColor,
      handleSelectRadius,
      showNoteColorSheet,
      showRadiusSheet,
    ]
  );
}

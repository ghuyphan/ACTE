import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import {
  renderStickerSourceSheetStampIcon,
  renderStickerSourceSheetStickerIcon,
} from '../../components/sheets/StickerSourceSheet';
import type { StickerSourceAction } from './stickerFlowTypes';

const STICKER_SOURCE_SHEET_DISMISS_DELAY_MS = 250;

type StickerSourceIntent = 'sticker' | 'stamp' | 'stamp-cut';

interface UseStickerSourceSheetFlowOptions {
  dismissOverlay: () => void;
  dismissPastePrompt: () => void;
  enablePhotoStickers: boolean;
  handlePasteStickerFromClipboard: () => Promise<void>;
  handlePrepareStickerCutoutPreview: () => Promise<void>;
  handlePrepareStampCutout: () => Promise<void>;
  handlePrepareStampPreview: () => Promise<void>;
  importingSticker: boolean;
  refreshStickerSourceClipboardAvailability: () => void;
  stickerSourceCanPasteFromClipboard: boolean;
  t: TFunction;
}

export function useStickerSourceSheetFlow({
  dismissOverlay,
  dismissPastePrompt,
  enablePhotoStickers,
  handlePasteStickerFromClipboard,
  handlePrepareStickerCutoutPreview,
  handlePrepareStampCutout,
  handlePrepareStampPreview,
  importingSticker,
  refreshStickerSourceClipboardAvailability,
  stickerSourceCanPasteFromClipboard,
  t,
}: UseStickerSourceSheetFlowOptions) {
  const [showStickerSourceSheet, setShowStickerSourceSheet] = useState(false);
  const [pendingStickerSourceAction, setPendingStickerSourceAction] = useState<StickerSourceIntent | null>(null);

  useEffect(() => {
    if (showStickerSourceSheet || !pendingStickerSourceAction) {
      return;
    }

    const timer = setTimeout(() => {
      const nextAction = pendingStickerSourceAction;
      setPendingStickerSourceAction(null);
      if (nextAction === 'stamp-cut') {
        void handlePrepareStampCutout();
        return;
      }

      if (nextAction === 'stamp') {
        void handlePrepareStampPreview();
        return;
      }

      void handlePrepareStickerCutoutPreview();
    }, STICKER_SOURCE_SHEET_DISMISS_DELAY_MS);

    return () => clearTimeout(timer);
  }, [
    handlePrepareStickerCutoutPreview,
    handlePrepareStampCutout,
    handlePrepareStampPreview,
    pendingStickerSourceAction,
    showStickerSourceSheet,
  ]);

  const handleCloseStickerSourceSheet = useCallback(() => {
    setShowStickerSourceSheet(false);
  }, []);

  const handleShowStickerSourceOptions = useCallback(() => {
    if (!enablePhotoStickers || importingSticker) {
      return;
    }

    dismissOverlay();
    dismissPastePrompt();
    setShowStickerSourceSheet(true);
    refreshStickerSourceClipboardAvailability();
  }, [
    dismissOverlay,
    dismissPastePrompt,
    enablePhotoStickers,
    importingSticker,
    refreshStickerSourceClipboardAvailability,
  ]);

  const handleSelectStickerSourceClipboard = useCallback(() => {
    setShowStickerSourceSheet(false);
    void handlePasteStickerFromClipboard();
  }, [handlePasteStickerFromClipboard]);

  const handleSelectStickerSourceIntent = useCallback((intent: StickerSourceIntent) => {
    setPendingStickerSourceAction(intent);
    setShowStickerSourceSheet(false);
    dismissOverlay();
  }, [dismissOverlay]);

  const stickerSourceActions = useMemo<StickerSourceAction[]>(
    () => {
      const actions: StickerSourceAction[] = [
        {
          key: 'create-sticker',
          iconName: 'images-outline',
          renderIcon: renderStickerSourceSheetStickerIcon,
          label: t('capture.createStickerLabel', 'Create sticker'),
          description: t('capture.createStickerDescription', 'Transparent PNG or WebP'),
          onPress: () => handleSelectStickerSourceIntent('sticker'),
          testID: 'sticker-source-option-create-sticker',
        },
        {
          key: 'cut-stamp',
          iconName: 'scan-outline',
          label: t('capture.cutStampLabel', 'Cut stamp'),
          description: t('capture.cutStampDescription', 'Frame just part of a photo inside the cutter'),
          onPress: () => handleSelectStickerSourceIntent('stamp-cut'),
          testID: 'sticker-source-option-cut-stamp',
        },
        {
          key: 'create-stamp',
          iconName: 'pricetag-outline',
          renderIcon: renderStickerSourceSheetStampIcon,
          label: t('capture.createStampLabel', 'Create stamp'),
          description: t('capture.createStampDescription', 'Use the whole photo as a perforated stamp'),
          onPress: () => handleSelectStickerSourceIntent('stamp'),
          testID: 'sticker-source-option-create-stamp',
        },
      ];

      if (stickerSourceCanPasteFromClipboard) {
        actions.push({
          key: 'paste-sticker',
          iconName: 'clipboard-outline',
          label: t('capture.pasteStickerFromClipboard', 'Paste from Clipboard'),
          description: t('capture.clipboardStickerReadyHint', 'Copied image will be added as a sticker.'),
          onPress: handleSelectStickerSourceClipboard,
          testID: 'sticker-source-option-clipboard',
        });
      }

      return actions;
    },
    [
      handleSelectStickerSourceClipboard,
      handleSelectStickerSourceIntent,
      stickerSourceCanPasteFromClipboard,
      t,
    ]
  );

  const hideStickerSourceSheet = useCallback(() => {
    setShowStickerSourceSheet(false);
  }, []);

  const clearStickerSourceSheetFlow = useCallback(() => {
    setShowStickerSourceSheet(false);
    setPendingStickerSourceAction(null);
  }, []);

  return {
    clearStickerSourceSheetFlow,
    handleCloseStickerSourceSheet,
    handleShowStickerSourceOptions,
    hideStickerSourceSheet,
    showStickerSourceSheet,
    stickerSourceActions,
  };
}

export default useStickerSourceSheetFlow;

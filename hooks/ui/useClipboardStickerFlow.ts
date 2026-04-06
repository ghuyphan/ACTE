import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type GestureResponderEvent, Platform } from 'react-native';
import {
  addClipboardListener,
  isPasteButtonAvailable,
  type PasteEventPayload,
  type Subscription,
} from 'expo-clipboard';
import type { TFunction } from 'i18next';
import { showAppAlert } from '../../utils/alert';
import {
  clipboardImageDataHasTransparency,
  ClipboardStickerError,
  hasClipboardStickerImage,
  importStickerAssetFromClipboard,
  importStickerAssetFromClipboardImageData,
} from '../../utils/stickerClipboard';
import {
  createStickerPlacement,
  type NoteStickerPlacement,
} from '../../services/noteStickers';

export type StickerPastePromptState = {
  visible: boolean;
  x: number;
  y: number;
};

interface UseClipboardStickerFlowOptions {
  applyImportedSticker: (nextPlacement: NoteStickerPlacement) => void;
  captureMode: 'text' | 'camera';
  cardSize: number;
  dismissStickerUi: () => void;
  doodleModeEnabled: boolean;
  enablePhotoStickers: boolean;
  importingSticker: boolean;
  interactionsDisabled: boolean;
  isNoteInputFocused: boolean;
  noteText: string;
  runImportingStickerTask: (task: () => Promise<void>) => Promise<void>;
  stickerModeEnabled: boolean;
  stickerPlacements: NoteStickerPlacement[];
  t: TFunction;
}

function getClipboardStickerMessages(t: TFunction) {
  return {
    requiresUpdate: t(
      'capture.clipboardStickerRequiresUpdateMsg',
      'Clipboard sticker paste needs the latest app build. Restart the iOS app after rebuilding to use this.'
    ),
    unavailable: t(
      'capture.clipboardStickerUnavailableMsg',
      'Copy an image first, then try again.'
    ),
    unsupported: t(
      'capture.clipboardStickerUnsupported',
      'We could not read that clipboard image right now.'
    ),
    storageUnavailable: t(
      'capture.clipboardStickerStorageUnavailable',
      'Sticker storage is unavailable on this device.'
    ),
    permissionDenied: t(
      'capture.clipboardStickerPermissionDeniedMsg',
      'This device will not let Noto read that clipboard image right now. Try copying it again, or import it from Photos instead.'
    ),
  };
}

function getClipboardStickerAlertTitle(t: TFunction, error: unknown) {
  if (error instanceof ClipboardStickerError && error.code === 'unavailable') {
    return t('capture.clipboardStickerUnavailableTitle', 'No sticker to paste');
  }

  if (error instanceof ClipboardStickerError && error.code === 'requires-update') {
    return t('capture.clipboardStickerRequiresUpdateTitle', 'Update required');
  }

  if (error instanceof ClipboardStickerError && error.code === 'permission-denied') {
    return t('capture.clipboardStickerPermissionDeniedTitle', 'Paste blocked');
  }

  return t('capture.error', 'Error');
}

function getClipboardStickerTransparencyMessage(t: TFunction) {
  return t(
    'capture.stickerMissingTransparency',
    'If you want a floating sticker, use a transparent PNG or WebP. Regular photos will import as stamps.'
  );
}

export function useClipboardStickerFlow({
  applyImportedSticker,
  captureMode,
  cardSize,
  dismissStickerUi,
  doodleModeEnabled,
  enablePhotoStickers,
  importingSticker,
  interactionsDisabled,
  isNoteInputFocused,
  noteText,
  runImportingStickerTask,
  stickerModeEnabled,
  stickerPlacements,
  t,
}: UseClipboardStickerFlowOptions) {
  const [stickerSourceCanPasteFromClipboard, setStickerSourceCanPasteFromClipboard] = useState(false);
  const [inlinePasteCanPasteFromClipboard, setInlinePasteCanPasteFromClipboard] = useState(false);
  const [inlinePasteLoading, setInlinePasteLoading] = useState(false);
  const [pastePrompt, setPastePrompt] = useState<StickerPastePromptState>({
    visible: false,
    x: cardSize / 2,
    y: cardSize / 2,
  });
  const pastePromptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stickerSourceClipboardRequestIdRef = useRef(0);

  const useNativeInlinePasteButton = Platform.OS === 'ios' && isPasteButtonAvailable;
  const useFallbackInlinePasteButton = Platform.OS === 'android';
  const shouldCheckInlinePasteClipboard =
    enablePhotoStickers &&
    captureMode === 'text' &&
    noteText.length === 0 &&
    !isNoteInputFocused &&
    !doodleModeEnabled &&
    !stickerModeEnabled &&
    !interactionsDisabled &&
    (useNativeInlinePasteButton || useFallbackInlinePasteButton) &&
    !importingSticker;
  const showInlinePasteButton =
    inlinePasteLoading ||
    (shouldCheckInlinePasteClipboard && inlinePasteCanPasteFromClipboard);

  const clearPastePromptTimeout = useCallback(() => {
    if (pastePromptTimeoutRef.current) {
      clearTimeout(pastePromptTimeoutRef.current);
      pastePromptTimeoutRef.current = null;
    }
  }, []);

  const dismissPastePrompt = useCallback(() => {
    clearPastePromptTimeout();
    setPastePrompt((current) => (current.visible ? { ...current, visible: false } : current));
  }, [clearPastePromptTimeout]);

  const schedulePastePromptDismiss = useCallback(() => {
    clearPastePromptTimeout();
    pastePromptTimeoutRef.current = setTimeout(() => {
      setPastePrompt((current) => ({ ...current, visible: false }));
      pastePromptTimeoutRef.current = null;
    }, 2600);
  }, [clearPastePromptTimeout]);

  const showClipboardPasteError = useCallback(
    (error: unknown) => {
      if (!(error instanceof ClipboardStickerError && error.code === 'permission-denied')) {
        console.warn('Sticker paste failed:', error);
      }
      showAppAlert(
        getClipboardStickerAlertTitle(t, error),
        error instanceof Error
          ? error.message
          : t('capture.clipboardStickerFailed', 'We could not paste that sticker right now.')
      );
    },
    [t]
  );

  const handlePasteStickerFromClipboard = useCallback(async () => {
    if (!enablePhotoStickers || importingSticker) {
      return;
    }

    dismissStickerUi();

    await runImportingStickerTask(async () => {
      const importedAsset = await importStickerAssetFromClipboard(getClipboardStickerMessages(t), {
        requiresTransparency: true,
        transparencyRequiredMessage: getClipboardStickerTransparencyMessage(t),
      });
      const nextPlacement = createStickerPlacement(importedAsset, stickerPlacements);
      applyImportedSticker(nextPlacement);
    }).catch((error) => {
      showClipboardPasteError(error);
    });
  }, [
    applyImportedSticker,
    dismissStickerUi,
    enablePhotoStickers,
    importingSticker,
    runImportingStickerTask,
    showClipboardPasteError,
    stickerPlacements,
    t,
  ]);

  const handleNativeInlinePasteStickerPress = useCallback(
    async (payload: PasteEventPayload) => {
      if (!enablePhotoStickers || importingSticker || inlinePasteLoading || payload.type !== 'image') {
        return;
      }

      dismissStickerUi();
      setInlinePasteLoading(true);

      await runImportingStickerTask(async () => {
        if (!clipboardImageDataHasTransparency(payload.data)) {
          throw new ClipboardStickerError(
            'unsupported',
            t(
              'capture.stickerMissingTransparency',
              'If you want a floating sticker, use a transparent PNG or WebP. Regular photos will import as stamps.'
            )
          );
        }

        const importedAsset = await importStickerAssetFromClipboardImageData(
          payload.data,
          getClipboardStickerMessages(t),
          {
            requiresTransparency: true,
            transparencyRequiredMessage: getClipboardStickerTransparencyMessage(t),
          }
        );
        const nextPlacement = createStickerPlacement(importedAsset, stickerPlacements);
        applyImportedSticker(nextPlacement);
      })
        .catch((error) => {
          showClipboardPasteError(error);
        })
        .finally(() => {
          setInlinePasteLoading(false);
        });
    },
    [
      applyImportedSticker,
      dismissStickerUi,
      enablePhotoStickers,
      importingSticker,
      inlinePasteLoading,
      runImportingStickerTask,
      showClipboardPasteError,
      stickerPlacements,
      t,
    ]
  );

  const handleInlinePasteStickerPress = useCallback(() => {
    if (inlinePasteLoading) {
      return;
    }

    setInlinePasteLoading(true);
    void handlePasteStickerFromClipboard().finally(() => {
      setInlinePasteLoading(false);
    });
  }, [handlePasteStickerFromClipboard, inlinePasteLoading]);

  const handleShowCardPastePrompt = useCallback(
    async (event: GestureResponderEvent) => {
      if (!enablePhotoStickers || importingSticker || doodleModeEnabled || stickerModeEnabled || interactionsDisabled) {
        return;
      }

      const locationX = typeof event.nativeEvent.locationX === 'number' ? event.nativeEvent.locationX : cardSize / 2;
      const locationY = typeof event.nativeEvent.locationY === 'number' ? event.nativeEvent.locationY : cardSize / 2;

      const canPasteFromClipboard = await hasClipboardStickerImage();
      if (!canPasteFromClipboard) {
        dismissPastePrompt();
        return;
      }

      setPastePrompt({
        visible: true,
        x: locationX,
        y: locationY,
      });
      schedulePastePromptDismiss();
    },
    [
      cardSize,
      dismissPastePrompt,
      doodleModeEnabled,
      enablePhotoStickers,
      importingSticker,
      interactionsDisabled,
      schedulePastePromptDismiss,
      stickerModeEnabled,
    ]
  );

  const handleConfirmPasteFromPrompt = useCallback(() => {
    dismissPastePrompt();
    void handlePasteStickerFromClipboard();
  }, [dismissPastePrompt, handlePasteStickerFromClipboard]);

  const refreshStickerSourceClipboardAvailability = useCallback(() => {
    setStickerSourceCanPasteFromClipboard(false);

    const requestId = stickerSourceClipboardRequestIdRef.current + 1;
    stickerSourceClipboardRequestIdRef.current = requestId;

    void hasClipboardStickerImage()
      .then((canPasteFromClipboard) => {
        if (stickerSourceClipboardRequestIdRef.current === requestId) {
          setStickerSourceCanPasteFromClipboard(canPasteFromClipboard);
        }
      })
      .catch(() => {
        if (stickerSourceClipboardRequestIdRef.current === requestId) {
          setStickerSourceCanPasteFromClipboard(false);
        }
      });
  }, []);

  useEffect(() => {
    if (!shouldCheckInlinePasteClipboard) {
      setInlinePasteCanPasteFromClipboard(false);
      return;
    }

    let active = true;
    let subscription: Subscription | null = null;

    const syncClipboardAvailability = async () => {
      const canPasteFromClipboard = await hasClipboardStickerImage();
      if (active) {
        setInlinePasteCanPasteFromClipboard(canPasteFromClipboard);
      }
    };

    void syncClipboardAvailability();
    subscription = addClipboardListener(() => {
      void syncClipboardAvailability();
    });

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [shouldCheckInlinePasteClipboard]);

  useEffect(() => () => clearPastePromptTimeout(), [clearPastePromptTimeout]);

  return useMemo(
    () => ({
      dismissPastePrompt,
      handleConfirmPasteFromPrompt,
      handleInlinePasteStickerPress,
      handleNativeInlinePasteStickerPress,
      handlePasteStickerFromClipboard,
      handleShowCardPastePrompt,
      inlinePasteLoading,
      pastePrompt,
      refreshStickerSourceClipboardAvailability,
      showInlinePasteButton,
      stickerSourceCanPasteFromClipboard,
      useNativeInlinePasteButton,
    }),
    [
      dismissPastePrompt,
      handleConfirmPasteFromPrompt,
      handleInlinePasteStickerPress,
      handleNativeInlinePasteStickerPress,
      handlePasteStickerFromClipboard,
      handleShowCardPastePrompt,
      inlinePasteLoading,
      pastePrompt,
      refreshStickerSourceClipboardAvailability,
      showInlinePasteButton,
      stickerSourceCanPasteFromClipboard,
      useNativeInlinePasteButton,
    ]
  );
}

export default useClipboardStickerFlow;

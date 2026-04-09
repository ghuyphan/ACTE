import { useCallback, useEffect, useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import type { TFunction } from 'i18next';
import { showAppAlert } from '../../utils/alert';
import {
  createStickerPlacement,
  importStickerAsset,
  type NoteStickerPlacement,
  shouldImportSourceDirectlyAsSticker,
  type StickerImportSource,
  StickerImportError,
} from '../../services/noteStickers';
import {
  cleanupSubjectCutoutImportSource,
  createStickerImportSourceFromSubjectCutout,
  getSubjectCutoutErrorLogDetails,
  prepareStickerSubjectCutout,
  SubjectCutoutError,
} from '../../services/stickerSubjectCutout';
import {
  useClipboardStickerFlow,
} from '../../hooks/ui/useClipboardStickerFlow';
import { useSelectedStickerActionsFlow } from '../../hooks/ui/useSelectedStickerActionsFlow';
import { useStickerSourceSheetFlow } from '../../hooks/ui/useStickerSourceSheetFlow';
import { useStampCutterFlow } from '../../hooks/ui/useStampCutterFlow';

type StickerImportIntent = 'sticker' | 'stamp';
type PickedStickerImportSource = {
  source: StickerImportSource;
  width: number | null;
  height: number | null;
};

export type { StickerPastePromptState } from '../../hooks/ui/useClipboardStickerFlow';
export type { StickerAction, StickerSourceAction } from '../../hooks/ui/stickerFlowTypes';

interface ImportStickerFromSourceOptions {
  apply?: boolean;
}

interface UseCaptureCardStickerFlowOptions {
  captureMode: 'text' | 'camera';
  t: TFunction;
  stickerPlacements: NoteStickerPlacement[];
  selectedStickerId: string | null;
  doodleModeEnabled: boolean;
  stickerModeEnabled: boolean;
  interactionsDisabled: boolean;
  isNoteInputFocused: boolean;
  noteText: string;
  applyImportedSticker: (nextPlacement: NoteStickerPlacement) => void;
  dismissOverlay: () => void;
  toggleStickerMode: () => void;
  selectSticker: (nextId: string | null) => void;
  enablePhotoStickers: boolean;
  onChangeStickerPlacements?: (nextPlacements: NoteStickerPlacement[]) => void;
  cardSize?: number;
}

function getStickerImportErrorMessage(t: TFunction, error: unknown) {
  if (error instanceof SubjectCutoutError) {
    if (error.code === 'platform-unavailable') {
      return t(
        'capture.stickerCutoutPlatformUnavailable',
        'Foreground cutout is not available on this device yet. You can still import it as a stamp.'
      );
    }

    if (error.code === 'module-unavailable') {
      return t(
        'capture.stickerCutoutUnavailable',
        'Foreground cutout is unavailable in this app build. You can still import it as a stamp.'
      );
    }

    if (error.code === 'model-unavailable') {
      return t(
        'capture.stickerCutoutModelUnavailable',
        'The on-device cutout model is still getting ready. Try again in a moment, or import this image as a stamp.'
      );
    }

    if (error.code === 'no-subject') {
      return t(
        'capture.stickerCutoutNoSubject',
        'We could not find a clear foreground subject in that image. You can still import it as a stamp.'
      );
    }

    if (error.code === 'source-unavailable') {
      return t(
        'capture.stickerFileUnavailable',
        'Sticker file is not available on this device.'
      );
    }

    return t(
      'capture.stickerCutoutFailed',
      'We could not isolate the subject from that image. You can still import it as a stamp.'
    );
  }

  if (error instanceof StickerImportError) {
    if (error.code === 'unsupported-format') {
      return t(
        'capture.stickerUnsupportedFormat',
        'Please import a PNG, WebP, JPEG, or HEIC image.'
      );
    }

    if (error.code === 'file-unavailable') {
      return t(
        'capture.stickerFileUnavailable',
        'Sticker file is not available on this device.'
      );
    }

    if (error.code === 'missing-transparency') {
      return t(
        'capture.stickerMissingTransparency',
        'If you want a floating sticker, use a transparent PNG or WebP. Regular photos will import as stamps.'
      );
    }
  }

  return error instanceof Error
    ? error.message
    : t('capture.photoImportFailed', 'We could not import that photo right now.');
}

function shouldOfferStampFallback(error: unknown) {
  return (
    error instanceof SubjectCutoutError &&
    (
      error.code === 'module-unavailable' ||
      error.code === 'platform-unavailable' ||
      error.code === 'model-unavailable' ||
      error.code === 'no-subject' ||
      error.code === 'processing-failed'
    )
  );
}

function logStickerImportFailure(
  stage: string,
  source: StickerImportSource,
  intent: StickerImportIntent,
  error: unknown
) {
  console.warn('[stickers] import failed', {
    stage,
    intent,
    sourceUri: source.uri,
    mimeType: source.mimeType ?? null,
    name: source.name ?? null,
    error: getSubjectCutoutErrorLogDetails(error),
  });
}

export function useCaptureCardStickerFlow({
  captureMode,
  t,
  stickerPlacements,
  selectedStickerId,
  doodleModeEnabled,
  stickerModeEnabled,
  interactionsDisabled,
  isNoteInputFocused,
  noteText,
  applyImportedSticker,
  dismissOverlay,
  toggleStickerMode,
  selectSticker,
  enablePhotoStickers,
  onChangeStickerPlacements,
  cardSize = 0,
}: UseCaptureCardStickerFlowOptions) {
  const [importingSticker, setImportingSticker] = useState(false);

  const dismissStickerUi = useCallback(() => {
    dismissOverlay();
  }, [dismissOverlay]);

  const runImportingStickerTask = useCallback(async <T,>(task: () => Promise<T>): Promise<T> => {
    setImportingSticker(true);
    try {
      return await task();
    } finally {
      setImportingSticker(false);
    }
  }, []);

  const showStickerTaskError = useCallback(
    (error: unknown) => {
      showAppAlert(
        t('capture.error', 'Error'),
        getStickerImportErrorMessage(t, error)
      );
    },
    [t]
  );

  const reportStickerImportError = useCallback(
    (
      stage: string,
      source: StickerImportSource,
      intent: StickerImportIntent,
      error: unknown
    ) => {
      logStickerImportFailure(stage, source, intent, error);
      showStickerTaskError(error);
    },
    [showStickerTaskError]
  );

  const clipboardFlow = useClipboardStickerFlow({
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
  });
  const {
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
  } = clipboardFlow;

  const importStickerFromSource = useCallback(
    async (
      source: StickerImportSource,
      intent: StickerImportIntent,
      options: ImportStickerFromSourceOptions = {}
    ) => {
      let preparedSource = source;
      let cleanupUri: string | null = null;

      try {
        const shouldBypassSubjectCutout =
          intent === 'sticker' && (await shouldImportSourceDirectlyAsSticker(source));

        if (intent === 'sticker' && !shouldBypassSubjectCutout) {
          let cutoutSource;
          try {
            cutoutSource = await createStickerImportSourceFromSubjectCutout(source);
          } catch (error) {
            if (error instanceof SubjectCutoutError && error.code === 'model-unavailable') {
              logStickerImportFailure('cutout-first-attempt', source, intent, error);
              await prepareStickerSubjectCutout().catch(() => undefined);
              cutoutSource = await createStickerImportSourceFromSubjectCutout(source);
            } else {
              throw error;
            }
          }
          preparedSource = cutoutSource.source;
          cleanupUri = cutoutSource.cleanupUri;
        }

        const importedAsset = await importStickerAsset(
          preparedSource,
          intent === 'sticker' ? { requiresTransparency: true } : undefined
        );
        const nextPlacement = createStickerPlacement(
          importedAsset,
          stickerPlacements,
          intent === 'stamp' ? { renderMode: 'stamp' } : undefined
        );
        if (options.apply !== false) {
          applyImportedSticker(nextPlacement);
        }

        return nextPlacement;
      } finally {
        await cleanupSubjectCutoutImportSource(cleanupUri);
      }
    },
    [applyImportedSticker, stickerPlacements]
  );

  const pickStickerImportSource = useCallback(
    async (): Promise<PickedStickerImportSource | null> => {
      let mediaPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (mediaPermission.status !== 'granted') {
        mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      }

      if (mediaPermission.status !== 'granted') {
        showAppAlert(
          t('capture.photoLibraryPermissionTitle', 'Photo access needed'),
          mediaPermission.canAskAgain === false
            ? t(
              'capture.photoLibraryPermissionSettingsMsg',
              'Photo library access is blocked for Noto. Open Settings to import from your library.'
            )
            : t(
              'capture.photoLibraryPermissionMsg',
              'Allow photo library access so you can import an image into this note.'
            )
        );
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        selectionLimit: 1,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return null;
      }

      const selectedAsset = result.assets[0];
      return {
        source: {
          uri: selectedAsset.uri,
          mimeType: selectedAsset.mimeType,
          name: selectedAsset.fileName,
        },
        width: typeof selectedAsset.width === 'number' ? selectedAsset.width : null,
        height: typeof selectedAsset.height === 'number' ? selectedAsset.height : null,
      };
    },
    [t]
  );

  const handleImportSticker = useCallback(
    async (intent: StickerImportIntent = 'sticker') => {
      if (!enablePhotoStickers || importingSticker) {
        return;
      }

      dismissStickerUi();

      await runImportingStickerTask(async () => {
        const pickedSource = await pickStickerImportSource();
        if (!pickedSource) {
          return;
        }

        try {
          await importStickerFromSource(pickedSource.source, intent);
        } catch (error) {
          logStickerImportFailure('import-sticker', pickedSource.source, intent, error);
          if (shouldOfferStampFallback(error)) {
            showAppAlert(
              t('capture.stickerCutoutFallbackTitle', 'Could not make a sticker'),
              getStickerImportErrorMessage(t, error),
              [
                {
                  text: t('capture.cancel', 'Cancel'),
                  style: 'cancel',
                },
                {
                  text: t('capture.importAsStamp', 'Import as stamp'),
                  onPress: () => {
                    setImportingSticker(true);
                    void importStickerFromSource(pickedSource.source, 'stamp')
                      .catch((stampError) => {
                        logStickerImportFailure('stamp-fallback', pickedSource.source, 'stamp', stampError);
                        showAppAlert(
                          t('capture.error', 'Error'),
                          getStickerImportErrorMessage(t, stampError)
                        );
                      })
                      .finally(() => {
                        setImportingSticker(false);
                      });
                  },
                },
              ]
            );
            return;
          }

          throw error;
        }
      }).catch((error) => {
        reportStickerImportError(
          'handle-import-sticker',
          {
            uri: 'unknown',
            mimeType: null,
            name: null,
          },
          intent,
          error
        );
      });
    },
    [
      dismissStickerUi,
      enablePhotoStickers,
      importStickerFromSource,
      importingSticker,
      pickStickerImportSource,
      reportStickerImportError,
      runImportingStickerTask,
      t,
    ]
  );

  const {
    clearStampCutterDraft,
    handleCloseStampCutterEditor,
    handleConfirmStampCutter,
    handlePrepareStampCutout,
    showStampCutterEditor,
    stampCutterDraft,
  } = useStampCutterFlow({
    dismissStickerUi,
    enablePhotoStickers,
    getErrorMessage: (error) => getStickerImportErrorMessage(t, error),
    importStickerFromSource,
    importingSticker,
    pickStickerImportSource,
    runImportingStickerTask,
    t,
  });

  const handleCompleteStampCutterPlacement = useCallback(
    (placement: NoteStickerPlacement) => {
      applyImportedSticker(placement);
    },
    [applyImportedSticker]
  );

  const {
    clearStickerSourceSheetFlow,
    handleCloseStickerSourceSheet,
    handleShowStickerSourceOptions,
    hideStickerSourceSheet,
    showStickerSourceSheet,
    stickerSourceActions,
  } = useStickerSourceSheetFlow({
    dismissOverlay,
    dismissPastePrompt,
    enablePhotoStickers,
    handleImportSticker,
    handlePasteStickerFromClipboard,
    handlePrepareStampCutout,
    importingSticker,
    refreshStickerSourceClipboardAvailability,
    stickerSourceCanPasteFromClipboard,
    t,
  });

  const {
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
  } = useSelectedStickerActionsFlow({
    dismissOverlay,
    dismissStickerUi,
    onChangeStickerPlacements,
    selectSticker,
    selectedStickerId,
    stickerPlacements,
    toggleStickerMode,
  });

  const closeStickerOverlays = useCallback(() => {
    dismissPastePrompt();
    clearStickerSourceSheetFlow();
    hideStickerActionsSheet();
    clearStampCutterDraft();
    dismissOverlay();
  }, [
    clearStampCutterDraft,
    clearStickerSourceSheetFlow,
    dismissOverlay,
    dismissPastePrompt,
    hideStickerActionsSheet,
  ]);

  useEffect(() => {
    if (importingSticker || interactionsDisabled || stampCutterDraft) {
      hideStickerSourceSheet();
    }
  }, [hideStickerSourceSheet, importingSticker, interactionsDisabled, stampCutterDraft]);

  useEffect(() => {
    if (
      doodleModeEnabled ||
      stickerModeEnabled ||
      importingSticker ||
      interactionsDisabled ||
      stampCutterDraft
    ) {
      dismissPastePrompt();
    }
  }, [
    dismissPastePrompt,
    doodleModeEnabled,
    importingSticker,
    interactionsDisabled,
    stampCutterDraft,
    stickerModeEnabled,
  ]);

  return useMemo(
    () => ({
      importingSticker,
      inlinePasteLoading,
      showInlinePasteButton,
      useNativeInlinePasteButton,
      pastePrompt,
      dismissPastePrompt,
      handleShowCardPastePrompt,
      handleConfirmPasteFromPrompt,
      handleInlinePasteStickerPress,
      handleNativeInlinePasteStickerPress,
      showStickerSourceSheet,
      handleCloseStickerSourceSheet,
      handleCloseStampCutterEditor,
      handleCompleteStampCutterPlacement,
      handleConfirmStampCutter,
      handleShowStickerSourceOptions,
      stickerSourceActions,
      showStampCutterEditor,
      stampCutterDraft,
      showStickerActionsSheet,
      handleCloseStickerActionsSheet,
      handleShowStickerActions,
      handleToggleStickerMode,
      handleSelectSticker,
      handleSelectedStickerAction,
      closeStickerOverlays,
      selectedStickerPlacement,
      selectedStickerIsStamp,
      selectedStickerMotionLocked,
      selectedStickerOutlineEnabled,
    }),
    [
      closeStickerOverlays,
      dismissPastePrompt,
      handleCloseStickerActionsSheet,
      handleCloseStampCutterEditor,
      handleCompleteStampCutterPlacement,
      handleCloseStickerSourceSheet,
      handleConfirmStampCutter,
      handleConfirmPasteFromPrompt,
      handleInlinePasteStickerPress,
      handleNativeInlinePasteStickerPress,
      handleSelectSticker,
      handleSelectedStickerAction,
      handleShowCardPastePrompt,
      handleShowStickerActions,
      handleShowStickerSourceOptions,
      handleToggleStickerMode,
      importingSticker,
      inlinePasteLoading,
      pastePrompt,
      selectedStickerIsStamp,
      selectedStickerMotionLocked,
      selectedStickerOutlineEnabled,
      selectedStickerPlacement,
      showInlinePasteButton,
      showStickerActionsSheet,
      showStampCutterEditor,
      showStickerSourceSheet,
      stampCutterDraft,
      stickerSourceActions,
      useNativeInlinePasteButton,
    ]
  );
}

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type GestureResponderEvent, Platform } from 'react-native';
import {
  addClipboardListener,
  isPasteButtonAvailable,
  type PasteEventPayload,
  type Subscription,
} from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import type { TFunction } from 'i18next';
import { showAppAlert } from '../../utils/alert';
import {
  renderStickerSourceSheetStampIcon,
  renderStickerSourceSheetStickerIcon,
} from '../sheets/StickerSourceSheet';
import {
  clipboardImageDataHasTransparency,
  ClipboardStickerError,
  hasClipboardStickerImage,
  importStickerAssetFromClipboard,
  importStickerAssetFromClipboardImageData,
} from '../../utils/stickerClipboard';
import {
  bringStickerPlacementToFront,
  createStickerPlacement,
  duplicateStickerPlacement,
  importStickerAsset,
  setStickerPlacementMotionLocked,
  setStickerPlacementOutlineEnabled,
  setStickerPlacementRenderMode,
  updateStickerPlacementTransform,
  type NoteStickerPlacement,
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
  exportStampCutoutImageSource,
  prepareStampCutterDraft,
  type StampCutterDraft,
  type StampCutterTransform,
} from '../../services/stampCutter';

const STICKER_SOURCE_SHEET_DISMISS_DELAY_MS = 250;

type StickerImportIntent = 'sticker' | 'stamp';
type StickerSourceIntent = StickerImportIntent | 'stamp-cut';
type PickedStickerImportSource = {
  source: StickerImportSource;
  width: number | null;
  height: number | null;
};

export type StickerPastePromptState = {
  visible: boolean;
  x: number;
  y: number;
};

export type StickerSourceAction = {
  key: string;
  iconName: 'images-outline' | 'pricetag-outline' | 'clipboard-outline' | 'scan-outline';
  renderIcon?: ({ color, size }: { color: string; size: number }) => ReactNode;
  label: string;
  description: string;
  onPress: () => void;
  testID: string;
};

export type StickerAction =
  | 'rotate-left'
  | 'rotate-right'
  | 'smaller'
  | 'larger'
  | 'duplicate'
  | 'front'
  | 'remove'
  | 'outline-toggle'
  | 'motion-lock-toggle'
  | 'stamp-toggle';

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
  const [showStickerSourceSheet, setShowStickerSourceSheet] = useState(false);
  const [showStickerActionsSheet, setShowStickerActionsSheet] = useState(false);
  const [pendingStickerSourceAction, setPendingStickerSourceAction] = useState<StickerSourceIntent | null>(null);
  const [stampCutterDraft, setStampCutterDraft] = useState<StampCutterDraft | null>(null);
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
  const subjectCutoutPrewarmRequestedRef = useRef(false);
  const stampCutterCleanupUriRef = useRef<string | null>(null);

  const useNativeInlinePasteButton = Platform.OS === 'ios' && isPasteButtonAvailable;
  const useFallbackInlinePasteButton = Platform.OS === 'android';
  const selectedStickerPlacement = useMemo(
    () => stickerPlacements.find((placement) => placement.id === selectedStickerId) ?? null,
    [selectedStickerId, stickerPlacements]
  );
  const selectedStickerIsStamp = selectedStickerPlacement?.renderMode === 'stamp';
  const selectedStickerOutlineEnabled = selectedStickerPlacement?.outlineEnabled !== false;
  const selectedStickerMotionLocked = selectedStickerPlacement?.motionLocked === true;

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
  const hasStampCutterDraft = Boolean(stampCutterDraft);

  useEffect(() => {
    stampCutterCleanupUriRef.current = stampCutterDraft?.cleanupUri ?? null;
  }, [stampCutterDraft?.cleanupUri]);

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

  const importStickerFromSource = useCallback(
    async (source: StickerImportSource, intent: StickerImportIntent) => {
      let preparedSource = source;
      let cleanupUri: string | null = null;

      try {
        if (intent === 'sticker') {
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
        applyImportedSticker(nextPlacement);
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

      dismissOverlay();
      dismissPastePrompt();

      setImportingSticker(true);
      try {
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
      } catch (error) {
        logStickerImportFailure(
          'handle-import-sticker',
          {
            uri: 'unknown',
            mimeType: null,
            name: null,
          },
          intent,
          error
        );
        showAppAlert(t('capture.error', 'Error'), getStickerImportErrorMessage(t, error));
      } finally {
        setImportingSticker(false);
      }
    },
    [
      dismissOverlay,
      dismissPastePrompt,
      enablePhotoStickers,
      importStickerFromSource,
      importingSticker,
      pickStickerImportSource,
      t,
    ]
  );

  const handlePrepareStampCutout = useCallback(async () => {
    if (!enablePhotoStickers || importingSticker) {
      return;
    }

    dismissOverlay();
    dismissPastePrompt();
    setImportingSticker(true);

    try {
      const pickedSource = await pickStickerImportSource();
      if (!pickedSource) {
        return;
      }

      const preparedDraft = await prepareStampCutterDraft(
        pickedSource.source,
        pickedSource.width,
        pickedSource.height
      );
      setStampCutterDraft(preparedDraft);
    } catch (error) {
      console.warn('[stickers] stamp cutter setup failed', error);
      showAppAlert(
        t('capture.error', 'Error'),
        error instanceof Error
          ? error.message
          : t('capture.photoImportFailed', 'We could not import that photo right now.')
      );
    } finally {
      setImportingSticker(false);
    }
  }, [
    dismissOverlay,
    dismissPastePrompt,
    enablePhotoStickers,
    importingSticker,
    pickStickerImportSource,
    t,
  ]);

  useEffect(() => {
    if (!enablePhotoStickers || subjectCutoutPrewarmRequestedRef.current) {
      return;
    }

    subjectCutoutPrewarmRequestedRef.current = true;
    void prepareStickerSubjectCutout().catch(() => undefined);
  }, [enablePhotoStickers]);

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

      void handleImportSticker(nextAction);
    }, STICKER_SOURCE_SHEET_DISMISS_DELAY_MS);

    return () => clearTimeout(timer);
  }, [handleImportSticker, handlePrepareStampCutout, pendingStickerSourceAction, showStickerSourceSheet]);

  const handlePasteStickerFromClipboard = useCallback(async () => {
    if (!enablePhotoStickers || importingSticker) {
      return;
    }

    dismissOverlay();
    dismissPastePrompt();
    setImportingSticker(true);

    try {
      const importedAsset = await importStickerAssetFromClipboard(getClipboardStickerMessages(t), {
        requiresTransparency: true,
        transparencyRequiredMessage: getClipboardStickerTransparencyMessage(t),
      });
      const nextPlacement = createStickerPlacement(importedAsset, stickerPlacements);
      applyImportedSticker(nextPlacement);
    } catch (error) {
      if (!(error instanceof ClipboardStickerError && error.code === 'permission-denied')) {
        console.warn('Sticker paste failed:', error);
      }
      showAppAlert(
        getClipboardStickerAlertTitle(t, error),
        error instanceof Error
          ? error.message
          : t('capture.clipboardStickerFailed', 'We could not paste that sticker right now.')
      );
    } finally {
      setImportingSticker(false);
    }
  }, [
    applyImportedSticker,
    dismissOverlay,
    dismissPastePrompt,
    enablePhotoStickers,
    importingSticker,
    stickerPlacements,
    t,
  ]);

  const handleNativeInlinePasteStickerPress = useCallback(
    async (payload: PasteEventPayload) => {
      if (!enablePhotoStickers || importingSticker || inlinePasteLoading || payload.type !== 'image') {
        return;
      }

      dismissOverlay();
      dismissPastePrompt();
      setInlinePasteLoading(true);
      setImportingSticker(true);

      try {
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
      } catch (error) {
        if (!(error instanceof ClipboardStickerError && error.code === 'permission-denied')) {
          console.warn('Sticker paste failed:', error);
        }
        showAppAlert(
          getClipboardStickerAlertTitle(t, error),
          error instanceof Error
            ? error.message
            : t('capture.clipboardStickerFailed', 'We could not paste that sticker right now.')
        );
      } finally {
        setImportingSticker(false);
        setInlinePasteLoading(false);
      }
    },
    [
      applyImportedSticker,
      dismissOverlay,
      dismissPastePrompt,
      enablePhotoStickers,
      importingSticker,
      inlinePasteLoading,
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

  const handleCloseStickerSourceSheet = useCallback(() => {
    setShowStickerSourceSheet(false);
  }, []);

  const handleCloseStickerActionsSheet = useCallback(() => {
    setShowStickerActionsSheet(false);
  }, []);

  const handleShowStickerSourceOptions = useCallback(() => {
    if (!enablePhotoStickers || importingSticker) {
      return;
    }

    dismissOverlay();
    dismissPastePrompt();
    setStickerSourceCanPasteFromClipboard(false);
    setShowStickerSourceSheet(true);

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
  }, [dismissOverlay, dismissPastePrompt, enablePhotoStickers, importingSticker]);

  const handleSelectStickerSourceClipboard = useCallback(() => {
    setShowStickerSourceSheet(false);
    void handlePasteStickerFromClipboard();
  }, [handlePasteStickerFromClipboard]);

  const handleSelectStickerSourceSticker = useCallback(() => {
    setPendingStickerSourceAction('sticker');
    setShowStickerSourceSheet(false);
    dismissOverlay();
  }, [dismissOverlay]);

  const handleSelectStickerSourceStamp = useCallback(() => {
    setPendingStickerSourceAction('stamp');
    setShowStickerSourceSheet(false);
    dismissOverlay();
  }, [dismissOverlay]);

  const handleSelectStickerSourceStampCut = useCallback(() => {
    setShowStickerSourceSheet(false);
    dismissOverlay();
    void handlePrepareStampCutout();
  }, [dismissOverlay, handlePrepareStampCutout]);

  const stickerSourceActions = useMemo<StickerSourceAction[]>(
    () => {
      const actions: StickerSourceAction[] = [
        {
          key: 'create-sticker',
          iconName: 'images-outline',
          renderIcon: renderStickerSourceSheetStickerIcon,
          label: t('capture.createStickerLabel', 'Create sticker'),
          description: t('capture.createStickerDescription', 'Transparent PNG or WebP'),
          onPress: handleSelectStickerSourceSticker,
          testID: 'sticker-source-option-create-sticker',
        },
        {
          key: 'cut-stamp',
          iconName: 'scan-outline',
          label: t('capture.cutStampLabel', 'Cut stamp'),
          description: t('capture.cutStampDescription', 'Frame just part of a photo inside the cutter'),
          onPress: handleSelectStickerSourceStampCut,
          testID: 'sticker-source-option-cut-stamp',
        },
        {
          key: 'create-stamp',
          iconName: 'pricetag-outline',
          renderIcon: renderStickerSourceSheetStampIcon,
          label: t('capture.createStampLabel', 'Create stamp'),
          description: t('capture.createStampDescription', 'Use the whole photo as a perforated stamp'),
          onPress: handleSelectStickerSourceStamp,
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
      handleSelectStickerSourceStampCut,
      handleSelectStickerSourceStamp,
      handleSelectStickerSourceSticker,
      stickerSourceCanPasteFromClipboard,
      t,
    ]
  );

  const handleShowStickerActions = useCallback(() => {
    if (!selectedStickerId) {
      return;
    }

    dismissOverlay();
    dismissPastePrompt();
    setShowStickerActionsSheet(true);
  }, [dismissOverlay, dismissPastePrompt, selectedStickerId]);

  const handleSelectedStickerAction = useCallback(
    (action: StickerAction) => {
      if (!selectedStickerId || !onChangeStickerPlacements) {
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
        nextPlacements =
          placement && placement.renderMode !== 'stamp'
            ? setStickerPlacementOutlineEnabled(
              currentPlacements,
              selectedStickerId,
              placement.outlineEnabled === false
            )
            : currentPlacements;
      } else if (action === 'motion-lock-toggle') {
        nextPlacements = setStickerPlacementMotionLocked(
          currentPlacements,
          selectedStickerId,
          !selectedStickerMotionLocked
        );
      } else if (action === 'stamp-toggle') {
        nextPlacements = setStickerPlacementRenderMode(
          currentPlacements,
          selectedStickerId,
          selectedStickerIsStamp ? 'default' : 'stamp'
        );
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

  const handleCloseStampCutterEditor = useCallback(() => {
    if (importingSticker) {
      return;
    }

    void cleanupSubjectCutoutImportSource(stampCutterCleanupUriRef.current);
    setStampCutterDraft(null);
  }, [importingSticker]);

  const handleConfirmStampCutter = useCallback(
    async ({
      viewportSize,
      selectionRect,
      transform,
    }: {
      viewportSize: { width: number; height: number };
      selectionRect: { x: number; y: number; width: number; height: number };
      transform: StampCutterTransform;
    }) => {
      if (!stampCutterDraft) {
        return;
      }

      setImportingSticker(true);
      let cleanupUri: string | null = null;
      let intermediateCleanupUri: string | null = null;
      const draftCleanupUri = stampCutterDraft.cleanupUri;
      let shouldCloseDraft = false;

      try {
        const exported = await exportStampCutoutImageSource(
          stampCutterDraft,
          viewportSize,
          selectionRect,
          transform
        );
        cleanupUri = exported.cleanupUri;
        intermediateCleanupUri = exported.intermediateCleanupUri ?? null;
        await importStickerFromSource(exported.source, 'stamp');
        shouldCloseDraft = true;
        setStampCutterDraft(null);
      } catch (error) {
        console.warn('[stickers] stamp cutter export failed', error);
        showAppAlert(
          t('capture.error', 'Error'),
          getStickerImportErrorMessage(t, error)
        );
      } finally {
        await cleanupSubjectCutoutImportSource(cleanupUri);
        await cleanupSubjectCutoutImportSource(intermediateCleanupUri);
        if (shouldCloseDraft) {
          await cleanupSubjectCutoutImportSource(draftCleanupUri);
        }
        setImportingSticker(false);
      }
    },
    [importStickerFromSource, stampCutterDraft, t]
  );

  const closeStickerOverlays = useCallback(() => {
    dismissPastePrompt();
    setShowStickerSourceSheet(false);
    setShowStickerActionsSheet(false);
    setPendingStickerSourceAction(null);
    void cleanupSubjectCutoutImportSource(stampCutterCleanupUriRef.current);
    setStampCutterDraft(null);
    dismissOverlay();
  }, [dismissOverlay, dismissPastePrompt]);

  useEffect(() => {
    if (importingSticker || interactionsDisabled || stampCutterDraft) {
      setShowStickerSourceSheet(false);
    }
  }, [importingSticker, interactionsDisabled, stampCutterDraft]);

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

  useEffect(() => {
    if (!selectedStickerId) {
      setShowStickerActionsSheet(false);
    }
  }, [selectedStickerId]);

  useEffect(() => () => clearPastePromptTimeout(), [clearPastePromptTimeout]);

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
      handleConfirmStampCutter,
      handleShowStickerSourceOptions,
      stickerSourceActions,
      showStampCutterEditor: hasStampCutterDraft,
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
      hasStampCutterDraft,
      showInlinePasteButton,
      showStickerActionsSheet,
      showStickerSourceSheet,
      stampCutterDraft,
      stickerSourceActions,
      useNativeInlinePasteButton,
    ]
  );
}

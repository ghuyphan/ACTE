import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { showAppAlert } from '../../utils/alert';
import { useDeferredUriCleanup } from './useDeferredUriCleanup';
import {
  createStickerImportSourceFromSubjectCutout,
  prepareStickerSubjectCutout,
  SubjectCutoutError,
} from '../../services/stickerSubjectCutout';
import {
  exportStampCutoutImageSource,
  prepareStampCutterDraft,
  type StampCutterDraft,
  type StampCutterTransform,
} from '../../services/stampCutter';
import {
  shouldImportSourceDirectlyAsSticker,
  type NoteStickerPlacement,
  type StickerImportSource,
} from '../../services/noteStickers';
import {
  cleanupStickerTempUri,
  cleanupStickerTempUris,
} from '../../services/stickerTempFiles';

const STAMP_CUTTER_CLEANUP_DELAY_MS = 30000;

interface PickedStickerImportSource {
  source: StickerImportSource;
  width: number | null;
  height: number | null;
}

export interface StickerCutoutPreviewDraft {
  source: StickerImportSource;
  cutoutSource: StickerImportSource;
  width: number;
  height: number;
  cleanupUri: string | null;
  cutoutCleanupUri: string | null;
  backgroundVisible: boolean;
}

type StickerCreationDraft =
  | { kind: 'stamp-cut'; draft: StampCutterDraft }
  | { kind: 'stamp-preview'; draft: StampCutterDraft }
  | { kind: 'sticker-cutout-preview'; draft: StickerCutoutPreviewDraft };

interface UseStickerCreationFlowOptions {
  dismissStickerUi: () => void;
  enablePhotoStickers: boolean;
  getErrorMessage: (error: unknown) => string;
  importStickerFromSource: (
    source: StickerImportSource,
    intent: 'sticker' | 'stamp',
    options?: {
      apply?: boolean;
    }
  ) => Promise<NoteStickerPlacement>;
  importingSticker: boolean;
  pickStickerImportSource: () => Promise<PickedStickerImportSource | null>;
  runImportingStickerTask: <T>(task: () => Promise<T>) => Promise<T>;
  t: TFunction;
}

function getStickerCreationDraftCleanupUris(draft: StickerCreationDraft | null) {
  if (!draft) {
    return [];
  }

  if (draft.kind === 'sticker-cutout-preview') {
    return [draft.draft.cleanupUri, draft.draft.cutoutCleanupUri];
  }

  return [draft.draft.cleanupUri];
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

export function useStickerCreationFlow({
  dismissStickerUi,
  enablePhotoStickers,
  getErrorMessage,
  importStickerFromSource,
  importingSticker,
  pickStickerImportSource,
  runImportingStickerTask,
  t,
}: UseStickerCreationFlowOptions) {
  const [creationDraft, setCreationDraft] = useState<StickerCreationDraft | null>(null);
  const subjectCutoutPrewarmRequestedRef = useRef(false);
  const creationDraftCleanupUrisRef = useRef<(string | null)[]>([]);
  const { schedule: scheduleStampCutterDraftCleanup } = useDeferredUriCleanup({
    cleanup: cleanupStickerTempUri,
    delayMs: STAMP_CUTTER_CLEANUP_DELAY_MS,
  });

  useEffect(() => {
    creationDraftCleanupUrisRef.current = getStickerCreationDraftCleanupUris(creationDraft);
  }, [creationDraft]);

  const stampCutterDraft = creationDraft?.kind === 'stamp-cut' ? creationDraft.draft : null;
  const stampPreviewDraft = creationDraft?.kind === 'stamp-preview' ? creationDraft.draft : null;
  const stickerCutoutPreviewDraft =
    creationDraft?.kind === 'sticker-cutout-preview' ? creationDraft.draft : null;
  const showStampCutterEditor = Boolean(stampCutterDraft);
  const showStampPreviewEditor = Boolean(stampPreviewDraft);
  const showStickerCutoutPreviewEditor = Boolean(stickerCutoutPreviewDraft);

  const handlePrepareStampCutout = useCallback(async () => {
    if (!enablePhotoStickers || importingSticker) {
      return;
    }

    dismissStickerUi();

    await runImportingStickerTask(async () => {
      const pickedSource = await pickStickerImportSource();
      if (!pickedSource) {
        return;
      }

      const preparedDraft = await prepareStampCutterDraft(
        pickedSource.source,
        pickedSource.width,
        pickedSource.height
      );
      setCreationDraft({ kind: 'stamp-cut', draft: preparedDraft });
    }).catch((error) => {
      console.warn('[stickers] stamp cutter setup failed', error);
      showAppAlert(
        t('capture.error', 'Error'),
        error instanceof Error
          ? error.message
          : t('capture.photoImportFailed', 'We could not import that photo right now.')
      );
    });
  }, [
    dismissStickerUi,
    enablePhotoStickers,
    importingSticker,
    pickStickerImportSource,
    runImportingStickerTask,
    t,
  ]);

  const clearStickerCreationDraft = useCallback(() => {
    creationDraftCleanupUrisRef.current.forEach((cleanupUri) => {
      scheduleStampCutterDraftCleanup(cleanupUri);
    });
    setCreationDraft(null);
  }, [scheduleStampCutterDraftCleanup]);

  const handleCloseStampCutterEditor = useCallback(() => {
    if (importingSticker) {
      return;
    }

    clearStickerCreationDraft();
  }, [clearStickerCreationDraft, importingSticker]);

  const handleCloseStampPreviewEditor = useCallback(() => {
    if (importingSticker) {
      return;
    }

    clearStickerCreationDraft();
  }, [clearStickerCreationDraft, importingSticker]);

  const handleCloseStickerCutoutPreviewEditor = useCallback(() => {
    if (importingSticker) {
      return;
    }

    clearStickerCreationDraft();
  }, [clearStickerCreationDraft, importingSticker]);

  const handlePrepareStampPreview = useCallback(async () => {
    if (!enablePhotoStickers || importingSticker) {
      return;
    }

    dismissStickerUi();

    await runImportingStickerTask(async () => {
      const pickedSource = await pickStickerImportSource();
      if (!pickedSource) {
        return;
      }

      const preparedDraft = await prepareStampCutterDraft(
        pickedSource.source,
        pickedSource.width,
        pickedSource.height
      );
      setCreationDraft({ kind: 'stamp-preview', draft: preparedDraft });
    }).catch((error) => {
      console.warn('[stickers] stamp preview setup failed', error);
      showAppAlert(
        t('capture.error', 'Error'),
        error instanceof Error
          ? error.message
          : t('capture.photoImportFailed', 'We could not import that photo right now.')
      );
    });
  }, [
    dismissStickerUi,
    enablePhotoStickers,
    importingSticker,
    pickStickerImportSource,
    runImportingStickerTask,
    t,
  ]);

  const showStickerCutoutFallback = useCallback(
    (pickedSource: PickedStickerImportSource, error: unknown) => {
      showAppAlert(
        t('capture.stickerCutoutFallbackTitle', 'Could not make a sticker'),
        getErrorMessage(error),
        [
          {
            text: t('capture.cancel', 'Cancel'),
            style: 'cancel',
          },
          {
            text: t('capture.importAsStamp', 'Import as stamp'),
            onPress: () => {
              void runImportingStickerTask(async () => {
                await importStickerFromSource(pickedSource.source, 'stamp');
              }).catch((stampError) => {
                console.warn('[stickers] cutout fallback stamp import failed', stampError);
                showAppAlert(
                  t('capture.error', 'Error'),
                  getErrorMessage(stampError)
                );
              });
            },
          },
        ]
      );
    },
    [getErrorMessage, importStickerFromSource, runImportingStickerTask, t]
  );

  const createCutoutImportSourceWithRetry = useCallback(async (source: StickerImportSource) => {
    try {
      return await createStickerImportSourceFromSubjectCutout(source);
    } catch (error) {
      if (error instanceof SubjectCutoutError && error.code === 'model-unavailable') {
        await prepareStickerSubjectCutout().catch(() => undefined);
        return createStickerImportSourceFromSubjectCutout(source);
      }

      throw error;
    }
  }, []);

  const handlePrepareStickerCutoutPreview = useCallback(async () => {
    if (!enablePhotoStickers || importingSticker) {
      return;
    }

    dismissStickerUi();

    await runImportingStickerTask(async () => {
      const pickedSource = await pickStickerImportSource();
      if (!pickedSource) {
        return;
      }

      let preparedDraft: StampCutterDraft | null = null;

      try {
        const shouldImportDirectly = await shouldImportSourceDirectlyAsSticker(pickedSource.source);
        if (shouldImportDirectly) {
          const fallbackSize =
            typeof pickedSource.width === 'number' &&
            pickedSource.width > 0 &&
            typeof pickedSource.height === 'number' &&
            pickedSource.height > 0
              ? { width: pickedSource.width, height: pickedSource.height }
              : { width: 512, height: 512 };

          setCreationDraft({
            kind: 'sticker-cutout-preview',
            draft: {
              source: pickedSource.source,
              cutoutSource: pickedSource.source,
              width: Math.max(1, fallbackSize.width),
              height: Math.max(1, fallbackSize.height),
              cleanupUri: null,
              cutoutCleanupUri: null,
              backgroundVisible: false,
            },
          });
          return;
        }

        preparedDraft = await prepareStampCutterDraft(
          pickedSource.source,
          pickedSource.width,
          pickedSource.height
        );
        const cutoutSource = await createCutoutImportSourceWithRetry(pickedSource.source);
        setCreationDraft({
          kind: 'sticker-cutout-preview',
          draft: {
            source: preparedDraft.source,
            cutoutSource: cutoutSource.source,
            width: preparedDraft.width,
            height: preparedDraft.height,
            cleanupUri: preparedDraft.cleanupUri,
            cutoutCleanupUri: cutoutSource.cleanupUri,
            backgroundVisible: true,
          },
        });
      } catch (error) {
        await cleanupStickerTempUri(preparedDraft?.cleanupUri);
        console.warn('[stickers] sticker cutout preview setup failed', error);
        if (shouldOfferStampFallback(error)) {
          showStickerCutoutFallback(pickedSource, error);
          return;
        }

        showAppAlert(
          t('capture.error', 'Error'),
          getErrorMessage(error)
        );
      }
    }).catch((error) => {
      console.warn('[stickers] sticker cutout preview setup failed', error);
      showAppAlert(
        t('capture.error', 'Error'),
        getErrorMessage(error)
      );
    });
  }, [
    createCutoutImportSourceWithRetry,
    dismissStickerUi,
    enablePhotoStickers,
    getErrorMessage,
    importingSticker,
    pickStickerImportSource,
    runImportingStickerTask,
    showStickerCutoutFallback,
    t,
  ]);

  const handleConfirmStampCutter = useCallback(
    async ({
      viewportSize,
      selectionRect,
      transform,
    }: {
      viewportSize: { width: number; height: number };
      selectionRect: { x: number; y: number; width: number; height: number };
      transform: StampCutterTransform;
    }): Promise<NoteStickerPlacement | null> => {
      if (!stampCutterDraft) {
        return null;
      }

      return runImportingStickerTask(async () => {
        let cleanupUri: string | null = null;
        let intermediateCleanupUri: string | null = null;

        try {
          const exported = await exportStampCutoutImageSource(
            stampCutterDraft,
            viewportSize,
            selectionRect,
            transform
          );
          cleanupUri = exported.cleanupUri;
          intermediateCleanupUri = exported.intermediateCleanupUri ?? null;
          return await importStickerFromSource(exported.source, 'stamp', {
            apply: false,
          });
        } catch (error) {
          console.warn('[stickers] stamp cutter export failed', error);
          showAppAlert(
            t('capture.error', 'Error'),
            getErrorMessage(error)
          );
          return null;
        } finally {
          await cleanupStickerTempUris([cleanupUri, intermediateCleanupUri]);
        }
      });
    },
    [
      getErrorMessage,
      importStickerFromSource,
      runImportingStickerTask,
      stampCutterDraft,
      t,
    ]
  );

  const handleConfirmStampPreview = useCallback(async (): Promise<NoteStickerPlacement | null> => {
    if (!stampPreviewDraft) {
      return null;
    }

    return runImportingStickerTask(async () => {
      try {
        return await importStickerFromSource(stampPreviewDraft.source, 'stamp', {
          apply: false,
        });
      } catch (error) {
        console.warn('[stickers] stamp preview import failed', error);
        showAppAlert(
          t('capture.error', 'Error'),
          getErrorMessage(error)
        );
        return null;
      }
    });
  }, [
    getErrorMessage,
    importStickerFromSource,
    runImportingStickerTask,
    stampPreviewDraft,
    t,
  ]);

  const handleConfirmStickerCutoutPreview = useCallback(
    async ({ outlineEnabled }: { outlineEnabled: boolean }): Promise<NoteStickerPlacement | null> => {
      if (!stickerCutoutPreviewDraft) {
        return null;
      }

      return runImportingStickerTask(async () => {
        try {
          const placement = await importStickerFromSource(
            stickerCutoutPreviewDraft.cutoutSource,
            'sticker',
            { apply: false }
          );
          return outlineEnabled ? placement : { ...placement, outlineEnabled: false };
        } catch (error) {
          console.warn('[stickers] sticker cutout preview import failed', error);
          showAppAlert(
            t('capture.error', 'Error'),
            getErrorMessage(error)
          );
          return null;
        }
      });
    },
    [
      getErrorMessage,
      importStickerFromSource,
      runImportingStickerTask,
      stickerCutoutPreviewDraft,
      t,
    ]
  );

  useEffect(() => {
    if (!enablePhotoStickers || subjectCutoutPrewarmRequestedRef.current) {
      return;
    }

    subjectCutoutPrewarmRequestedRef.current = true;
    void prepareStickerSubjectCutout().catch(() => undefined);
  }, [enablePhotoStickers]);

  return useMemo(
    () => ({
      clearStickerCreationDraft,
      handleCloseStampCutterEditor,
      handleCloseStampPreviewEditor,
      handleCloseStickerCutoutPreviewEditor,
      handleConfirmStampCutter,
      handleConfirmStampPreview,
      handleConfirmStickerCutoutPreview,
      handlePrepareStickerCutoutPreview,
      handlePrepareStampCutout,
      handlePrepareStampPreview,
      showStampCutterEditor,
      showStampPreviewEditor,
      showStickerCutoutPreviewEditor,
      stampCutterDraft,
      stampPreviewDraft,
      stickerCutoutPreviewDraft,
    }),
    [
      clearStickerCreationDraft,
      handleCloseStampCutterEditor,
      handleCloseStampPreviewEditor,
      handleCloseStickerCutoutPreviewEditor,
      handleConfirmStampCutter,
      handleConfirmStampPreview,
      handleConfirmStickerCutoutPreview,
      handlePrepareStickerCutoutPreview,
      handlePrepareStampCutout,
      handlePrepareStampPreview,
      showStampCutterEditor,
      showStampPreviewEditor,
      showStickerCutoutPreviewEditor,
      stampCutterDraft,
      stampPreviewDraft,
      stickerCutoutPreviewDraft,
    ]
  );
}

export default useStickerCreationFlow;

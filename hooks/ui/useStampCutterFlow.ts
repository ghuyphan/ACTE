import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { showAppAlert } from '../../utils/alert';
import { useDeferredUriCleanup } from './useDeferredUriCleanup';
import {
  prepareStickerSubjectCutout,
} from '../../services/stickerSubjectCutout';
import {
  exportStampCutoutImageSource,
  prepareStampCutterDraft,
  type StampCutterDraft,
  type StampCutterTransform,
} from '../../services/stampCutter';
import type { StickerImportSource } from '../../services/noteStickers';
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

interface UseStampCutterFlowOptions {
  dismissStickerUi: () => void;
  enablePhotoStickers: boolean;
  getErrorMessage: (error: unknown) => string;
  importStickerFromSource: (
    source: StickerImportSource,
    intent: 'sticker' | 'stamp'
  ) => Promise<void>;
  importingSticker: boolean;
  pickStickerImportSource: () => Promise<PickedStickerImportSource | null>;
  runImportingStickerTask: (task: () => Promise<void>) => Promise<void>;
  t: TFunction;
}

export function useStampCutterFlow({
  dismissStickerUi,
  enablePhotoStickers,
  getErrorMessage,
  importStickerFromSource,
  importingSticker,
  pickStickerImportSource,
  runImportingStickerTask,
  t,
}: UseStampCutterFlowOptions) {
  const [stampCutterDraft, setStampCutterDraft] = useState<StampCutterDraft | null>(null);
  const subjectCutoutPrewarmRequestedRef = useRef(false);
  const stampCutterCleanupUriRef = useRef<string | null>(null);
  const { schedule: scheduleStampCutterDraftCleanup } = useDeferredUriCleanup({
    cleanup: cleanupStickerTempUri,
    delayMs: STAMP_CUTTER_CLEANUP_DELAY_MS,
  });

  useEffect(() => {
    stampCutterCleanupUriRef.current = stampCutterDraft?.cleanupUri ?? null;
  }, [stampCutterDraft?.cleanupUri]);

  const showStampCutterEditor = Boolean(stampCutterDraft);

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
      setStampCutterDraft(preparedDraft);
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

  const clearStampCutterDraft = useCallback(() => {
    scheduleStampCutterDraftCleanup(stampCutterCleanupUriRef.current);
    setStampCutterDraft(null);
  }, [scheduleStampCutterDraftCleanup]);

  const handleCloseStampCutterEditor = useCallback(() => {
    if (importingSticker) {
      return;
    }

    clearStampCutterDraft();
  }, [clearStampCutterDraft, importingSticker]);

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

      await runImportingStickerTask(async () => {
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
            getErrorMessage(error)
          );
        } finally {
          await cleanupStickerTempUris([cleanupUri, intermediateCleanupUri]);
          if (shouldCloseDraft) {
            scheduleStampCutterDraftCleanup(draftCleanupUri);
          }
        }
      });
    },
    [
      getErrorMessage,
      importStickerFromSource,
      runImportingStickerTask,
      scheduleStampCutterDraftCleanup,
      stampCutterDraft,
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
      clearStampCutterDraft,
      handleCloseStampCutterEditor,
      handleConfirmStampCutter,
      handlePrepareStampCutout,
      showStampCutterEditor,
      stampCutterDraft,
    }),
    [
      clearStampCutterDraft,
      handleCloseStampCutterEditor,
      handleConfirmStampCutter,
      handlePrepareStampCutout,
      showStampCutterEditor,
      stampCutterDraft,
    ]
  );
}

export default useStampCutterFlow;

import type { CaptureDraftState } from '../../../hooks/useCaptureFlow';
import { DEFAULT_NOTE_RADIUS } from '../../../constants/noteRadius';
import type { PhotoFilterId } from '../../../services/photoFilters';
import {
  parseNoteStickerPlacements,
  type NoteStickerPlacement,
} from '../../../services/noteStickers';

export const CAPTURE_DRAFT_STORAGE_KEY = 'noto.capture.home-draft.v1';

export type PersistedCaptureDraft = CaptureDraftState & {
  version: 1;
  noteColor: string | null;
  captureTarget: 'private' | 'shared';
  selectedSharedAudienceUserId: string | null;
  stickerPlacements: NoteStickerPlacement[];
};

export function isPersistableCaptureDraft(
  draft: CaptureDraftState & { stickerPlacements?: readonly NoteStickerPlacement[] }
) {
  if ((draft.stickerPlacements?.length ?? 0) > 0) {
    return true;
  }

  if (draft.captureMode !== 'camera') {
    return draft.noteText.trim().length > 0;
  }

  if (draft.cameraSubmode === 'dual') {
    return Boolean(
      draft.capturedPhoto ||
        (draft.dualPrimaryPhoto && draft.dualPrimaryFacing && !draft.dualSecondaryPhoto)
    );
  }

  return Boolean(draft.capturedPhoto);
}

export function getRequiredPersistedCaptureDraftPhotoUris(draft: PersistedCaptureDraft) {
  if (draft.captureMode !== 'camera') {
    return [];
  }

  return [
    draft.capturedPhoto,
    draft.cameraSubmode === 'dual' ? draft.dualPrimaryPhoto : null,
    draft.cameraSubmode === 'dual' ? draft.dualSecondaryPhoto : null,
  ].filter((value): value is string => Boolean(value?.trim()));
}

export function parsePersistedCaptureDraft(rawValue: string | null): PersistedCaptureDraft | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<PersistedCaptureDraft> | null;
    if (!parsed || parsed.version !== 1) {
      return null;
    }

    const captureMode = parsed.captureMode === 'camera' ? 'camera' : 'text';
    const cameraSubmode = parsed.cameraSubmode === 'dual' ? 'dual' : 'single';
    const noteText = typeof parsed.noteText === 'string' ? parsed.noteText : '';
    const capturedPhoto =
      typeof parsed.capturedPhoto === 'string' && parsed.capturedPhoto.trim().length > 0
        ? parsed.capturedPhoto
        : null;
    const capturedPairedVideo =
      typeof parsed.capturedPairedVideo === 'string' && parsed.capturedPairedVideo.trim().length > 0
        ? parsed.capturedPairedVideo
        : null;
    const dualPrimaryPhoto =
      typeof parsed.dualPrimaryPhoto === 'string' && parsed.dualPrimaryPhoto.trim().length > 0
        ? parsed.dualPrimaryPhoto
        : null;
    const dualSecondaryPhoto =
      typeof parsed.dualSecondaryPhoto === 'string' && parsed.dualSecondaryPhoto.trim().length > 0
        ? parsed.dualSecondaryPhoto
        : null;
    const dualPrimaryFacing =
      parsed.dualPrimaryFacing === 'front'
        ? 'front'
        : parsed.dualPrimaryFacing === 'back'
          ? 'back'
          : null;
    const dualSecondaryFacing =
      parsed.dualSecondaryFacing === 'front'
        ? 'front'
        : parsed.dualSecondaryFacing === 'back'
          ? 'back'
          : null;
    const facing = parsed.facing === 'front' ? 'front' : 'back';
    const radius =
      typeof parsed.radius === 'number' && Number.isFinite(parsed.radius)
        ? parsed.radius
        : DEFAULT_NOTE_RADIUS;
    const selectedPhotoFilterId =
      typeof parsed.selectedPhotoFilterId === 'string'
        ? (parsed.selectedPhotoFilterId as PhotoFilterId)
        : 'original';
    const noteColor = typeof parsed.noteColor === 'string' ? parsed.noteColor : null;
    const captureTarget = parsed.captureTarget === 'shared' ? 'shared' : 'private';
    const selectedSharedAudienceUserId =
      typeof parsed.selectedSharedAudienceUserId === 'string' &&
      parsed.selectedSharedAudienceUserId.trim().length > 0
        ? parsed.selectedSharedAudienceUserId
        : null;
    const stickerPlacements = parseNoteStickerPlacements(
      Array.isArray(parsed.stickerPlacements) ? JSON.stringify(parsed.stickerPlacements) : null
    );

    const normalizedDraft: PersistedCaptureDraft = {
      version: 1,
      captureMode,
      cameraSubmode,
      noteText,
      capturedPhoto,
      capturedPairedVideo,
      dualPrimaryPhoto,
      dualSecondaryPhoto,
      dualPrimaryFacing,
      dualSecondaryFacing,
      facing,
      radius,
      selectedPhotoFilterId,
      noteColor,
      captureTarget,
      selectedSharedAudienceUserId,
      stickerPlacements,
    };

    return isPersistableCaptureDraft(normalizedDraft) ? normalizedDraft : null;
  } catch {
    return null;
  }
}

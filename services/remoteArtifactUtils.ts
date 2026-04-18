import { getPairedVideoFileExtension } from './livePhotoStorage';
import { parseNoteStickerPlacements } from './noteStickers';
import { getUniqueNormalizedStrings, normalizeOptionalString } from './normalizedStrings';

export interface RemoteArtifactSnapshot {
  photoPath?: string | null;
  dualPrimaryPhotoPath?: string | null;
  dualSecondaryPhotoPath?: string | null;
  pairedVideoPath?: string | null;
  stickerPlacementsJson?: string | null;
}

export interface RemoteArtifactDelta {
  photoPath: string | null;
  dualPrimaryPhotoPath: string | null;
  dualSecondaryPhotoPath: string | null;
  pairedVideoPath: string | null;
  stickerPaths: string[];
}

export function getRemotePairedVideoPath(
  basePath: string,
  localUri: string | null | undefined
) {
  return `${basePath}.motion${getPairedVideoFileExtension(localUri)}`;
}

export function normalizeRemoteArtifactPath(path: string | null | undefined) {
  const normalizedPath = normalizeOptionalString(path);
  return normalizedPath || null;
}

export function normalizeRemoteEntityIds(ids: Iterable<string | null | undefined>) {
  return getUniqueNormalizedStrings(ids);
}

export function getRemoteStickerAssetPaths(stickerPlacementsJson: string | null | undefined) {
  return getUniqueNormalizedStrings(
    parseNoteStickerPlacements(stickerPlacementsJson).map(
      (placement) => normalizeRemoteArtifactPath(placement.asset.remotePath)
    )
  );
}

function getChangedArtifactPath(
  nextPath: string | null | undefined,
  previousPath: string | null | undefined
) {
  const normalizedNextPath = normalizeRemoteArtifactPath(nextPath);
  const normalizedPreviousPath = normalizeRemoteArtifactPath(previousPath);
  return normalizedNextPath !== normalizedPreviousPath ? normalizedNextPath : null;
}

export function buildNewRemoteArtifacts(
  next: RemoteArtifactSnapshot,
  previous: RemoteArtifactSnapshot | null | undefined
): RemoteArtifactDelta {
  const previousStickerPaths = new Set(getRemoteStickerAssetPaths(previous?.stickerPlacementsJson));

  return {
    photoPath: getChangedArtifactPath(next.photoPath, previous?.photoPath),
    dualPrimaryPhotoPath: getChangedArtifactPath(
      next.dualPrimaryPhotoPath,
      previous?.dualPrimaryPhotoPath
    ),
    dualSecondaryPhotoPath: getChangedArtifactPath(
      next.dualSecondaryPhotoPath,
      previous?.dualSecondaryPhotoPath
    ),
    pairedVideoPath: getChangedArtifactPath(next.pairedVideoPath, previous?.pairedVideoPath),
    stickerPaths: getRemoteStickerAssetPaths(next.stickerPlacementsJson).filter(
      (path) => !previousStickerPaths.has(path)
    ),
  };
}

export function buildRemovedRemoteArtifacts(
  previous: RemoteArtifactSnapshot | null | undefined,
  next: RemoteArtifactSnapshot | null | undefined
): RemoteArtifactDelta {
  const nextStickerPaths = new Set(getRemoteStickerAssetPaths(next?.stickerPlacementsJson));

  return {
    photoPath: getChangedArtifactPath(previous?.photoPath, next?.photoPath),
    dualPrimaryPhotoPath: getChangedArtifactPath(
      previous?.dualPrimaryPhotoPath,
      next?.dualPrimaryPhotoPath
    ),
    dualSecondaryPhotoPath: getChangedArtifactPath(
      previous?.dualSecondaryPhotoPath,
      next?.dualSecondaryPhotoPath
    ),
    pairedVideoPath: getChangedArtifactPath(previous?.pairedVideoPath, next?.pairedVideoPath),
    stickerPaths: getRemoteStickerAssetPaths(previous?.stickerPlacementsJson).filter(
      (path) => !nextStickerPaths.has(path)
    ),
  };
}

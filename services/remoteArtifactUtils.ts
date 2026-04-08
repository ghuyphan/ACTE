import { getPairedVideoFileExtension } from './livePhotoStorage';
import { parseNoteStickerPlacements } from './noteStickers';

export interface RemoteArtifactSnapshot {
  photoPath?: string | null;
  pairedVideoPath?: string | null;
  stickerPlacementsJson?: string | null;
}

export interface RemoteArtifactDelta {
  photoPath: string | null;
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
  const normalizedPath = typeof path === 'string' ? path.trim() : '';
  return normalizedPath || null;
}

export function normalizeRemoteEntityIds(ids: Iterable<string | null | undefined>) {
  return Array.from(
    new Set(
      Array.from(ids)
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    )
  );
}

export function getRemoteStickerAssetPaths(stickerPlacementsJson: string | null | undefined) {
  return Array.from(
    new Set(
      parseNoteStickerPlacements(stickerPlacementsJson)
        .map((placement) => normalizeRemoteArtifactPath(placement.asset.remotePath))
        .filter((path): path is string => Boolean(path))
    )
  );
}

export function buildNewRemoteArtifacts(
  next: RemoteArtifactSnapshot,
  previous: RemoteArtifactSnapshot | null | undefined
): RemoteArtifactDelta {
  const previousStickerPaths = new Set(getRemoteStickerAssetPaths(previous?.stickerPlacementsJson));
  const nextPhotoPath = normalizeRemoteArtifactPath(next.photoPath);
  const previousPhotoPath = normalizeRemoteArtifactPath(previous?.photoPath);
  const nextPairedVideoPath = normalizeRemoteArtifactPath(next.pairedVideoPath);
  const previousPairedVideoPath = normalizeRemoteArtifactPath(previous?.pairedVideoPath);

  return {
    photoPath: nextPhotoPath !== previousPhotoPath ? nextPhotoPath : null,
    pairedVideoPath: nextPairedVideoPath !== previousPairedVideoPath ? nextPairedVideoPath : null,
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
  const previousPhotoPath = normalizeRemoteArtifactPath(previous?.photoPath);
  const nextPhotoPath = normalizeRemoteArtifactPath(next?.photoPath);
  const previousPairedVideoPath = normalizeRemoteArtifactPath(previous?.pairedVideoPath);
  const nextPairedVideoPath = normalizeRemoteArtifactPath(next?.pairedVideoPath);

  return {
    photoPath: previousPhotoPath !== nextPhotoPath ? previousPhotoPath : null,
    pairedVideoPath: previousPairedVideoPath !== nextPairedVideoPath ? previousPairedVideoPath : null,
    stickerPaths: getRemoteStickerAssetPaths(previous?.stickerPlacementsJson).filter(
      (path) => !nextStickerPaths.has(path)
    ),
  };
}

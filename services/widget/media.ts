import { Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import * as FileSystem from '../../utils/fileSystem';
import { getStickerFileExtension, parseNoteStickerPlacements } from '../noteStickers';
import { resolveStoredPhotoUri } from '../photoStorage';
import { downloadPhotoFromStorage, SHARED_POST_MEDIA_BUCKET } from '../remoteMedia';
import type { WidgetProps } from './contract';
import type { WidgetCandidate } from './selection';

const IOS_WIDGET_APP_GROUP_ID = 'group.com.acte.app';
const WIDGET_IMAGE_DIRECTORY_NAME = 'widget-images';
const WIDGET_AVATAR_DIRECTORY_NAME = 'widget-avatars';
const WIDGET_STICKER_DIRECTORY_NAME = 'widget-stickers';

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function sanitizeWidgetFileExtension(value: string | null | undefined) {
  const normalizedValue = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalizedValue) {
    return null;
  }

  const withoutDot = normalizedValue.startsWith('.') ? normalizedValue.slice(1) : normalizedValue;
  return /^[a-z0-9]{1,5}$/.test(withoutDot) ? withoutDot : null;
}

function getWidgetFileExtensionFromUri(uri: string) {
  const normalizedUri = uri.split(/[?#]/, 1)[0] ?? '';
  const match = normalizedUri.match(/\.([a-zA-Z0-9]{1,5})$/);
  return sanitizeWidgetFileExtension(match?.[1] ?? null);
}

function sanitizeStorageTokenSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getCandidateAssetVersion(candidate: WidgetCandidate) {
  return candidate.updatedAt ?? candidate.createdAt;
}

function buildCandidateAssetPrefix(candidate: WidgetCandidate, assetKind: string, assetId?: string) {
  const segments = [assetKind, sanitizeStorageTokenSegment(candidate.candidateKey)];
  if (assetId) {
    segments.push(sanitizeStorageTokenSegment(assetId));
  }
  return `${segments.join('-')}-`;
}

function buildVersionedFilename(prefix: string, seed: string, extension: string) {
  return `${prefix}${hashString(seed)}.${extension}`;
}

function getWidgetSharedContainerUri(): string | null {
  const containers = Paths.appleSharedContainers ?? {};
  const preferredContainer = containers[IOS_WIDGET_APP_GROUP_ID] ?? Object.values(containers)[0];

  if (!preferredContainer?.uri) {
    return null;
  }

  const uri = preferredContainer.uri.startsWith('file://')
    ? preferredContainer.uri
    : `file://${preferredContainer.uri}`;

  return uri.endsWith('/') ? uri : `${uri}/`;
}

function getWidgetFileContainerUri(): string | null {
  if (Platform.OS === 'ios') {
    return getWidgetSharedContainerUri();
  }

  if (Platform.OS === 'android') {
    return FileSystem.cacheDirectory;
  }

  return null;
}

async function cleanupWidgetFilesWithPrefix(
  destinationDirectory: string,
  filenamePrefix: string,
  keepFileUri: string
) {
  try {
    const entries = await FileSystem.readDirectoryAsync(destinationDirectory);
    const staleEntries = entries.filter(
      (entry) =>
        entry.startsWith(filenamePrefix) && `${destinationDirectory}${entry}` !== keepFileUri
    );

    await Promise.all(
      staleEntries.map((entry) =>
        FileSystem.deleteAsync(`${destinationDirectory}${entry}`, { idempotent: true }).catch(
          () => undefined
        )
      )
    );
  } catch {
    // Ignore cleanup errors for missing or unreadable directories.
  }
}

async function stageFileForWidgetContainer(options: {
  fileUri: string;
  destinationDirectoryName: string;
  filenamePrefix: string;
  versionSeed: string;
  extensionHint?: string | null;
}): Promise<string | undefined> {
  const containerUri = getWidgetFileContainerUri();
  if (!containerUri) {
    return undefined;
  }

  const normalizedFileUri = typeof options.fileUri === 'string' ? options.fileUri.trim() : '';
  if (!normalizedFileUri) {
    return undefined;
  }

  const destinationDirectory = `${containerUri}${options.destinationDirectoryName}/`;
  const resolvedExtension =
    sanitizeWidgetFileExtension(options.extensionHint) ??
    getWidgetFileExtensionFromUri(normalizedFileUri) ??
    'jpg';
  const destinationPath = `${destinationDirectory}${buildVersionedFilename(
    options.filenamePrefix,
    options.versionSeed,
    resolvedExtension
  )}`;

  try {
    await FileSystem.makeDirectoryAsync(destinationDirectory, { intermediates: true });

    const existingInfo = await FileSystem.getInfoAsync(destinationPath);
    if (!existingInfo.exists || existingInfo.isDirectory) {
      await FileSystem.deleteAsync(destinationPath, { idempotent: true });
      if (normalizedFileUri !== destinationPath) {
        await FileSystem.copyAsync({ from: normalizedFileUri, to: destinationPath });
      }
    }

    await cleanupWidgetFilesWithPrefix(destinationDirectory, options.filenamePrefix, destinationPath);
    return destinationPath;
  } catch (error) {
    console.warn('[widgetService] Failed to prepare widget file:', error);
    return undefined;
  }
}

async function downloadRemoteImageToWidgetContainer(options: {
  remoteImageUrl: string;
  destinationDirectoryName: string;
  filenamePrefix: string;
  versionSeed: string;
  extensionHint?: string | null;
}) {
  const containerUri = getWidgetFileContainerUri();
  if (!containerUri) {
    return undefined;
  }

  const normalizedRemoteImageUrl = options.remoteImageUrl.trim();
  if (!normalizedRemoteImageUrl) {
    return undefined;
  }

  const destinationDirectory = `${containerUri}${options.destinationDirectoryName}/`;
  const resolvedExtension =
    sanitizeWidgetFileExtension(options.extensionHint) ??
    getWidgetFileExtensionFromUri(normalizedRemoteImageUrl) ??
    'jpg';
  const destinationPath = `${destinationDirectory}${buildVersionedFilename(
    options.filenamePrefix,
    options.versionSeed,
    resolvedExtension
  )}`;

  try {
    await FileSystem.makeDirectoryAsync(destinationDirectory, { intermediates: true });

    const existingInfo = await FileSystem.getInfoAsync(destinationPath);
    if (existingInfo.exists && !existingInfo.isDirectory) {
      await cleanupWidgetFilesWithPrefix(destinationDirectory, options.filenamePrefix, destinationPath);
      return destinationPath;
    }

    await FileSystem.downloadAsync(normalizedRemoteImageUrl, destinationPath);
    await cleanupWidgetFilesWithPrefix(destinationDirectory, options.filenamePrefix, destinationPath);
    return destinationPath;
  } catch (error) {
    try {
      const fallbackInfo = await FileSystem.getInfoAsync(destinationPath);
      if (fallbackInfo.exists && !fallbackInfo.isDirectory) {
        await cleanupWidgetFilesWithPrefix(destinationDirectory, options.filenamePrefix, destinationPath);
        return destinationPath;
      }
    } catch {
      // Ignore fallback lookup errors.
    }

    console.warn('[widgetService] Failed to download remote widget image:', error);
    return undefined;
  }
}

async function findExistingWidgetFileInContainer(
  directoryName: string,
  filenamePrefix: string
) {
  const containerUri = getWidgetFileContainerUri();
  if (!containerUri) {
    return undefined;
  }

  const directoryUri = `${containerUri}${directoryName}/`;

  try {
    const entries = await FileSystem.readDirectoryAsync(directoryUri);
    const matchingEntry = entries.find((entry) => entry.startsWith(filenamePrefix));
    return matchingEntry ? `${directoryUri}${matchingEntry}` : undefined;
  } catch {
    return undefined;
  }
}

export async function getReadablePhotoUri(photoUri: string): Promise<string | undefined> {
  const normalizedPhotoUri = typeof photoUri === 'string' ? photoUri.trim() : '';
  if (!normalizedPhotoUri) {
    return undefined;
  }

  if (/^https?:\/\//i.test(normalizedPhotoUri)) {
    return normalizedPhotoUri;
  }

  const candidates = Array.from(
    new Set([resolveStoredPhotoUri(normalizedPhotoUri), normalizedPhotoUri].filter(Boolean))
  );

  for (const candidate of candidates) {
    try {
      const info = await FileSystem.getInfoAsync(candidate);
      if (info.exists && !info.isDirectory) {
        return candidate;
      }
    } catch {
      // Try the next candidate.
    }
  }

  console.warn('[widgetService] Widget photo is missing or unreadable:', normalizedPhotoUri);
  return undefined;
}

async function resolveReadablePhotoUriForCandidate(candidate: WidgetCandidate) {
  if (candidate.photoLocalUri?.trim()) {
    const readableLocalUri = await getReadablePhotoUri(candidate.photoLocalUri);
    if (readableLocalUri) {
      return readableLocalUri;
    }
  }

  if (candidate.source !== 'shared' || !candidate.photoPath?.trim()) {
    return undefined;
  }

  const downloadedPhotoUri = await downloadPhotoFromStorage(
    SHARED_POST_MEDIA_BUCKET,
    candidate.photoPath,
    `shared-post-${candidate.id}`
  );

  if (!downloadedPhotoUri) {
    return undefined;
  }

  return getReadablePhotoUri(downloadedPhotoUri);
}

async function resolveReadableDualPhotoUriForCandidate(
  candidate: WidgetCandidate,
  slot: 'primary' | 'secondary'
) {
  const localUri =
    slot === 'primary' ? candidate.dualPrimaryPhotoLocalUri : candidate.dualSecondaryPhotoLocalUri;
  if (localUri?.trim()) {
    const readableLocalUri = await getReadablePhotoUri(localUri);
    if (readableLocalUri) {
      return readableLocalUri;
    }
  }

  const remotePath =
    slot === 'primary' ? candidate.dualPrimaryPhotoPath : candidate.dualSecondaryPhotoPath;
  if (candidate.source !== 'shared' || !remotePath?.trim()) {
    return undefined;
  }

  const downloadedPhotoUri = await downloadPhotoFromStorage(
    SHARED_POST_MEDIA_BUCKET,
    remotePath,
    `shared-post-${candidate.id}-${slot}`
  );

  if (!downloadedPhotoUri) {
    return undefined;
  }

  return getReadablePhotoUri(downloadedPhotoUri);
}

async function stageReadableWidgetImage(options: {
  candidate: WidgetCandidate;
  readablePhotoUri: string;
  assetKind: string;
  assetId?: string;
}) {
  const { candidate, readablePhotoUri, assetKind, assetId } = options;
  const filenamePrefix = buildCandidateAssetPrefix(candidate, assetKind, assetId);
  const versionSeed = `${getCandidateAssetVersion(candidate)}:${assetKind}:${readablePhotoUri}`;
  const extensionHint = getWidgetFileExtensionFromUri(readablePhotoUri);

  if (/^https?:\/\//i.test(readablePhotoUri)) {
    return downloadRemoteImageToWidgetContainer({
      remoteImageUrl: readablePhotoUri,
      destinationDirectoryName: WIDGET_IMAGE_DIRECTORY_NAME,
      filenamePrefix,
      versionSeed,
      extensionHint,
    });
  }

  return stageFileForWidgetContainer({
    fileUri: readablePhotoUri,
    destinationDirectoryName: WIDGET_IMAGE_DIRECTORY_NAME,
    filenamePrefix,
    versionSeed,
    extensionHint,
  });
}

export async function resolveWidgetPhotoProps(
  candidate: WidgetCandidate
): Promise<
  Partial<
    Pick<
    WidgetProps,
    | 'backgroundImageUrl'
    | 'backgroundImageBase64'
    | 'isDualCapture'
    | 'dualInsetImageUrl'
    | 'dualLayoutPreset'
    >
  >
> {
  if (candidate.noteType !== 'photo') {
    return {};
  }

  if (
    candidate.isDualCapture &&
    ((candidate.dualPrimaryPhotoLocalUri?.trim() && candidate.dualSecondaryPhotoLocalUri?.trim()) ||
      (candidate.dualPrimaryPhotoPath?.trim() && candidate.dualSecondaryPhotoPath?.trim()))
  ) {
    const [readablePrimaryUri, readableSecondaryUri] = await Promise.all([
      resolveReadableDualPhotoUriForCandidate(candidate, 'primary'),
      resolveReadableDualPhotoUriForCandidate(candidate, 'secondary'),
    ]);

    if (readablePrimaryUri && readableSecondaryUri) {
      const [stagedPrimaryUri, stagedSecondaryUri] = await Promise.all([
        stageReadableWidgetImage({
          candidate,
          readablePhotoUri: readablePrimaryUri,
          assetKind: 'photo',
          assetId: 'primary',
        }),
        stageReadableWidgetImage({
          candidate,
          readablePhotoUri: readableSecondaryUri,
          assetKind: 'photo-inset',
          assetId: 'secondary',
        }),
      ]);

      if (stagedPrimaryUri && stagedSecondaryUri) {
        return {
          isDualCapture: true,
          backgroundImageUrl: stagedPrimaryUri,
          dualInsetImageUrl: stagedSecondaryUri,
          dualLayoutPreset: candidate.dualLayoutPreset ?? 'top-left',
        };
      }
    }
  }

  const readablePhotoUri = await resolveReadablePhotoUriForCandidate(candidate);
  if (!readablePhotoUri) {
    return {};
  }

  const copiedPhotoUri = await stageReadableWidgetImage({
    candidate,
    readablePhotoUri,
    assetKind: 'photo',
  });
  if (copiedPhotoUri) {
    return {
      isDualCapture: false,
      backgroundImageUrl: copiedPhotoUri,
    };
  }

  return {};
}

export async function resolveWidgetStickerPlacementsJson(candidate: WidgetCandidate) {
  const parsedPlacements = parseNoteStickerPlacements(candidate.stickerPlacementsJson);
  if (parsedPlacements.length === 0) {
    return null;
  }

  const widgetPlacements = await Promise.all(
    parsedPlacements.map(async (placement) => {
      const filenamePrefix = buildCandidateAssetPrefix(candidate, 'sticker', placement.asset.id);
      const versionSeedBase = `${getCandidateAssetVersion(candidate)}:${placement.asset.localUri}:${placement.asset.mimeType ?? ''}`;
      const widgetPlacementBase = {
        ...placement,
        opacity: 1,
      };

      const readableStickerUri = await getReadablePhotoUri(placement.asset.localUri);
      if (!readableStickerUri) {
        const existingStickerUri =
          (await findExistingWidgetFileInContainer(
            WIDGET_STICKER_DIRECTORY_NAME,
            filenamePrefix
          )) ??
          (await findExistingWidgetFileInContainer(
            WIDGET_STICKER_DIRECTORY_NAME,
            `sticker-${candidate.id}-${placement.asset.id}-`
          ));

        return existingStickerUri
          ? {
              ...widgetPlacementBase,
              asset: {
                ...placement.asset,
                localUri: existingStickerUri,
              },
            }
          : widgetPlacementBase;
      }

      if (/^https?:\/\//i.test(readableStickerUri)) {
        const downloadedStickerUri = await downloadRemoteImageToWidgetContainer({
          remoteImageUrl: readableStickerUri,
          destinationDirectoryName: WIDGET_STICKER_DIRECTORY_NAME,
          filenamePrefix,
          versionSeed: `${versionSeedBase}:${readableStickerUri}`,
          extensionHint: getStickerFileExtension(placement.asset.mimeType),
        });

        return downloadedStickerUri
          ? {
              ...widgetPlacementBase,
              asset: {
                ...placement.asset,
                localUri: downloadedStickerUri,
              },
            }
          : widgetPlacementBase;
      }

      const copiedStickerUri = await stageFileForWidgetContainer({
        fileUri: readableStickerUri,
        destinationDirectoryName: WIDGET_STICKER_DIRECTORY_NAME,
        filenamePrefix,
        versionSeed: `${versionSeedBase}:${readableStickerUri}`,
        extensionHint: getStickerFileExtension(placement.asset.mimeType),
      });

      return copiedStickerUri
        ? {
            ...widgetPlacementBase,
            asset: {
              ...placement.asset,
              localUri: copiedStickerUri,
            },
          }
        : widgetPlacementBase;
    })
  );

  return JSON.stringify(widgetPlacements);
}

export async function resolveWidgetAuthorAvatarProps(candidate: WidgetCandidate) {
  if (candidate.source !== 'shared' || !candidate.authorPhotoURLSnapshot?.trim()) {
    return {};
  }

  const readableAvatarUri = await getReadablePhotoUri(candidate.authorPhotoURLSnapshot);
  if (!readableAvatarUri) {
    return {};
  }

  const filenamePrefix = buildCandidateAssetPrefix(candidate, 'author-avatar');
  const versionSeed = `${getCandidateAssetVersion(candidate)}:${readableAvatarUri}`;

  if (/^https?:\/\//i.test(readableAvatarUri)) {
    const downloadedAvatarUri = await downloadRemoteImageToWidgetContainer({
      remoteImageUrl: readableAvatarUri,
      destinationDirectoryName: WIDGET_AVATAR_DIRECTORY_NAME,
      filenamePrefix,
      versionSeed,
    });

    if (downloadedAvatarUri) {
      return {
        authorAvatarImageUrl: downloadedAvatarUri,
      };
    }

    return {};
  }

  const copiedAvatarUri = await stageFileForWidgetContainer({
    fileUri: readableAvatarUri,
    destinationDirectoryName: WIDGET_AVATAR_DIRECTORY_NAME,
    filenamePrefix,
    versionSeed,
    extensionHint: 'jpg',
  });
  if (copiedAvatarUri) {
    return {
      authorAvatarImageUrl: copiedAvatarUri,
    };
  }

  return {};
}

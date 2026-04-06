import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Image, Platform } from 'react-native';
import * as FileSystem from '../utils/fileSystem';
import type { StickerImportSource } from './noteStickers';
import { cleanupStickerTempUri } from './stickerTempFiles';

type NativeSubjectCutoutResult = {
  uri: string;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
};

type NativeSubjectCutoutModule = {
  prepareAsync(): Promise<{
    available?: boolean;
    ready?: boolean;
  }>;
  cutOutAsync(sourceUri: string, destinationBasePath: string): Promise<NativeSubjectCutoutResult>;
};

type SubjectCutoutErrorCode =
  | 'module-unavailable'
  | 'platform-unavailable'
  | 'model-unavailable'
  | 'no-subject'
  | 'source-unavailable'
  | 'processing-failed';

type NativeErrorLike = Error & {
  code?: string;
  cause?: unknown;
};

export type SubjectCutoutImportSource = {
  source: StickerImportSource;
  cleanupUri: string | null;
};

export class SubjectCutoutError extends Error {
  code: SubjectCutoutErrorCode;

  constructor(code: SubjectCutoutErrorCode, message: string) {
    super(message);
    this.name = 'SubjectCutoutError';
    this.code = code;
  }
}

export function getSubjectCutoutErrorLogDetails(error: unknown) {
  if (error instanceof SubjectCutoutError) {
    return {
      kind: 'subject-cutout',
      code: error.code,
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (error instanceof Error) {
    return {
      kind: 'generic',
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    kind: 'unknown',
    value: error,
  };
}

const nativeModule =
  requireOptionalNativeModule<NativeSubjectCutoutModule>('NotoSubjectCutout');

const SUBJECT_CUTOUT_TEMP_DIRECTORY = FileSystem.cacheDirectory
  ? `${FileSystem.cacheDirectory}sticker-cutouts/`
  : null;
const SUBJECT_CUTOUT_MAX_SOURCE_DIMENSION = 2048;
const ANDROID_SUBJECT_CUTOUT_MAX_SOURCE_DIMENSION = 1280;
const SUBJECT_CUTOUT_NORMALIZED_SOURCE_QUALITY = 0.92;

function normalizeNativeCutoutError(error: unknown) {
  if (error instanceof SubjectCutoutError) {
    return error;
  }

  const nativeError = error as NativeErrorLike | null;
  const code = nativeError?.code;
  const message = nativeError?.message ?? 'We could not isolate the subject from this image.';
  if (
    code === 'module-unavailable' ||
    code === 'platform-unavailable' ||
    code === 'model-unavailable' ||
    code === 'no-subject' ||
    code === 'source-unavailable' ||
    code === 'processing-failed'
  ) {
    return new SubjectCutoutError(code, message);
  }

  return new SubjectCutoutError(
    'processing-failed',
    message
  );
}

async function ensureSubjectCutoutTempDirectory() {
  if (!SUBJECT_CUTOUT_TEMP_DIRECTORY) {
    throw new SubjectCutoutError(
      'processing-failed',
      'Sticker storage is unavailable on this device.'
    );
  }

  await FileSystem.makeDirectoryAsync(SUBJECT_CUTOUT_TEMP_DIRECTORY, { intermediates: true });
  return SUBJECT_CUTOUT_TEMP_DIRECTORY;
}

function buildSubjectCutoutDestinationBasePath(directory: string) {
  return `${directory}subject-cutout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getImageSize(uri: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error)
    );
  });
}

async function prepareSubjectCutoutSource(sourceUri: string) {
  const maxSourceDimension =
    Platform.OS === 'android'
      ? ANDROID_SUBJECT_CUTOUT_MAX_SOURCE_DIMENSION
      : SUBJECT_CUTOUT_MAX_SOURCE_DIMENSION;
  const imageSize = await getImageSize(sourceUri).catch(() => null);
  if (
    !imageSize ||
    (
      imageSize.width <= maxSourceDimension &&
      imageSize.height <= maxSourceDimension
    )
  ) {
    return {
      uri: sourceUri,
      cleanupUri: null as string | null,
    };
  }

  const resizeActions =
    imageSize.width >= imageSize.height
      ? [{ resize: { width: maxSourceDimension } }]
      : [{ resize: { height: maxSourceDimension } }];

  // Resize large photos before invoking native segmentation to avoid uncatchable OOM crashes.
  // Android needs a stricter ceiling because ML Kit can still OOM well below the old 2048px limit.
  const normalizedSource = await manipulateAsync(
    sourceUri,
    resizeActions,
    {
      compress: SUBJECT_CUTOUT_NORMALIZED_SOURCE_QUALITY,
      format: SaveFormat.JPEG,
    }
  );

  return {
    uri: normalizedSource.uri,
    cleanupUri: normalizedSource.uri !== sourceUri ? normalizedSource.uri : null,
  };
}

export async function createStickerImportSourceFromSubjectCutout(
  source: StickerImportSource
): Promise<SubjectCutoutImportSource> {
  if (!nativeModule) {
    throw new SubjectCutoutError(
      'module-unavailable',
      'Subject cutout is unavailable in this app build.'
    );
  }

  const sourceUri = typeof source.uri === 'string' ? source.uri.trim() : '';
  if (!sourceUri) {
    throw new SubjectCutoutError('source-unavailable', 'Pick an image to continue.');
  }

  const directory = await ensureSubjectCutoutTempDirectory();
  const preparedSource = await prepareSubjectCutoutSource(sourceUri);

  try {
    const result = await nativeModule
      .cutOutAsync(preparedSource.uri, buildSubjectCutoutDestinationBasePath(directory))
      .catch((error) => {
        throw normalizeNativeCutoutError(error);
      });

    return {
      source: {
        uri: result.uri,
        mimeType: result.mimeType ?? 'image/png',
        name: source.name ?? 'subject-cutout.png',
      },
      cleanupUri: result.uri,
    };
  } finally {
    await cleanupSubjectCutoutImportSource(preparedSource.cleanupUri);
  }
}

export async function prepareStickerSubjectCutout() {
  if (!nativeModule?.prepareAsync) {
    return {
      available: false,
      ready: false,
    };
  }

  return nativeModule.prepareAsync().catch((error) => {
    throw normalizeNativeCutoutError(error);
  });
}

export async function cleanupSubjectCutoutImportSource(cleanupUri: string | null | undefined) {
  await cleanupStickerTempUri(cleanupUri);
}

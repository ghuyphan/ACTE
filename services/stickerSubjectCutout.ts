import { requireOptionalNativeModule } from 'expo-modules-core';
import * as FileSystem from '../utils/fileSystem';
import type { StickerImportSource } from './noteStickers';

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
  const result = await nativeModule
    .cutOutAsync(sourceUri, buildSubjectCutoutDestinationBasePath(directory))
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
  if (!cleanupUri) {
    return;
  }

  await FileSystem.deleteAsync(cleanupUri, { idempotent: true }).catch(() => undefined);
}

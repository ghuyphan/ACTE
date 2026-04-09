import type { RefObject } from 'react';
import type { View } from 'react-native';

export const POLAROID_EXPORT_WIDTH = 1080;
export const POLAROID_EXPORT_HEIGHT = 1350;

export type SavePermissionStatus = 'granted' | 'denied' | 'blocked';
export type PolaroidExportResult =
  | 'success'
  | 'permission-denied'
  | 'permission-blocked'
  | 'capture-failed'
  | 'save-failed';

type MediaLibraryModule = {
  getPermissionsAsync: (writeOnly?: boolean) => Promise<{
    granted: boolean;
    canAskAgain?: boolean;
  }>;
  requestPermissionsAsync: (writeOnly?: boolean) => Promise<{
    granted: boolean;
    canAskAgain?: boolean;
  }>;
  saveToLibraryAsync: (uri: string) => Promise<void>;
};

type ViewShotModule = {
  captureRef: <T>(viewRef: number | RefObject<T>, options?: {
    fileName?: string;
    width?: number;
    height?: number;
    format?: 'jpg' | 'png' | 'webm' | 'raw';
    quality?: number;
    result?: 'tmpfile' | 'base64' | 'data-uri' | 'zip-base64';
  }) => Promise<string>;
  releaseCapture: (uri: string) => void;
};

export class PolaroidExportError extends Error {
  code: 'requires-update';

  constructor(message: string) {
    super(message);
    this.name = 'PolaroidExportError';
    this.code = 'requires-update';
  }
}

function getMediaLibraryModule(): MediaLibraryModule {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-media-library') as MediaLibraryModule;
  } catch (error) {
    console.warn('Polaroid export media library unavailable in this build:', error);
    throw new PolaroidExportError(
      'Polaroid save needs the latest app build. Restart after rebuilding to save to Photos.'
    );
  }
}

function getViewShotModule(): ViewShotModule {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-view-shot') as ViewShotModule;
  } catch (error) {
    console.warn('Polaroid export capture module unavailable in this build:', error);
    throw new PolaroidExportError(
      'Polaroid export needs the latest app build. Restart after rebuilding to capture note cards.'
    );
  }
}

export async function requestSavePermission(): Promise<SavePermissionStatus> {
  const mediaLibrary = getMediaLibraryModule();
  const existingPermission = await mediaLibrary.getPermissionsAsync(true);
  if (existingPermission.granted) {
    return 'granted';
  }

  const requestedPermission = await mediaLibrary.requestPermissionsAsync(true);
  if (requestedPermission.granted) {
    return 'granted';
  }

  return requestedPermission.canAskAgain === false ? 'blocked' : 'denied';
}

export async function captureViewAsImage(viewRef: RefObject<View | null>): Promise<string> {
  if (!viewRef.current) {
    throw new Error('Export view is not ready yet.');
  }

  const { captureRef } = getViewShotModule();

  return captureRef(viewRef, {
    fileName: `noto-polaroid-${Date.now()}`,
    format: 'png',
    quality: 1,
    result: 'tmpfile',
    width: POLAROID_EXPORT_WIDTH,
    height: POLAROID_EXPORT_HEIGHT,
  });
}

export async function savePolaroidToLibrary(tempUri: string): Promise<void> {
  const mediaLibrary = getMediaLibraryModule();
  await mediaLibrary.saveToLibraryAsync(tempUri);
}

export function cleanupCapturedImage(tempUri: string | null | undefined) {
  if (!tempUri) {
    return;
  }

  try {
    const { releaseCapture } = getViewShotModule();
    releaseCapture(tempUri);
  } catch {
    return;
  }
}

export async function exportPolaroid(
  viewRef: RefObject<View | null>
): Promise<PolaroidExportResult> {
  const permissionStatus = await requestSavePermission();
  if (permissionStatus === 'blocked') {
    return 'permission-blocked';
  }
  if (permissionStatus !== 'granted') {
    return 'permission-denied';
  }

  let tempUri: string | null = null;

  try {
    tempUri = await captureViewAsImage(viewRef);
  } catch {
    return 'capture-failed';
  }

  try {
    await savePolaroidToLibrary(tempUri);
    return 'success';
  } catch {
    return 'save-failed';
  } finally {
    cleanupCapturedImage(tempUri);
  }
}

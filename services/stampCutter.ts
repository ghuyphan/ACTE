import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'react-native';
import {
  inferImageMimeTypeFromName,
  normalizeImageMimeType,
} from './mediaTypeUtils';
import type { StickerImportSource, StickerStampStyle } from './noteStickers';

function clamp(value: number, minValue: number, maxValue: number) {
  'worklet';

  return Math.min(maxValue, Math.max(minValue, value));
}

function normalizeZero(value: number) {
  'worklet';

  return Object.is(value, -0) ? 0 : value;
}

export interface StampCutterSize {
  width: number;
  height: number;
}

export interface StampCutterTransform {
  zoom: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
}

export interface StampCutterDraft {
  source: StickerImportSource;
  width: number;
  height: number;
  cleanupUri: string | null;
}

export interface StampCutterRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const STAMP_CUTTER_OVERLAY_SOURCE_WIDTH = 1024;
const STAMP_CUTTER_OVERLAY_SOURCE_HEIGHT = 1536;
const STAMP_CUTTER_MAX_SOURCE_DIMENSION = 2048;
const STAMP_CUTTER_NORMALIZED_SOURCE_QUALITY = 0.9;

export const STAMP_CUTTER_MAX_ZOOM = 16;
export const STAMP_CUTTER_ROTATION_SNAP_DEGREES = 2.5;
export const STAMP_CUTTER_OVERLAY_ASPECT_RATIO =
  STAMP_CUTTER_OVERLAY_SOURCE_WIDTH / STAMP_CUTTER_OVERLAY_SOURCE_HEIGHT;
export const STAMP_CUTTER_WINDOW = {
  // Measured from the visible inner stamp hole in stamp-cutter.png.
  x: 0.380859375,
  y: 0.3404947916666667,
  width: 0.265625,
  height: 0.201171875,
} as const;
export const STAMP_CUTTER_PREVIEW_ASPECT_RATIO =
  (STAMP_CUTTER_WINDOW.width * STAMP_CUTTER_OVERLAY_SOURCE_WIDTH)
  / (STAMP_CUTTER_WINDOW.height * STAMP_CUTTER_OVERLAY_SOURCE_HEIGHT);

export function getStampCutterWindowRect(
  overlaySize: StampCutterSize,
  stampStyle: StickerStampStyle = 'classic'
): StampCutterRect {
  'worklet';

  const classicRect = {
    x: overlaySize.width * STAMP_CUTTER_WINDOW.x,
    y: overlaySize.height * STAMP_CUTTER_WINDOW.y,
    width: overlaySize.width * STAMP_CUTTER_WINDOW.width,
    height: overlaySize.height * STAMP_CUTTER_WINDOW.height,
  };

  if (stampStyle !== 'circle') {
    return classicRect;
  }

  const diameter = Math.min(classicRect.width, classicRect.height);

  return {
    x: classicRect.x + (classicRect.width - diameter) / 2,
    y: classicRect.y + (classicRect.height - diameter) / 2,
    width: diameter,
    height: diameter,
  };
}

export function normalizeStampCutterRotation(
  rotation: number | null | undefined,
  signed = false
) {
  'worklet';

  const safeRotation = Number.isFinite(rotation) ? rotation ?? 0 : 0;
  const normalized = signed
    ? ((((safeRotation + 180) % 360) + 360) % 360) - 180
    : ((safeRotation % 360) + 360) % 360;

  return Math.abs(normalized) < 0.0001 ? 0 : normalized;
}

export function snapStampCutterRotation(
  rotation: number | null | undefined,
  threshold = STAMP_CUTTER_ROTATION_SNAP_DEGREES
) {
  'worklet';

  const normalized = normalizeStampCutterRotation(rotation, true);
  return Math.abs(normalized) <= threshold ? 0 : normalized;
}

export function getStampCutterBaseScale(
  sourceSize: StampCutterSize,
  viewportSize: StampCutterSize
) {
  'worklet';

  return Math.max(
    Math.max(1, viewportSize.width) / Math.max(1, sourceSize.width),
    Math.max(1, viewportSize.height) / Math.max(1, sourceSize.height)
  );
}

export function getStampCutterRotatedBounds(
  size: StampCutterSize,
  rotation: number
): StampCutterSize {
  'worklet';

  const radians = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));

  return {
    width: size.width * cos + size.height * sin,
    height: size.width * sin + size.height * cos,
  };
}

export function getMinimumStampCutterZoom(
  sourceSize: StampCutterSize,
  viewportSize: StampCutterSize,
  selectionRect?: StampCutterRect
) {
  'worklet';

  const safeWidth = Math.max(1, sourceSize.width);
  const safeHeight = Math.max(1, sourceSize.height);
  const safeViewportWidth = Math.max(1, viewportSize.width);
  const safeViewportHeight = Math.max(1, viewportSize.height);
  const baseScale = getStampCutterBaseScale(sourceSize, viewportSize);
  const baseImageWidth = safeWidth * baseScale;
  const baseImageHeight = safeHeight * baseScale;
  const coverageRect = selectionRect ?? {
    x: 0,
    y: 0,
    width: safeViewportWidth,
    height: safeViewportHeight,
  };
  const requiredZoomX = coverageRect.width / Math.max(1, baseImageWidth);
  const requiredZoomY = coverageRect.height / Math.max(1, baseImageHeight);
  const coverageZoom = Math.max(requiredZoomX, requiredZoomY);

  // Allow zooming out until the source just covers the visible cutter window,
  // but no farther. That keeps the preview and exported crop in the same space.
  return clamp(coverageZoom, 0.01, STAMP_CUTTER_MAX_ZOOM);
}

export function normalizeStampCutterPreviewTransform(
  sourceSize: StampCutterSize,
  viewportSize: StampCutterSize,
  selectionRect: StampCutterRect,
  transform: Partial<StampCutterTransform>
): StampCutterTransform {
  'worklet';

  const safeWidth = Math.max(1, sourceSize.width);
  const safeHeight = Math.max(1, sourceSize.height);
  const safeViewportWidth = Math.max(1, viewportSize.width);
  const safeViewportHeight = Math.max(1, viewportSize.height);
  const zoom = clamp(
    Number.isFinite(transform.zoom) ? transform.zoom ?? 1 : 1,
    getMinimumStampCutterZoom(sourceSize, viewportSize, selectionRect),
    STAMP_CUTTER_MAX_ZOOM
  );
  const baseScale = getStampCutterBaseScale(sourceSize, viewportSize);
  const imageWidth = safeWidth * baseScale * zoom;
  const imageHeight = safeHeight * baseScale * zoom;
  const minOffsetX =
    selectionRect.x + selectionRect.width - (safeViewportWidth + imageWidth) / 2;
  const maxOffsetX = selectionRect.x - (safeViewportWidth - imageWidth) / 2;
  const minOffsetY =
    selectionRect.y + selectionRect.height - (safeViewportHeight + imageHeight) / 2;
  const maxOffsetY = selectionRect.y - (safeViewportHeight - imageHeight) / 2;

  return {
    zoom,
    rotation: 0,
    offsetX: normalizeZero(
      clamp(Number.isFinite(transform.offsetX) ? transform.offsetX ?? 0 : 0, minOffsetX, maxOffsetX)
    ),
    offsetY: normalizeZero(
      clamp(Number.isFinite(transform.offsetY) ? transform.offsetY ?? 0 : 0, minOffsetY, maxOffsetY)
    ),
  };
}

export function resolveStampCutterPreviewZoomTransform(
  sourceSize: StampCutterSize,
  viewportSize: StampCutterSize,
  selectionRect: StampCutterRect,
  nextZoom: number,
  anchorX: number,
  anchorY: number,
  startTransform: StampCutterTransform
): StampCutterTransform {
  'worklet';

  const startNormalized = normalizeStampCutterPreviewTransform(
    sourceSize,
    viewportSize,
    selectionRect,
    startTransform
  );
  const baseScale = getStampCutterBaseScale(sourceSize, viewportSize);
  const safeWidth = Math.max(1, sourceSize.width);
  const safeHeight = Math.max(1, sourceSize.height);
  const startImageWidth = safeWidth * baseScale * startNormalized.zoom;
  const startImageHeight = safeHeight * baseScale * startNormalized.zoom;
  const startLeft = (viewportSize.width - startImageWidth) / 2 + startNormalized.offsetX;
  const startTop = (viewportSize.height - startImageHeight) / 2 + startNormalized.offsetY;
  const relativeX =
    startImageWidth > 0 ? clamp((anchorX - startLeft) / startImageWidth, 0, 1) : 0.5;
  const relativeY =
    startImageHeight > 0 ? clamp((anchorY - startTop) / startImageHeight, 0, 1) : 0.5;
  const provisional = normalizeStampCutterPreviewTransform(sourceSize, viewportSize, selectionRect, {
    zoom: nextZoom,
    offsetX: startTransform.offsetX,
    offsetY: startTransform.offsetY,
    rotation: 0,
  });
  const provisionalImageWidth = safeWidth * baseScale * provisional.zoom;
  const provisionalImageHeight = safeHeight * baseScale * provisional.zoom;

  return normalizeStampCutterPreviewTransform(sourceSize, viewportSize, selectionRect, {
    zoom: nextZoom,
    offsetX: anchorX - viewportSize.width / 2 + (0.5 - relativeX) * provisionalImageWidth,
    offsetY: anchorY - viewportSize.height / 2 + (0.5 - relativeY) * provisionalImageHeight,
    rotation: 0,
  });
}

export function normalizeStampCutterTransform(
  sourceSize: StampCutterSize,
  viewportSize: StampCutterSize,
  transform: Partial<StampCutterTransform>,
  selectionRect?: StampCutterRect
) {
  const safeWidth = Math.max(1, sourceSize.width);
  const safeHeight = Math.max(1, sourceSize.height);
  const safeCropWidth = Math.max(1, viewportSize.width);
  const safeCropHeight = Math.max(1, viewportSize.height);
  const minZoom = getMinimumStampCutterZoom(sourceSize, viewportSize, selectionRect);
  const zoom = clamp(
    Number.isFinite(transform.zoom) ? transform.zoom ?? 1 : 1,
    minZoom,
    STAMP_CUTTER_MAX_ZOOM
  );
  const rotation = normalizeStampCutterRotation(transform.rotation);
  const baseScale = getStampCutterBaseScale(sourceSize, viewportSize);
  const totalScale = baseScale * zoom;
  const imageWidth = safeWidth * totalScale;
  const imageHeight = safeHeight * totalScale;
  const coverageRect = selectionRect ?? {
    x: 0,
    y: 0,
    width: safeCropWidth,
    height: safeCropHeight,
  };
  const minOffsetX = coverageRect.x + coverageRect.width - (safeCropWidth + imageWidth) / 2;
  const maxOffsetX = coverageRect.x - (safeCropWidth - imageWidth) / 2;
  const minOffsetY = coverageRect.y + coverageRect.height - (safeCropHeight + imageHeight) / 2;
  const maxOffsetY = coverageRect.y - (safeCropHeight - imageHeight) / 2;

  return {
    zoom,
    rotation,
    offsetX: normalizeZero(
      clamp(Number.isFinite(transform.offsetX) ? transform.offsetX ?? 0 : 0, minOffsetX, maxOffsetX)
    ),
    offsetY: normalizeZero(
      clamp(Number.isFinite(transform.offsetY) ? transform.offsetY ?? 0 : 0, minOffsetY, maxOffsetY)
    ),
    baseScale,
    totalScale,
    imageWidth,
    imageHeight,
    maxOffsetX,
    maxOffsetY,
  };
}

function getRotatedSize(sourceSize: StampCutterSize, rotation: number): StampCutterSize {
  return getStampCutterRotatedBounds(sourceSize, rotation);
}

export function calculateStampCutterCropRect(
  sourceSize: StampCutterSize,
  viewportSize: StampCutterSize,
  selectionRect: StampCutterRect,
  transform: Partial<StampCutterTransform>
): StampCutterRect {
  const rotation = normalizeStampCutterRotation(transform.rotation);
  const rotatedSize = getRotatedSize(sourceSize, rotation);
  const normalized = normalizeStampCutterTransform(rotatedSize, viewportSize, transform, selectionRect);
  const viewportImageLeft = (viewportSize.width - normalized.imageWidth) / 2 + normalized.offsetX;
  const viewportImageTop = (viewportSize.height - normalized.imageHeight) / 2 + normalized.offsetY;
  const visibleWidth = Math.max(1, selectionRect.width / normalized.totalScale);
  const visibleHeight = Math.max(1, selectionRect.height / normalized.totalScale);
  const unclampedX = (selectionRect.x - viewportImageLeft) / normalized.totalScale;
  const unclampedY = (selectionRect.y - viewportImageTop) / normalized.totalScale;

  return {
    x: clamp(unclampedX, 0, Math.max(0, rotatedSize.width - visibleWidth)),
    y: clamp(unclampedY, 0, Math.max(0, rotatedSize.height - visibleHeight)),
    width: Math.min(visibleWidth, rotatedSize.width),
    height: Math.min(visibleHeight, rotatedSize.height),
  };
}

function buildStampCutoutFileName(name: string | null | undefined) {
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  if (!normalizedName) {
    return 'stamp-cut.jpg';
  }

  const baseName = normalizedName.replace(/\.[^.]+$/, '');
  return `${baseName}-stamp.jpg`;
}

async function getImageSize(uri: string) {
  return new Promise<StampCutterSize>((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error)
    );
  });
}

export async function prepareStampCutterDraft(
  source: StickerImportSource,
  fallbackWidth?: number | null,
  fallbackHeight?: number | null
): Promise<StampCutterDraft> {
  const sourceSize =
    typeof fallbackWidth === 'number' &&
    fallbackWidth > 0 &&
    typeof fallbackHeight === 'number' &&
    fallbackHeight > 0
      ? {
          width: fallbackWidth,
          height: fallbackHeight,
        }
      : await getImageSize(source.uri);
  const longestEdge = Math.max(sourceSize.width, sourceSize.height);
  const needsResize = longestEdge > STAMP_CUTTER_MAX_SOURCE_DIMENSION;
  const sourceMimeType =
    normalizeImageMimeType(source.mimeType) || inferImageMimeTypeFromName(source.name);
  const needsFormatNormalization = sourceMimeType !== 'image/jpeg';

  if (!needsResize && !needsFormatNormalization) {
    return {
      source,
      width: sourceSize.width,
      height: sourceSize.height,
      cleanupUri: null,
    };
  }

  const resizeActions =
    !needsResize
      ? []
      : sourceSize.width >= sourceSize.height
      ? [{ resize: { width: STAMP_CUTTER_MAX_SOURCE_DIMENSION } }]
      : [{ resize: { height: STAMP_CUTTER_MAX_SOURCE_DIMENSION } }];
  const normalizedSource = await manipulateAsync(source.uri, resizeActions, {
    compress: STAMP_CUTTER_NORMALIZED_SOURCE_QUALITY,
    format: SaveFormat.JPEG,
  });
  const normalizedSize =
    typeof normalizedSource.width === 'number' &&
    normalizedSource.width > 0 &&
    typeof normalizedSource.height === 'number' &&
    normalizedSource.height > 0
      ? {
          width: normalizedSource.width,
          height: normalizedSource.height,
        }
      : await getImageSize(normalizedSource.uri);

  return {
    source: {
      ...source,
      uri: normalizedSource.uri,
      mimeType: 'image/jpeg',
    },
    width: normalizedSize.width,
    height: normalizedSize.height,
    cleanupUri: normalizedSource.uri !== source.uri ? normalizedSource.uri : null,
  };
}

export async function exportStampCutoutImageSource(
  draft: StampCutterDraft,
  viewportSize: StampCutterSize,
  selectionRect: StampCutterRect,
  transform: Partial<StampCutterTransform>
) {
  const normalizedRotation = normalizeStampCutterRotation(transform.rotation);
  const needsRotation = Math.abs(normalizedRotation) > 0.001;

  let workingUri = draft.source.uri;
  let workingSize = {
    width: draft.width,
    height: draft.height,
  };
  let cleanupUri: string | null = null;

  if (needsRotation) {
    const rotated = await manipulateAsync(
      draft.source.uri,
      [{ rotate: normalizedRotation }],
      {
        compress: 1,
        format: SaveFormat.JPEG,
      }
    );
    workingUri = rotated.uri;
    workingSize = {
      width: Math.max(1, Math.round(rotated.width ?? 0) || Math.round(getRotatedSize(workingSize, normalizedRotation).width)),
      height: Math.max(1, Math.round(rotated.height ?? 0) || Math.round(getRotatedSize(workingSize, normalizedRotation).height)),
    };
    cleanupUri = rotated.uri;
  }

  const cropRect = calculateStampCutterCropRect(
    workingSize,
    viewportSize,
    selectionRect,
    {
      ...transform,
      rotation: 0,
    }
  );
  const roundedCropRect = {
    originX: clamp(Math.round(cropRect.x), 0, Math.max(0, workingSize.width - 1)),
    originY: clamp(Math.round(cropRect.y), 0, Math.max(0, workingSize.height - 1)),
    width: Math.max(1, Math.round(cropRect.width)),
    height: Math.max(1, Math.round(cropRect.height)),
  };
  roundedCropRect.width = Math.min(roundedCropRect.width, Math.max(1, workingSize.width - roundedCropRect.originX));
  roundedCropRect.height = Math.min(roundedCropRect.height, Math.max(1, workingSize.height - roundedCropRect.originY));

  const result = await manipulateAsync(
    workingUri,
    [{ crop: roundedCropRect }],
    {
      compress: STAMP_CUTTER_NORMALIZED_SOURCE_QUALITY,
      format: SaveFormat.JPEG,
    }
  );

  return {
    source: {
      uri: result.uri,
      mimeType: 'image/jpeg',
      name: buildStampCutoutFileName(draft.source.name),
    },
    cleanupUri: result.uri,
    cropRect: roundedCropRect,
    intermediateCleanupUri: cleanupUri,
  };
}

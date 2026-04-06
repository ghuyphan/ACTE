import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import type { StickerImportSource } from './noteStickers';

function clamp(value: number, minValue: number, maxValue: number) {
  return Math.min(maxValue, Math.max(minValue, value));
}

export interface StampCutterSize {
  width: number;
  height: number;
}

export interface StampCutterTransform {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export interface StampCutterDraft {
  source: StickerImportSource;
  width: number;
  height: number;
}

export interface StampCutterRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const STAMP_CUTTER_OVERLAY_SOURCE_WIDTH = 1024;
const STAMP_CUTTER_OVERLAY_SOURCE_HEIGHT = 1536;

export const STAMP_CUTTER_MIN_ZOOM = 1;
export const STAMP_CUTTER_MAX_ZOOM = 4;
export const STAMP_CUTTER_OVERLAY_ASPECT_RATIO =
  STAMP_CUTTER_OVERLAY_SOURCE_WIDTH / STAMP_CUTTER_OVERLAY_SOURCE_HEIGHT;
export const STAMP_CUTTER_WINDOW = {
  x: 0.313,
  y: 0.305,
  width: 0.374,
  height: 0.326,
} as const;

export function getStampCutterWindowRect(overlaySize: StampCutterSize): StampCutterRect {
  return {
    x: overlaySize.width * STAMP_CUTTER_WINDOW.x,
    y: overlaySize.height * STAMP_CUTTER_WINDOW.y,
    width: overlaySize.width * STAMP_CUTTER_WINDOW.width,
    height: overlaySize.height * STAMP_CUTTER_WINDOW.height,
  };
}

export function normalizeStampCutterTransform(
  sourceSize: StampCutterSize,
  cropSize: StampCutterSize,
  transform: Partial<StampCutterTransform>
) {
  const safeWidth = Math.max(1, sourceSize.width);
  const safeHeight = Math.max(1, sourceSize.height);
  const safeCropWidth = Math.max(1, cropSize.width);
  const safeCropHeight = Math.max(1, cropSize.height);
  const zoom = clamp(
    Number.isFinite(transform.zoom) ? transform.zoom ?? 1 : 1,
    STAMP_CUTTER_MIN_ZOOM,
    STAMP_CUTTER_MAX_ZOOM
  );
  const baseScale = Math.max(safeCropWidth / safeWidth, safeCropHeight / safeHeight);
  const totalScale = baseScale * zoom;
  const imageWidth = safeWidth * totalScale;
  const imageHeight = safeHeight * totalScale;
  const maxOffsetX = Math.max(0, (imageWidth - safeCropWidth) / 2);
  const maxOffsetY = Math.max(0, (imageHeight - safeCropHeight) / 2);

  return {
    zoom,
    offsetX: clamp(
      Number.isFinite(transform.offsetX) ? transform.offsetX ?? 0 : 0,
      -maxOffsetX,
      maxOffsetX
    ),
    offsetY: clamp(
      Number.isFinite(transform.offsetY) ? transform.offsetY ?? 0 : 0,
      -maxOffsetY,
      maxOffsetY
    ),
    baseScale,
    totalScale,
    imageWidth,
    imageHeight,
    maxOffsetX,
    maxOffsetY,
  };
}

export function calculateStampCutterCropRect(
  sourceSize: StampCutterSize,
  cropSize: StampCutterSize,
  transform: Partial<StampCutterTransform>
): StampCutterRect {
  const normalized = normalizeStampCutterTransform(sourceSize, cropSize, transform);
  const visibleWidth = Math.max(1, cropSize.width / normalized.totalScale);
  const visibleHeight = Math.max(1, cropSize.height / normalized.totalScale);
  const unclampedX =
    sourceSize.width / 2 - visibleWidth / 2 - normalized.offsetX / normalized.totalScale;
  const unclampedY =
    sourceSize.height / 2 - visibleHeight / 2 - normalized.offsetY / normalized.totalScale;

  return {
    x: clamp(unclampedX, 0, Math.max(0, sourceSize.width - visibleWidth)),
    y: clamp(unclampedY, 0, Math.max(0, sourceSize.height - visibleHeight)),
    width: Math.min(visibleWidth, sourceSize.width),
    height: Math.min(visibleHeight, sourceSize.height),
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

export async function exportStampCutoutImageSource(
  draft: StampCutterDraft,
  cropSize: StampCutterSize,
  transform: Partial<StampCutterTransform>
) {
  const cropRect = calculateStampCutterCropRect(
    { width: draft.width, height: draft.height },
    cropSize,
    transform
  );
  const roundedCropRect = {
    originX: Math.round(cropRect.x),
    originY: Math.round(cropRect.y),
    width: Math.max(1, Math.round(cropRect.width)),
    height: Math.max(1, Math.round(cropRect.height)),
  };
  const result = await manipulateAsync(
    draft.source.uri,
    [{ crop: roundedCropRect }],
    {
      compress: 0.94,
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
  };
}

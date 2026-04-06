import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'react-native';
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

export const STAMP_CUTTER_MIN_ZOOM = 1;
export const STAMP_CUTTER_MAX_ZOOM = 4;
export const STAMP_CUTTER_ROTATION_SNAP_DEGREES = 2.5;
export const STAMP_CUTTER_OVERLAY_ASPECT_RATIO =
  STAMP_CUTTER_OVERLAY_SOURCE_WIDTH / STAMP_CUTTER_OVERLAY_SOURCE_HEIGHT;
export const STAMP_CUTTER_WINDOW = {
  x: 0.385,
  y: 0.367,
  width: 0.256,
  height: 0.175,
} as const;
export const STAMP_CUTTER_PREVIEW_ASPECT_RATIO =
  (STAMP_CUTTER_WINDOW.width * STAMP_CUTTER_OVERLAY_SOURCE_WIDTH)
  / (STAMP_CUTTER_WINDOW.height * STAMP_CUTTER_OVERLAY_SOURCE_HEIGHT);

export function getStampCutterWindowRect(overlaySize: StampCutterSize): StampCutterRect {
  return {
    x: overlaySize.width * STAMP_CUTTER_WINDOW.x,
    y: overlaySize.height * STAMP_CUTTER_WINDOW.y,
    width: overlaySize.width * STAMP_CUTTER_WINDOW.width,
    height: overlaySize.height * STAMP_CUTTER_WINDOW.height,
  };
}

export function normalizeStampCutterRotation(
  rotation: number | null | undefined,
  signed = false
) {
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
  const normalized = normalizeStampCutterRotation(rotation, true);
  return Math.abs(normalized) <= threshold ? 0 : normalized;
}

export function normalizeStampCutterTransform(
  sourceSize: StampCutterSize,
  viewportSize: StampCutterSize,
  transform: Partial<StampCutterTransform>
) {
  const safeWidth = Math.max(1, sourceSize.width);
  const safeHeight = Math.max(1, sourceSize.height);
  const safeCropWidth = Math.max(1, viewportSize.width);
  const safeCropHeight = Math.max(1, viewportSize.height);
  const zoom = clamp(
    Number.isFinite(transform.zoom) ? transform.zoom ?? 1 : 1,
    STAMP_CUTTER_MIN_ZOOM,
    STAMP_CUTTER_MAX_ZOOM
  );
  const rotation = normalizeStampCutterRotation(transform.rotation);
  const baseScale = Math.max(safeCropWidth / safeWidth, safeCropHeight / safeHeight);
  const totalScale = baseScale * zoom;
  const imageWidth = safeWidth * totalScale;
  const imageHeight = safeHeight * totalScale;
  const maxOffsetX = Math.max(0, (imageWidth - safeCropWidth) / 2);
  const maxOffsetY = Math.max(0, (imageHeight - safeCropHeight) / 2);

  return {
    zoom,
    rotation,
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

function getRotatedSize(sourceSize: StampCutterSize, rotation: number): StampCutterSize {
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));

  return {
    width: sourceSize.width * cos + sourceSize.height * sin,
    height: sourceSize.width * sin + sourceSize.height * cos,
  };
}

export function calculateStampCutterCropRect(
  sourceSize: StampCutterSize,
  viewportSize: StampCutterSize,
  selectionRect: StampCutterRect,
  transform: Partial<StampCutterTransform>
): StampCutterRect {
  const rotation = normalizeStampCutterRotation(transform.rotation);
  const rotatedSize = getRotatedSize(sourceSize, rotation);
  const normalized = normalizeStampCutterTransform(rotatedSize, viewportSize, transform);
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
  const normalizedSource = await manipulateAsync(
    source.uri,
    [],
    {
      compress: 1,
      format: SaveFormat.JPEG,
    }
  );
  const normalizedSize =
    typeof normalizedSource.width === 'number' &&
    normalizedSource.width > 0 &&
    typeof normalizedSource.height === 'number' &&
    normalizedSource.height > 0
      ? {
          width: normalizedSource.width,
          height: normalizedSource.height,
        }
      : await getImageSize(normalizedSource.uri).catch((error) => {
          if (
            typeof fallbackWidth === 'number' &&
            fallbackWidth > 0 &&
            typeof fallbackHeight === 'number' &&
            fallbackHeight > 0
          ) {
            return {
              width: fallbackWidth,
              height: fallbackHeight,
            };
          }

          throw error;
        });

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
    intermediateCleanupUri: cleanupUri,
  };
}

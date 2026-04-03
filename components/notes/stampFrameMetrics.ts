import { PathOp, Skia, type SkPath } from '@shopify/react-native-skia';

function clamp(value: number, minValue: number, maxValue: number) {
  return Math.min(maxValue, Math.max(minValue, value));
}

function buildPerforationCenters(length: number, radius: number) {
  const safeLength = Math.max(length, radius * 4);
  const preferredSpacing = Math.max(radius * 1.95, 10);
  const count = Math.max(5, Math.floor(safeLength / preferredSpacing));
  const start = radius * 0.58;
  const end = safeLength - radius * 0.58;
  const step = count <= 1 ? 0 : (end - start) / (count - 1);

  return Array.from({ length: count }, (_, index) => start + step * index);
}

export interface StampFrameMetrics {
  borderRadius: number;
  captionFontSize: number;
  captionWidth: number;
  captionX: number;
  captionY: number;
  footerHeight: number;
  imageHeight: number;
  imageBorderRadius: number;
  imageWidth: number;
  imageX: number;
  imageY: number;
  outerHeight: number;
  outerWidth: number;
  paperHeight: number;
  paperInset: number;
  paperPadding: number;
  paperWidth: number;
  perforationOffset: number;
  perforationRadius: number;
  bottomCenters: number[];
  leftCenters: number[];
  rightCenters: number[];
  topCenters: number[];
}

export interface StampCutoutPathOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius: number;
  perforationOffset?: number;
  perforationRadius: number;
}

export const STAMP_PAPER_COLOR = '#FBF5E6';
export const STAMP_OUTLINE_COLOR = 'rgba(255, 250, 240, 0.98)';
export const STAMP_PAPER_BORDER_COLOR = 'rgba(143, 112, 72, 0.1)';
export const STAMP_IMAGE_BORDER_COLOR = 'rgba(96, 74, 45, 0.08)';
export const STAMP_DROP_SHADOW_COLOR = 'rgba(76, 57, 31, 0.16)';
export const STAMP_TEXT_COLOR = '#6F5C44';

export function getStampFrameMetrics(contentWidth: number, contentHeight: number): StampFrameMetrics {
  const shortestEdge = Math.max(Math.min(contentWidth, contentHeight), 1);
  const paperPadding = 0;
  const perforationRadius = clamp(shortestEdge * 0.048, 4, 6.6);
  const perforationOffset = perforationRadius * 0.18;
  const borderRadius = clamp(shortestEdge * 0.02, 1.5, 3.5);
  const imageBorderRadius = 0;
  const footerHeight = 0;
  const captionFontSize = 0;
  const captionX = 0;
  const paperWidth = contentWidth;
  const paperHeight = contentHeight;
  const paperInset = 0;
  const imageX = 0;
  const imageY = 0;
  const imageWidth = paperWidth;
  const imageHeight = paperHeight;
  const captionY = 0;

  return {
    borderRadius,
    captionFontSize,
    captionWidth: Math.max(paperWidth - captionX * 2, 1),
    captionX,
    captionY,
    footerHeight,
    imageHeight,
    imageBorderRadius,
    imageWidth,
    imageX,
    imageY,
    outerHeight: paperHeight,
    outerWidth: paperWidth,
    paperHeight,
    paperInset,
    paperPadding,
    paperWidth,
    perforationOffset,
    perforationRadius,
    bottomCenters: buildPerforationCenters(paperWidth, perforationRadius),
    leftCenters: buildPerforationCenters(paperHeight, perforationRadius),
    rightCenters: buildPerforationCenters(paperHeight, perforationRadius),
    topCenters: buildPerforationCenters(paperWidth, perforationRadius),
  };
}

export function createStampFramePath(metrics: StampFrameMetrics): SkPath {
  return createStampCutoutPath({
    x: 0,
    y: 0,
    width: metrics.outerWidth,
    height: metrics.outerHeight,
    borderRadius: metrics.borderRadius,
    perforationOffset: metrics.perforationOffset,
    perforationRadius: metrics.perforationRadius,
  });
}

export function createRoundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  borderRadius: number
): SkPath {
  if (!Skia?.Path || typeof Skia.Path.Make !== 'function') {
    return { __mockPath: true, x, y, width, height, borderRadius } as unknown as SkPath;
  }

  const path = Skia.Path.Make();
  const roundedRect = {
    rect: {
      x,
      y,
      width,
      height,
    },
    rx: borderRadius,
    ry: borderRadius,
  };

  if (typeof path.addRRect === 'function') {
    path.addRRect(roundedRect);
  } else if (typeof path.addRect === 'function') {
    path.addRect(roundedRect.rect);
  }

  return path;
}

export function createStampCutoutPath({
  x,
  y,
  width,
  height,
  borderRadius,
  perforationOffset = 0,
  perforationRadius,
}: StampCutoutPathOptions): SkPath {
  const path = createRoundedRectPath(x, y, width, height, borderRadius);

  if (perforationRadius <= 0 || typeof path.op !== 'function') {
    return path;
  }

  const subtractCircle = (cx: number, cy: number) => {
    const cutoutPath = Skia.Path.Make();
    if (typeof cutoutPath.addCircle !== 'function') {
      return;
    }

    cutoutPath.addCircle(cx, cy, perforationRadius);
    path.op(cutoutPath, PathOp.Difference);
  };

  buildPerforationCenters(width, perforationRadius).forEach((centerX) => {
    subtractCircle(x + centerX, y - perforationOffset);
    subtractCircle(x + centerX, y + height + perforationOffset);
  });
  buildPerforationCenters(height, perforationRadius).forEach((centerY) => {
    subtractCircle(x - perforationOffset, y + centerY);
    subtractCircle(x + width + perforationOffset, y + centerY);
  });

  return path;
}

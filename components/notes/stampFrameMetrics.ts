import { PathOp, Skia, type SkPath } from '@shopify/react-native-skia';
import type { StickerStampStyle } from '../../services/noteStickers';

const STAMP_TEMPLATE_WIDTH = 272;
const STAMP_TEMPLATE_HEIGHT = 309;
const STAMP_TEMPLATE_PERFORATION_RADIUS = 15;
const STAMP_TEMPLATE_PERFORATION_OFFSET = STAMP_TEMPLATE_PERFORATION_RADIUS * 0.18;
const STAMP_TEMPLATE_BORDER_RADIUS = 11;
const STAMP_TEMPLATE_TOP_COUNT = 9;
const STAMP_TEMPLATE_SIDE_COUNT = 10;
const CIRCLE_STAMP_TEMPLATE_DIAMETER = 272;
const CIRCLE_STAMP_TEMPLATE_PERFORATION_RADIUS = 14;
const CIRCLE_STAMP_TEMPLATE_PERFORATION_OFFSET = CIRCLE_STAMP_TEMPLATE_PERFORATION_RADIUS * 0.14;
const CIRCLE_STAMP_TEMPLATE_COUNT = 22;

function buildPerforationCenters(length: number, radius: number, count: number) {
  const safeCount = Math.max(5, Math.round(count));
  const start = radius * 0.58;
  const end = length - radius * 0.58;
  const step = safeCount <= 1 ? 0 : (end - start) / (safeCount - 1);

  return Array.from({ length: safeCount }, (_, index) => start + step * index);
}

function getTemplatePerforationCount(
  normalizedLength: number,
  templateLength: number,
  templateCount: number
) {
  return Math.max(5, Math.round((normalizedLength / Math.max(templateLength, 1)) * templateCount));
}

export interface StampFrameMetrics {
  style: StickerStampStyle;
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
  topCenters?: number[];
  bottomCenters?: number[];
  leftCenters?: number[];
  rightCenters?: number[];
}

export const STAMP_PAPER_COLOR = '#FBF5E6';
export const STAMP_OUTLINE_COLOR = 'rgba(255, 250, 240, 0.98)';
export const STAMP_PAPER_BORDER_COLOR = 'rgba(143, 112, 72, 0.1)';
export const STAMP_IMAGE_BORDER_COLOR = 'rgba(96, 74, 45, 0.08)';
export const STAMP_DROP_SHADOW_COLOR = 'rgba(76, 57, 31, 0.16)';
export const STAMP_TEXT_COLOR = '#6F5C44';

function getCirclePerforationCount(normalizedDiameter: number) {
  return Math.max(
    10,
    Math.round(
      (normalizedDiameter / Math.max(CIRCLE_STAMP_TEMPLATE_DIAMETER, 1)) * CIRCLE_STAMP_TEMPLATE_COUNT
    )
  );
}

function buildCirclePerforationAngles(count: number) {
  const safeCount = Math.max(10, Math.round(count));
  const step = (Math.PI * 2) / safeCount;
  return Array.from({ length: safeCount }, (_, index) => index * step);
}

export function getStampFrameMetrics(
  contentWidth: number,
  contentHeight: number,
  style: StickerStampStyle = 'classic'
): StampFrameMetrics {
  if (style === 'circle') {
    const diameter = Math.max(Math.min(contentWidth, contentHeight), 1);
    const renderScale = diameter / CIRCLE_STAMP_TEMPLATE_DIAMETER;
    const safeRenderScale = Math.max(renderScale, 1 / CIRCLE_STAMP_TEMPLATE_DIAMETER);
    const perforationRadius = CIRCLE_STAMP_TEMPLATE_PERFORATION_RADIUS * safeRenderScale;
    const perforationOffset = CIRCLE_STAMP_TEMPLATE_PERFORATION_OFFSET * safeRenderScale;
    const topCount = getCirclePerforationCount(diameter);

    return {
      style,
      borderRadius: diameter / 2,
      captionFontSize: 0,
      captionWidth: diameter,
      captionX: 0,
      captionY: 0,
      footerHeight: 0,
      imageHeight: diameter,
      imageBorderRadius: diameter / 2,
      imageWidth: diameter,
      imageX: 0,
      imageY: 0,
      outerHeight: diameter,
      outerWidth: diameter,
      paperHeight: diameter,
      paperInset: 0,
      paperPadding: 0,
      paperWidth: diameter,
      perforationOffset,
      perforationRadius,
      bottomCenters: buildCirclePerforationAngles(topCount),
      leftCenters: [],
      rightCenters: [],
      topCenters: [],
    };
  }

  const safeWidth = Math.max(contentWidth, 1);
  const safeHeight = Math.max(contentHeight, 1);
  const renderScale = Math.min(safeWidth / STAMP_TEMPLATE_WIDTH, safeHeight / STAMP_TEMPLATE_HEIGHT);
  const safeRenderScale = Math.max(renderScale, 1 / Math.max(STAMP_TEMPLATE_WIDTH, STAMP_TEMPLATE_HEIGHT));
  const templateScale = Math.min(STAMP_TEMPLATE_WIDTH / safeWidth, STAMP_TEMPLATE_HEIGHT / safeHeight);
  const templateWidth = contentWidth * templateScale;
  const templateHeight = contentHeight * templateScale;
  const paperPadding = 0;
  const perforationRadius = STAMP_TEMPLATE_PERFORATION_RADIUS * safeRenderScale;
  const perforationOffset = STAMP_TEMPLATE_PERFORATION_OFFSET * safeRenderScale;
  const borderRadius = STAMP_TEMPLATE_BORDER_RADIUS * safeRenderScale;
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
  const topCount = getTemplatePerforationCount(
    templateWidth,
    STAMP_TEMPLATE_WIDTH,
    STAMP_TEMPLATE_TOP_COUNT
  );
  const sideCount = getTemplatePerforationCount(
    templateHeight,
    STAMP_TEMPLATE_HEIGHT,
    STAMP_TEMPLATE_SIDE_COUNT
  );

  return {
    style,
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
    bottomCenters: buildPerforationCenters(paperWidth, perforationRadius, topCount),
    leftCenters: buildPerforationCenters(paperHeight, perforationRadius, sideCount),
    rightCenters: buildPerforationCenters(paperHeight, perforationRadius, sideCount),
    topCenters: buildPerforationCenters(paperWidth, perforationRadius, topCount),
  };
}

export function createStampFramePath(metrics: StampFrameMetrics): SkPath {
  if (metrics.style === 'circle') {
    return createCircleStampCutoutPath(metrics);
  }

  return createStampCutoutPath({
    x: 0,
    y: 0,
    width: metrics.outerWidth,
    height: metrics.outerHeight,
    borderRadius: metrics.borderRadius,
    perforationOffset: metrics.perforationOffset,
    perforationRadius: metrics.perforationRadius,
    topCenters: metrics.topCenters,
    bottomCenters: metrics.bottomCenters,
    leftCenters: metrics.leftCenters,
    rightCenters: metrics.rightCenters,
  });
}

function createCirclePath(cx: number, cy: number, radius: number): SkPath {
  const path = Skia.Path.Make();
  if (typeof path.addCircle === 'function') {
    path.addCircle(cx, cy, radius);
  }
  return path;
}

function createCircleStampCutoutPath(metrics: StampFrameMetrics): SkPath {
  const diameter = Math.max(Math.min(metrics.outerWidth, metrics.outerHeight), 1);
  const radius = diameter / 2;
  const centerX = metrics.outerWidth / 2;
  const centerY = metrics.outerHeight / 2;
  const path = createCirclePath(centerX, centerY, radius);

  if (metrics.perforationRadius <= 0 || typeof path.op !== 'function') {
    return path;
  }

  const perforationCenterRadius = Math.max(radius + metrics.perforationOffset, metrics.perforationRadius);
  const angles =
    metrics.bottomCenters.length > 0
      ? metrics.bottomCenters
      : buildCirclePerforationAngles(getCirclePerforationCount(diameter));

  angles.forEach((angle) => {
    const cutoutPath = createCirclePath(
      centerX + Math.cos(angle) * perforationCenterRadius,
      centerY + Math.sin(angle) * perforationCenterRadius,
      metrics.perforationRadius
    );
    path.op(cutoutPath, PathOp.Difference);
  });

  return path;
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
  topCenters,
  bottomCenters,
  leftCenters,
  rightCenters,
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

  const horizontalCenters =
    bottomCenters && bottomCenters.length > 0
      ? bottomCenters
      : topCenters && topCenters.length > 0
      ? topCenters
      : buildPerforationCenters(width, perforationRadius, STAMP_TEMPLATE_TOP_COUNT);
  const verticalCenters =
    leftCenters && leftCenters.length > 0
      ? leftCenters
      : rightCenters && rightCenters.length > 0
      ? rightCenters
      : buildPerforationCenters(height, perforationRadius, STAMP_TEMPLATE_SIDE_COUNT);

  horizontalCenters.forEach((centerX) => {
    subtractCircle(x + centerX, y - perforationOffset);
    subtractCircle(x + centerX, y + height + perforationOffset);
  });
  verticalCenters.forEach((centerY) => {
    subtractCircle(x - perforationOffset, y + centerY);
    subtractCircle(x + width + perforationOffset, y + centerY);
  });

  return path;
}

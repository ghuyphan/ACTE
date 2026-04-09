import type { NoteStickerPlacement } from '../../services/noteStickers';
import {
  clampStickerScale,
  getStickerDimensions,
  getStickerOutlineSize,
  type StickerCanvasLayout,
} from './stickerCanvasMetrics';
import { getStampFrameMetrics, type StampFrameMetrics } from './stampFrameMetrics';

export interface StickerPlacementFrame {
  baseWidth: number;
  baseHeight: number;
  outlineSize: number;
  frameWidth: number;
  frameHeight: number;
  normalizedScale: number;
  stampMetrics: StampFrameMetrics | null;
}

export interface StickerPlacementRenderBox extends StickerPlacementFrame {
  centerX: number;
  centerY: number;
  left: number;
  top: number;
  width: number;
  height: number;
  unscaledLeft: number;
  unscaledTop: number;
  unscaledWidth: number;
  unscaledHeight: number;
}

export interface StickerPlacementWindowRect extends StickerPlacementRenderBox {
  x: number;
  y: number;
}

export interface StickerPlacementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getStickerPlacementFrame(
  placement: NoteStickerPlacement,
  layout: StickerCanvasLayout,
  sizeMultiplier: number,
  minimumBaseSize: number
): StickerPlacementFrame {
  const normalizedScale = clampStickerScale(placement.scale);
  const baseDimensions = getStickerDimensions(
    { ...placement, scale: 1 },
    layout,
    sizeMultiplier,
    minimumBaseSize
  );
  const outlineSize = getStickerOutlineSize(
    baseDimensions.width,
    baseDimensions.height
  );
  const stampMetrics =
    placement.renderMode === 'stamp'
      ? getStampFrameMetrics(baseDimensions.width, baseDimensions.height)
      : null;
  const frameWidth = stampMetrics
    ? stampMetrics.outerWidth
    : baseDimensions.width + outlineSize * 2;
  const frameHeight = stampMetrics
    ? stampMetrics.outerHeight
    : baseDimensions.height + outlineSize * 2;

  return {
    baseWidth: baseDimensions.width,
    baseHeight: baseDimensions.height,
    outlineSize,
    frameWidth,
    frameHeight,
    normalizedScale,
    stampMetrics,
  };
}

export function getStickerPlacementRenderBoxFromFrame(
  placement: NoteStickerPlacement,
  layout: StickerCanvasLayout,
  frame: StickerPlacementFrame
): StickerPlacementRenderBox {
  const centerX = placement.x * layout.width;
  const centerY = placement.y * layout.height;
  const width = frame.frameWidth * frame.normalizedScale;
  const height = frame.frameHeight * frame.normalizedScale;

  return {
    ...frame,
    centerX,
    centerY,
    left: centerX - width / 2,
    top: centerY - height / 2,
    width,
    height,
    unscaledLeft: centerX - frame.frameWidth / 2,
    unscaledTop: centerY - frame.frameHeight / 2,
    unscaledWidth: frame.frameWidth,
    unscaledHeight: frame.frameHeight,
  };
}

export function getStickerPlacementRenderBox(
  placement: NoteStickerPlacement,
  layout: StickerCanvasLayout,
  sizeMultiplier: number,
  minimumBaseSize: number
): StickerPlacementRenderBox {
  const frame = getStickerPlacementFrame(
    placement,
    layout,
    sizeMultiplier,
    minimumBaseSize
  );
  return getStickerPlacementRenderBoxFromFrame(placement, layout, frame);
}

export function getStickerPlacementWindowRect(
  placement: NoteStickerPlacement,
  bounds: StickerPlacementBounds,
  sizeMultiplier: number,
  minimumBaseSize: number
): StickerPlacementWindowRect {
  const renderBox = getStickerPlacementRenderBox(
    placement,
    {
      width: bounds.width,
      height: bounds.height,
    },
    sizeMultiplier,
    minimumBaseSize
  );

  return {
    ...renderBox,
    x: bounds.x + renderBox.left,
    y: bounds.y + renderBox.top,
  };
}

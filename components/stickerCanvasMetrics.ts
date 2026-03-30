import type { NoteStickerPlacement } from '../services/noteStickers';

export interface StickerCanvasLayout {
  width: number;
  height: number;
}

interface StickerOutlineOffset {
  x: number;
  y: number;
}

const STICKER_OUTLINE_OFFSETS_ORTHOGONAL: StickerOutlineOffset[] = [
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
];

const STICKER_OUTLINE_OFFSETS_FULL: StickerOutlineOffset[] = [
  ...STICKER_OUTLINE_OFFSETS_ORTHOGONAL,
  { x: -0.82, y: -0.82 },
  { x: -0.82, y: 0.82 },
  { x: 0.82, y: -0.82 },
  { x: 0.82, y: 0.82 },
];

export function clampStickerScale(value: number) {
  return Math.max(0.35, Math.min(value, 3));
}

export function sortStickerPlacements(placements: NoteStickerPlacement[]) {
  return [...placements].sort((left, right) => left.zIndex - right.zIndex);
}

export function getStickerDimensions(
  placement: NoteStickerPlacement,
  layout: StickerCanvasLayout,
  sizeMultiplier: number,
  minimumBaseSize: number
) {
  const longestEdge = Math.max(placement.asset.width, placement.asset.height, 1);
  const baseSize = Math.max(minimumBaseSize, Math.min(layout.width, layout.height) * 0.3) * sizeMultiplier;
  const baseScale = baseSize / longestEdge;
  const scaledWidth = placement.asset.width * baseScale * clampStickerScale(placement.scale);
  const scaledHeight = placement.asset.height * baseScale * clampStickerScale(placement.scale);

  return {
    width: scaledWidth,
    height: scaledHeight,
  };
}

export function getStickerOutlineSize(width: number, height: number) {
  return Math.max(3, Math.min(8, Math.min(width, height) * 0.045));
}

export function getStickerOutlineOffsets(outlineSize: number) {
  return outlineSize <= 4.75
    ? STICKER_OUTLINE_OFFSETS_ORTHOGONAL
    : STICKER_OUTLINE_OFFSETS_FULL;
}

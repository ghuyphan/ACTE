import type { NoteStickerPlacement } from '../../../services/noteStickers';

export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StickerCreationCompletePayload {
  placement: NoteStickerPlacement;
  sourceRect: WindowRect;
  entryDelayMs?: number;
}

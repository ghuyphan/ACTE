export type StickerRenderMode = 'default' | 'stamp';
export type StickerStampStyle = 'classic' | 'circle';

export interface ParsedStickerPlacementAsset {
  id: string;
  localUri: string;
  mimeType: string;
  width?: number;
  height?: number;
}

export interface ParsedStickerPlacement {
  id: string;
  assetId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex: number;
  opacity: number;
  outlineEnabled?: boolean;
  motionLocked?: boolean;
  renderMode?: StickerRenderMode;
  stampStyle?: StickerStampStyle;
  asset: ParsedStickerPlacementAsset;
}

export function parseStoredStickerPlacements(
  placementsJson: string | null | undefined
): ParsedStickerPlacement[] {
  if (!placementsJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(placementsJson);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((placement): placement is ParsedStickerPlacement => {
      if (!placement || typeof placement !== 'object') {
        return false;
      }

      const maybePlacement = placement as Partial<ParsedStickerPlacement>;
      return (
        typeof maybePlacement.id === 'string' &&
        typeof maybePlacement.assetId === 'string' &&
        typeof maybePlacement.x === 'number' &&
        typeof maybePlacement.y === 'number' &&
        typeof maybePlacement.scale === 'number' &&
        typeof maybePlacement.rotation === 'number' &&
        typeof maybePlacement.zIndex === 'number' &&
        typeof maybePlacement.opacity === 'number' &&
        (typeof maybePlacement.outlineEnabled === 'undefined' ||
          typeof maybePlacement.outlineEnabled === 'boolean') &&
        (typeof maybePlacement.motionLocked === 'undefined' ||
          typeof maybePlacement.motionLocked === 'boolean') &&
        (typeof maybePlacement.renderMode === 'undefined' ||
          maybePlacement.renderMode === 'default' ||
          maybePlacement.renderMode === 'stamp') &&
        (typeof maybePlacement.stampStyle === 'undefined' ||
          maybePlacement.stampStyle === 'classic' ||
          maybePlacement.stampStyle === 'circle') &&
        Boolean(
          maybePlacement.asset &&
            typeof maybePlacement.asset === 'object' &&
            typeof maybePlacement.asset.id === 'string' &&
            typeof maybePlacement.asset.localUri === 'string' &&
            typeof maybePlacement.asset.mimeType === 'string'
        )
      );
    });
  } catch {
    return [];
  }
}

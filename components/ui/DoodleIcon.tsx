import React, { memo } from 'react';
import SkiaStrokeIcon from './SkiaStrokeIcon';

type DoodleIconProps = {
  size?: number;
  color?: string;
};

const VIEWBOX_SIZE = 512;
const SCRIBBLE_PATH =
  'M 64 240 C 192 80, 320 80, 224 240 C 128 400, 256 400, 384 240';
const PENCIL_PATH =
  'M 384 240 L 384 192 L 448 128 A 34 34 0 0 1 496 176 L 432 240 Z';
const TIP_DIVIDER_PATH = 'M 384 192 L 432 240';
const ERASER_DIVIDER_PATH = 'M 432 144 L 480 192';

function DoodleIcon({ size = 18, color = '#111111' }: DoodleIconProps) {
  return (
    <SkiaStrokeIcon
      color={color}
      paths={[SCRIBBLE_PATH, PENCIL_PATH, TIP_DIVIDER_PATH, ERASER_DIVIDER_PATH]}
      size={size}
      strokeWidth={32}
      viewBoxSize={VIEWBOX_SIZE}
    />
  );
}

export default memo(DoodleIcon);

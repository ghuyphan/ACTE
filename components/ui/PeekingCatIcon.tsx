import React, { memo } from 'react';
import SkiaStrokeIcon from './SkiaStrokeIcon';

type PeekingCatIconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

const VIEWBOX_SIZE = 24;
const PATHS = [
  'M 7 13 V 8.5 L 8.4 5 L 10.3 7 Q 12 6.2 13.7 7 L 15.6 5 L 17 8.5 V 13',
  'M 7 9.3 L 4.6 8.8',
  'M 7 10.8 L 4.4 11',
  'M 17 9.3 L 19.4 8.8',
  'M 17 10.8 L 19.6 11',
  'M 10.2 8.9 L 10.2 10.2',
  'M 13.8 8.9 L 13.8 10.2',
  'M 2 13 H 22',
  'M 8 13 V 14.5 A 1 1 0 0 0 10 14.5 V 13',
  'M 14 13 V 14.5 A 1 1 0 0 0 16 14.5 V 13',
];

function PeekingCatIcon({
  size = 42,
  color = '#111111',
  strokeWidth = 1.08,
}: PeekingCatIconProps) {
  return (
    <SkiaStrokeIcon
      color={color}
      paths={PATHS}
      size={size}
      strokeWidth={strokeWidth}
      viewBoxSize={VIEWBOX_SIZE}
    />
  );
}

export default memo(PeekingCatIcon);

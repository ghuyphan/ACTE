import React, { memo } from 'react';
import SkiaStrokeIcon from './SkiaStrokeIcon';

type SittingCatIconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

const VIEWBOX_SIZE = 24;
const PATHS = [
  'M 7 13 V 8.5 L 8.4 5 L 10.3 7 Q 12 6.2 13.7 7 L 15.6 5 L 17 8.5 V 13 Q 12 15 7 13 Z',
  'M 7 9.3 L 4.6 8.8',
  'M 7 10.8 L 4.4 11',
  'M 17 9.3 L 19.4 8.8',
  'M 17 10.8 L 19.6 11',
  'M 10.2 8.9 L 10.2 10.2',
  'M 13.8 8.9 L 13.8 10.2',
  'M 7.5 13.5 C 7.5 18, 6 21.5, 9 21.5 H 15 C 18 21.5, 16.5 18, 16.5 13.5',
  'M 10.5 16 V 21.5',
  'M 13.5 16 V 21.5',
  'M 16 20.5 C 20 21.5, 23 18, 20 14 C 19 12, 17.5 12, 16.5 13',
];

function SittingCatIcon({
  size = 42,
  color = '#111111',
  strokeWidth = 1.08,
}: SittingCatIconProps) {
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

export default memo(SittingCatIcon);

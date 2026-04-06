import type { ReactNode } from 'react';

export type StickerSourceAction = {
  key: string;
  iconName: 'images-outline' | 'pricetag-outline' | 'clipboard-outline' | 'scan-outline';
  renderIcon?: ({ color, size }: { color: string; size: number }) => ReactNode;
  label: string;
  description: string;
  onPress: () => void;
  testID: string;
};

export type StickerAction =
  | 'rotate-left'
  | 'rotate-right'
  | 'smaller'
  | 'larger'
  | 'duplicate'
  | 'front'
  | 'remove'
  | 'outline-toggle'
  | 'motion-lock-toggle'
  | 'stamp-toggle';

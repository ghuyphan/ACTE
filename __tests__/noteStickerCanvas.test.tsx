import React from 'react';
import { render } from '@testing-library/react-native';
import NoteStickerCanvas from '../components/NoteStickerCanvas';
import type { NoteStickerPlacement } from '../services/noteStickers';

jest.mock('expo-image', () => {
  const React = require('react');
  const { Image } = require('react-native');

  return {
    Image: React.forwardRef((props: any, ref: any) => <Image ref={ref} {...props} />),
  };
});

const stickerPlacement: NoteStickerPlacement = {
  id: 'placement-1',
  assetId: 'asset-1',
  x: 0.5,
  y: 0.5,
  scale: 1,
  rotation: 0,
  zIndex: 1,
  opacity: 1,
  asset: {
    id: 'asset-1',
    ownerUid: '__local__',
    localUri: 'file:///stickers/sticker-1.png',
    remotePath: null,
    mimeType: 'image/png',
    width: 240,
    height: 180,
    createdAt: '2026-03-26T00:00:00.000Z',
    updatedAt: null,
    source: 'import',
  },
};

describe('NoteStickerCanvas', () => {
  it('renders a white outline layer for each sticker', () => {
    const { getByTestId } = render(<NoteStickerCanvas placements={[stickerPlacement]} />);

    expect(getByTestId('note-sticker-outline-placement-1')).toBeTruthy();
  });
});

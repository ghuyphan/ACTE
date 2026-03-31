import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
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

  it('skips the generated outline when a sticker disables it', () => {
    const { queryByTestId } = render(
      <NoteStickerCanvas placements={[{ ...stickerPlacement, outlineEnabled: false }]} />
    );

    expect(queryByTestId('note-sticker-outline-placement-1')).toBeNull();
  });

  it('lets editable canvases react to empty-space taps', () => {
    const onPressCanvas = jest.fn();
    const { getByTestId } = render(
      <NoteStickerCanvas placements={[stickerPlacement]} editable onPressCanvas={onPressCanvas} />
    );

    fireEvent.press(getByTestId('note-sticker-canvas-empty'));

    expect(onPressCanvas).toHaveBeenCalledTimes(1);
  });

  it('uses transform-based scaling and disables image transition while editable', () => {
    const { getByTestId } = render(
      <NoteStickerCanvas placements={[{ ...stickerPlacement, scale: 1.8, rotation: 12 }]} editable />
    );

    expect(getByTestId('note-sticker-wrap-placement-1').props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transform: [{ scale: 1.8 }, { rotate: '12deg' }],
        }),
      ])
    );
    expect(getByTestId('note-sticker-image-placement-1').props.transition).toBe(0);
  });
});

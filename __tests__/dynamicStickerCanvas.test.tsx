import React from 'react';
import { render } from '@testing-library/react-native';
import DynamicStickerCanvas from '../components/DynamicStickerCanvas';
import type { NoteStickerPlacement } from '../services/noteStickers';
import { useStickerPhysics } from '../hooks/useStickerPhysics';

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    LinearGradient: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

jest.mock('../hooks/useStickerPhysics', () => ({
  useStickerPhysics: jest.fn(() => ({ value: [] })),
}));

const mockedUseStickerPhysics = useStickerPhysics as jest.MockedFunction<typeof useStickerPhysics>;

const stickerPlacement: NoteStickerPlacement = {
  id: 'placement-1',
  assetId: 'asset-1',
  x: 0.5,
  y: 0.5,
  scale: 1,
  rotation: 12,
  zIndex: 1,
  opacity: 0.9,
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

describe('DynamicStickerCanvas', () => {
  beforeEach(() => {
    mockedUseStickerPhysics.mockClear();
  });

  it('wires active sticker cards into the physics hook', () => {
    const { getByTestId } = render(
      <DynamicStickerCanvas placements={[stickerPlacement]} isActive motionVariant="water" />
    );

    expect(mockedUseStickerPhysics).toHaveBeenCalledWith(
      expect.objectContaining({
        placements: [stickerPlacement],
        isActive: true,
        motionVariant: 'water',
      })
    );
    expect(getByTestId('dynamic-sticker-water-fill')).toBeTruthy();
  });

  it('keeps the physics hook inactive for static sticker cards', () => {
    const { queryByTestId } = render(
      <DynamicStickerCanvas placements={[stickerPlacement]} isActive={false} />
    );

    expect(mockedUseStickerPhysics).toHaveBeenCalledWith(
      expect.objectContaining({
        placements: [stickerPlacement],
        isActive: false,
      })
    );
    expect(queryByTestId('dynamic-sticker-water-fill')).toBeNull();
  });
});

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { View } from 'react-native';
import DynamicStickerCanvas from '../components/notes/DynamicStickerCanvas';
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

  function reportCanvasLayout(view: ReturnType<typeof render>, width = 300, height = 300) {
    const layoutHost = view.UNSAFE_queryAllByType(View).find(
      (node) => typeof node.props.onLayout === 'function'
    );

    expect(layoutHost).toBeTruthy();

    fireEvent(layoutHost!, 'layout', {
      nativeEvent: {
        layout: {
          width,
          height,
        },
      },
    });
  }

  it('keeps physics inactive until real card bounds are available', () => {
    const view = render(
      <DynamicStickerCanvas placements={[stickerPlacement]} isActive motionVariant="water" />
    );

    expect(mockedUseStickerPhysics).toHaveBeenLastCalledWith(
      expect.objectContaining({
        placements: [stickerPlacement],
        isActive: false,
        layout: { width: 0, height: 0 },
        motionVariant: 'water',
      })
    );

    reportCanvasLayout(view);

    expect(mockedUseStickerPhysics).toHaveBeenLastCalledWith(
      expect.objectContaining({
        placements: [stickerPlacement],
        isActive: true,
        layout: { width: 300, height: 300 },
        motionVariant: 'water',
      })
    );
  });

  it('keeps the physics hook inactive for static sticker cards', () => {
    const view = render(<DynamicStickerCanvas placements={[stickerPlacement]} isActive={false} />);

    reportCanvasLayout(view);

    expect(mockedUseStickerPhysics).toHaveBeenLastCalledWith(
      expect.objectContaining({
        placements: [stickerPlacement],
        isActive: false,
        layout: { width: 300, height: 300 },
      })
    );
  });

  it('keeps the physics hook inactive when sticker motion is locked', () => {
    const view = render(
      <DynamicStickerCanvas
        placements={[
          { ...stickerPlacement, id: 'locked-placement', motionLocked: true },
          { ...stickerPlacement, id: 'free-placement' },
        ]}
        isActive
      />
    );

    reportCanvasLayout(view);

    expect(mockedUseStickerPhysics).toHaveBeenLastCalledWith(
      expect.objectContaining({
        placements: [{ ...stickerPlacement, id: 'free-placement' }],
        isActive: true,
      })
    );
  });

  it('does not mount physics when every sticker has locked motion', () => {
    const view = render(
      <DynamicStickerCanvas
        placements={[
          { ...stickerPlacement, id: 'locked-placement-1', motionLocked: true },
          { ...stickerPlacement, id: 'locked-placement-2', motionLocked: true },
        ]}
        isActive
      />
    );

    reportCanvasLayout(view);

    expect(mockedUseStickerPhysics).toHaveBeenLastCalledWith(
      expect.objectContaining({
        placements: [],
        isActive: false,
        layout: { width: 300, height: 300 },
      })
    );
  });
});

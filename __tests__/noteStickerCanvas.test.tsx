import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { View } from 'react-native';
import NoteStickerCanvas from '../components/notes/NoteStickerCanvas';
import type { NoteStickerPlacement } from '../services/noteStickers';

let mockStampCanvasRenderCount = 0;

jest.mock('@shopify/react-native-skia', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockCanvas = ({ children, testID, ...props }: any) => {
    if (testID?.startsWith('note-sticker-stamp-')) {
      mockStampCanvasRenderCount += 1;
    }
    return (
      <View testID={testID} {...props}>
        {children}
      </View>
    );
  };

  const MockGroup = ({ children }: any) => <>{children}</>;
  const MockPath = (props: any) => <View {...props} />;
  const MockImage = (props: any) => <View {...props} />;

  return {
    Canvas: MockCanvas,
    Group: MockGroup,
    Image: MockImage,
    Path: MockPath,
    PathOp: {
      Difference: 'difference',
    },
    Skia: {
      Path: {
        Make: () => ({
          addRRect: jest.fn(),
          addRect: jest.fn(),
          addCircle: jest.fn(),
          op: jest.fn(),
        }),
      },
    },
    useImage: jest.fn(() => ({ mock: 'image' })),
  };
});

jest.mock('expo-image', () => {
  const React = require('react');
  const { Image } = require('react-native');

  const MockExpoImage = React.forwardRef(function MockExpoImage(props: any, ref: any) {
    return <Image ref={ref} {...props} />;
  });

  return {
    Image: MockExpoImage,
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
  beforeEach(() => {
    mockStampCanvasRenderCount = 0;
  });

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

  it('uses the stamp artwork without the generated outline in stamp mode', () => {
    const { queryByTestId, getByTestId } = render(
      <NoteStickerCanvas placements={[{ ...stickerPlacement, renderMode: 'stamp' }]} />
    );

    expect(queryByTestId('note-sticker-outline-placement-1')).toBeNull();
    expect(getByTestId('note-sticker-stamp-placement-1')).toBeTruthy();
  });

  it('keeps stamp stickers in the normal compositing path', () => {
    const { getByTestId } = render(
      <NoteStickerCanvas placements={[{ ...stickerPlacement, renderMode: 'stamp' }]} />
    );

    expect(getByTestId('note-sticker-stamp-paper-placement-1').props.shouldRasterizeIOS).toBeUndefined();
    expect(
      getByTestId('note-sticker-stamp-paper-placement-1').props.renderToHardwareTextureAndroid
    ).toBeUndefined();
  });

  it('does not rerender stamp artwork when editable toggles without placement changes', () => {
    const placements = [{ ...stickerPlacement, renderMode: 'stamp' as const }];
    const { rerender } = render(<NoteStickerCanvas placements={placements} editable={false} />);

    expect(mockStampCanvasRenderCount).toBe(1);

    rerender(<NoteStickerCanvas placements={placements} editable />);
    rerender(<NoteStickerCanvas placements={placements} editable={false} />);

    expect(mockStampCanvasRenderCount).toBe(1);
  });

  it('does not rerender stamp artwork for repeated identical layout events', () => {
    const placements = [{ ...stickerPlacement, renderMode: 'stamp' as const }];
    const view = render(<NoteStickerCanvas placements={placements} />);
    const layoutHost = view.UNSAFE_queryAllByType(View).find((node) => typeof node.props.onLayout === 'function');

    expect(layoutHost).toBeTruthy();

    fireEvent(layoutHost!, 'layout', {
      nativeEvent: {
        layout: {
          width: 300,
          height: 300,
        },
      },
    });

    expect(mockStampCanvasRenderCount).toBe(2);

    fireEvent(layoutHost!, 'layout', {
      nativeEvent: {
        layout: {
          width: 300,
          height: 300,
        },
      },
    });

    expect(mockStampCanvasRenderCount).toBe(2);
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

  it('renders lock and outline controls on the selected editable sticker', () => {
    const { getByTestId } = render(
      <NoteStickerCanvas
        placements={[stickerPlacement]}
        editable
        selectedPlacementId="placement-1"
        onToggleSelectedPlacementMotionLock={jest.fn()}
        onToggleSelectedPlacementOutline={jest.fn()}
      />
    );

    expect(getByTestId('note-sticker-lock-toggle-placement-1')).toBeTruthy();
    expect(getByTestId('note-sticker-outline-toggle-placement-1')).toBeTruthy();
  });

  it('hides the outline control for selected stamp stickers', () => {
    const { getByTestId, queryByTestId } = render(
      <NoteStickerCanvas
        placements={[{ ...stickerPlacement, renderMode: 'stamp' }]}
        editable
        selectedPlacementId="placement-1"
        onToggleSelectedPlacementMotionLock={jest.fn()}
        onToggleSelectedPlacementOutline={jest.fn()}
      />
    );

    expect(getByTestId('note-sticker-lock-toggle-placement-1')).toBeTruthy();
    expect(queryByTestId('note-sticker-outline-toggle-placement-1')).toBeNull();
  });
});

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { View } from 'react-native';
import NoteStickerCanvas from '../components/notes/NoteStickerCanvas';
import type { NoteStickerPlacement } from '../services/noteStickers';
import * as FileSystem from '../utils/fileSystem';

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

    expect(getByTestId('note-sticker-transform-placement-1').props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transform: [{ scale: 1.8 }, { rotate: '12deg' }],
        }),
      ])
    );
    expect(getByTestId('note-sticker-image-placement-1').props.transition).toBe(0);
  });

  it('reports sticker artwork ready after the real image finishes loading', async () => {
    const onImagesReady = jest.fn();
    const { getByTestId } = render(
      <NoteStickerCanvas placements={[stickerPlacement]} onImagesReady={onImagesReady} />
    );

    fireEvent(getByTestId('note-sticker-image-placement-1'), 'loadEnd');

    await waitFor(() => {
      expect(onImagesReady).toHaveBeenCalledTimes(1);
    });
  });

  it('uses a single native image without generated outlines for view-shot exports', async () => {
    const onImagesReady = jest.fn();
    const exportPlacement = {
      ...stickerPlacement,
      asset: {
        ...stickerPlacement.asset,
        localUri: 'data:image/png;base64,abc123',
      },
    };
    const { getByTestId, queryByTestId } = render(
      <NoteStickerCanvas
        placements={[exportPlacement]}
        onImagesReady={onImagesReady}
        viewShotCompatibleImages
      />
    );

    expect(queryByTestId('note-sticker-outline-placement-1')).toBeNull();

    fireEvent(getByTestId('note-sticker-image-placement-1'), 'loadEnd');

    await waitFor(() => {
      expect(onImagesReady).toHaveBeenCalledTimes(1);
    });
  });

  it('inlines local sticker files before reporting view-shot export readiness', async () => {
    const readAsStringSpy = jest
      .spyOn(FileSystem, 'readAsStringAsync')
      .mockResolvedValueOnce('abc123');
    const onImagesReady = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <NoteStickerCanvas
        placements={[stickerPlacement]}
        onImagesReady={onImagesReady}
        viewShotCompatibleImages
      />
    );

    expect(queryByTestId('note-sticker-image-placement-1')).toBeNull();

    await waitFor(() => {
      expect(getByTestId('note-sticker-image-placement-1').props.source.uri).toBe(
        'data:image/png;base64,abc123'
      );
    });

    fireEvent(getByTestId('note-sticker-image-placement-1'), 'loadEnd');

    await waitFor(() => {
      expect(onImagesReady).toHaveBeenCalledTimes(1);
    });
    expect(readAsStringSpy).toHaveBeenCalledWith('file:///stickers/sticker-1.png', {
      encoding: FileSystem.EncodingType.Base64,
    });

    readAsStringSpy.mockRestore();
  });

  it('reports stamp artwork ready after the Skia image resolves', async () => {
    const onImagesReady = jest.fn();
    render(
      <NoteStickerCanvas
        placements={[{ ...stickerPlacement, renderMode: 'stamp' }]}
        onImagesReady={onImagesReady}
      />
    );

    await waitFor(() => {
      expect(onImagesReady).toHaveBeenCalledTimes(1);
    });
  });

  it('renders lock, outline, and delete controls on the selected editable sticker', () => {
    const { getByTestId } = render(
      <NoteStickerCanvas
        placements={[stickerPlacement]}
        editable
        selectedPlacementId="placement-1"
        onToggleSelectedPlacementMotionLock={jest.fn()}
        onToggleSelectedPlacementOutline={jest.fn()}
        onRemoveSelectedPlacement={jest.fn()}
      />
    );

    expect(getByTestId('note-sticker-lock-toggle-placement-1')).toBeTruthy();
    expect(getByTestId('note-sticker-outline-toggle-placement-1')).toBeTruthy();
    expect(getByTestId('note-sticker-remove-placement-1')).toBeTruthy();
  });

  it('keeps the selected sticker controls inside the card near the top-right corner', () => {
    const view = render(
      <NoteStickerCanvas
        placements={[{ ...stickerPlacement, x: 0.96, y: 0.04 }]}
        editable
        selectedPlacementId="placement-1"
        onToggleSelectedPlacementMotionLock={jest.fn()}
        onToggleSelectedPlacementOutline={jest.fn()}
        onRemoveSelectedPlacement={jest.fn()}
      />
    );
    const layoutHost = view.UNSAFE_queryAllByType(View).find((node) => typeof node.props.onLayout === 'function');

    fireEvent(layoutHost!, 'layout', {
      nativeEvent: {
        layout: {
          width: 300,
          height: 300,
        },
      },
    });

    expect(view.getByTestId('note-sticker-controls-placement-1').props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bottom: -14,
          left: -14,
        }),
      ])
    );
  });

  it('lets a selected sticker re-enable its outline after disabling it', () => {
    const onToggleOutline = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <NoteStickerCanvas
        placements={[{ ...stickerPlacement, outlineEnabled: false }]}
        editable
        selectedPlacementId="placement-1"
        onToggleSelectedPlacementOutline={onToggleOutline}
        onRemoveSelectedPlacement={jest.fn()}
      />
    );

    expect(queryByTestId('note-sticker-outline-placement-1')).toBeNull();

    fireEvent.press(getByTestId('note-sticker-outline-toggle-placement-1'));

    expect(onToggleOutline).toHaveBeenCalledWith('placement-1');
  });

  it('keeps lock and delete controls for selected stamp stickers', () => {
    const { getByTestId, queryByTestId } = render(
      <NoteStickerCanvas
        placements={[{ ...stickerPlacement, renderMode: 'stamp' }]}
        editable
        selectedPlacementId="placement-1"
        onToggleSelectedPlacementMotionLock={jest.fn()}
        onToggleSelectedPlacementOutline={jest.fn()}
        onRemoveSelectedPlacement={jest.fn()}
      />
    );

    expect(getByTestId('note-sticker-lock-toggle-placement-1')).toBeTruthy();
    expect(queryByTestId('note-sticker-outline-toggle-placement-1')).toBeNull();
    expect(getByTestId('note-sticker-remove-placement-1')).toBeTruthy();
  });
});

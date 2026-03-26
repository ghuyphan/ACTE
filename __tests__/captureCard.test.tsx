import React from 'react';
import { Alert, Animated, View } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { getImageAsync, hasImageAsync } from 'expo-clipboard';
import { deleteAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import { importStickerAsset } from '../services/noteStickers';
import CaptureCard, { type CaptureCardHandle } from '../components/home/CaptureCard';

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{name}</Text>,
  };
});

jest.mock('expo-camera', () => ({
  CameraView: () => null,
}));

jest.mock('expo-clipboard', () => ({
  __esModule: true,
  hasImageAsync: jest.fn(),
  getImageAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  __esModule: true,
  cacheDirectory: 'file:///cache/',
  EncodingType: {
    Base64: 'base64',
  },
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

jest.mock('expo-image', () => ({
  Image: () => null,
}));

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

jest.mock('../components/ui/GlassView', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GlassView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

jest.mock('../components/ui/PrimaryButton', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return function MockPrimaryButton({ label, onPress }: any) {
    return (
      <Pressable onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    );
  };
});

jest.mock('../utils/platform', () => ({
  isOlderIOS: false,
}));

jest.mock('../components/NoteDoodleCanvas', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');

  return {
    __esModule: true,
    default: function MockNoteDoodleCanvas(props: any) {
      return (
        <View testID="mock-doodle-canvas">
          <Text testID="mock-doodle-editable">{String(props.editable)}</Text>
          <Pressable
            testID="mock-doodle-commit"
            onPress={() =>
              props.onChangeStrokes?.([
                { color: '#1C1C1E', points: [0.1, 0.1, 0.2, 0.2] },
                { color: '#1C1C1E', points: [0.3, 0.3, 0.4, 0.4] },
              ])
            }
          />
        </View>
      );
    },
  };
});

jest.mock('../components/NoteStickerCanvas', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: function MockNoteStickerCanvas() {
      return <View testID="mock-sticker-canvas" />;
    },
  };
});

jest.mock('../services/noteStickers', () => ({
  bringStickerPlacementToFront: jest.fn((placements: any[]) => placements),
  createStickerPlacement: jest.fn((asset: any, existingPlacements: any[] = []) => ({
    id: `placement-${existingPlacements.length + 1}`,
    assetId: asset.id,
    x: 0.5,
    y: 0.5,
    scale: 1,
    rotation: 0,
    zIndex: existingPlacements.length + 1,
    opacity: 1,
    asset,
  })),
  duplicateStickerPlacement: jest.fn((placements: any[]) => placements),
  importStickerAsset: jest.fn(),
  updateStickerPlacementTransform: jest.fn((placements: any[]) => placements),
}));

const mockClipboardHasImageAsync = hasImageAsync as jest.MockedFunction<typeof hasImageAsync>;
const mockClipboardGetImageAsync = getImageAsync as jest.MockedFunction<typeof getImageAsync>;
const mockWriteAsStringAsync = writeAsStringAsync as jest.MockedFunction<typeof writeAsStringAsync>;
const mockDeleteAsync = deleteAsync as jest.MockedFunction<typeof deleteAsync>;
const mockImportStickerAsset = importStickerAsset as jest.MockedFunction<typeof importStickerAsset>;

function createCaptureCardProps(
  ref: React.RefObject<CaptureCardHandle | null>,
  props: Partial<React.ComponentProps<typeof CaptureCard>> = {}
) {
  const animatedValue = new Animated.Value(1);
  const zeroValue = new Animated.Value(0);

  return {
    ref,
    snapHeight: 700,
    topInset: 0,
    isSearching: false,
    captureMode: 'text' as const,
    cameraSessionKey: 1,
    captureScale: animatedValue,
    captureTranslateY: zeroValue,
    colors: {
      primary: '#FFC107',
      primarySoft: 'rgba(255, 193, 7, 0.2)',
      captureButtonBg: '#1C1C1E',
      card: '#FFFFFF',
      border: '#E5E5EA',
      text: '#1C1C1E',
      secondaryText: '#8E8E93',
      captureCardText: '#1C1C1E',
      captureCardPlaceholder: 'rgba(28,28,30,0.48)',
      captureCardBorder: 'rgba(255,255,255,0.22)',
      captureGlassFill: 'rgba(255,252,246,0.62)',
      captureGlassBorder: 'rgba(255,255,255,0.3)',
      captureGlassText: '#2B2621',
      captureGlassIcon: 'rgba(43,38,33,0.52)',
      captureGlassPlaceholder: 'rgba(43,38,33,0.34)',
      captureGlassColorScheme: 'light' as const,
      captureCameraOverlay: 'rgba(28,28,30,0.48)',
      captureCameraOverlayBorder: 'rgba(255,255,255,0.16)',
      captureCameraOverlayText: '#FFFDFC',
      captureFlashOverlay: 'rgba(255,250,242,0.96)',
    },
    t: ((_: string, fallback?: string) => fallback ?? '') as any,
    noteText: 'Draft memory',
    onChangeNoteText: () => undefined,
    restaurantName: 'Cafe',
    onChangeRestaurantName: () => undefined,
    capturedPhoto: null,
    onRetakePhoto: () => undefined,
    needsCameraPermission: false,
    onRequestCameraPermission: () => undefined,
    facing: 'back' as const,
    onToggleFacing: () => undefined,
    onOpenPhotoLibrary: () => undefined,
    cameraRef: { current: null },
    shouldRenderCameraPreview: false,
    flashAnim: zeroValue,
    permissionGranted: true,
    onShutterPressIn: () => undefined,
    onShutterPressOut: () => undefined,
    onTakePicture: () => undefined,
    onSaveNote: () => undefined,
    onOpenNotes: () => undefined,
    saving: false,
    shutterScale: animatedValue,
    cameraStatusText: null,
    libraryImportLocked: false,
    importingPhoto: false,
    shareTarget: 'private' as const,
    onChangeShareTarget: () => undefined,
    footerContent: <View />,
    ...props,
  };
}

function renderCaptureCard(
  ref: React.RefObject<CaptureCardHandle | null>,
  props: Partial<React.ComponentProps<typeof CaptureCard>> = {}
) {
  return render(<CaptureCard {...createCaptureCardProps(ref, props)} />);
}

describe('CaptureCard doodle handle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteAsStringAsync.mockResolvedValue(undefined);
    mockDeleteAsync.mockResolvedValue(undefined);
    mockImportStickerAsset.mockResolvedValue({
      id: 'sticker-asset-1',
      ownerUid: '__local__',
      localUri: 'file:///documents/stickers/sticker-asset-1.png',
      remotePath: null,
      mimeType: 'image/png',
      width: 120,
      height: 120,
      createdAt: '2026-03-26T00:00:00.000Z',
      updatedAt: null,
      source: 'import',
    });
  });

  it('shows the restaurant field by default in text mode', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const { getByTestId } = renderCaptureCard(ref, {
      restaurantName: '',
    });

    expect(getByTestId('capture-restaurant-input')).toBeTruthy();
  });

  it('tracks local doodle state through the imperative handle', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const { getByTestId } = renderCaptureCard(ref);

    expect(ref.current?.getDoodleSnapshot()).toEqual({ enabled: false, strokes: [] });

    act(() => {
      fireEvent.press(getByTestId('capture-decorate-toggle'));
    });
    act(() => {
      fireEvent.press(getByTestId('capture-doodle-toggle'));
    });
    expect(getByTestId('mock-doodle-editable')).toHaveTextContent('true');

    act(() => {
      fireEvent.press(getByTestId('mock-doodle-commit'));
    });
    expect(ref.current?.getDoodleSnapshot()).toEqual({
      enabled: true,
      strokes: [
        { color: '#1C1C1E', points: [0.1, 0.1, 0.2, 0.2] },
        { color: '#1C1C1E', points: [0.3, 0.3, 0.4, 0.4] },
      ],
    });

    act(() => {
      fireEvent.press(getByTestId('capture-doodle-undo'));
    });
    expect(ref.current?.getDoodleSnapshot()).toEqual({
      enabled: true,
      strokes: [{ color: '#1C1C1E', points: [0.1, 0.1, 0.2, 0.2] }],
    });

    act(() => {
      fireEvent.press(getByTestId('capture-doodle-clear'));
    });
    expect(ref.current?.getDoodleSnapshot()).toEqual({ enabled: true, strokes: [] });

    act(() => {
      ref.current?.resetDoodle();
    });

    expect(ref.current?.getDoodleSnapshot()).toEqual({ enabled: false, strokes: [] });
    expect(getByTestId('mock-doodle-editable')).toHaveTextContent('false');
  });

  it('keeps the raw draft value so typing spaces is not rewritten away', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const handleChangeNoteText = jest.fn();
    const { getByTestId } = renderCaptureCard(ref, {
      noteText: 'coffee ',
      onChangeNoteText: handleChangeNoteText,
    });

    const input = getByTestId('capture-note-input');

    expect(input.props.value).toBe('coffee ');

    fireEvent.changeText(input, 'coffee break ');
    expect(handleChangeNoteText).toHaveBeenCalledWith('coffee break ');
  });

  it('commits the matching emoji into the text after a completed phrase', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const handleChangeNoteText = jest.fn();
    const { getByTestId } = renderCaptureCard(ref, {
      noteText: 'Ca phe',
      onChangeNoteText: handleChangeNoteText,
    });

    fireEvent.changeText(getByTestId('capture-note-input'), 'Ca phe ');
    expect(handleChangeNoteText).toHaveBeenCalledWith('Ca phe ☕️ ');
  });

  it('rotates the text placeholder when the draft becomes empty again', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const view = renderCaptureCard(ref, {
      noteText: '',
    });

    const firstPlaceholder = view.getByTestId('capture-note-input').props.placeholder;

    view.rerender(<CaptureCard {...createCaptureCardProps(ref, { noteText: 'Draft memory' })} />);
    view.rerender(<CaptureCard {...createCaptureCardProps(ref, { noteText: '' })} />);

    expect(view.getByTestId('capture-note-input').props.placeholder).not.toBe(firstPlaceholder);
  });

  it('keeps doodle editing available on captured photos', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const { getByTestId } = renderCaptureCard(ref, {
      captureMode: 'camera',
      capturedPhoto: 'file:///photo.jpg',
    });

    act(() => {
      fireEvent.press(getByTestId('capture-decorate-toggle'));
    });
    act(() => {
      fireEvent.press(getByTestId('capture-doodle-toggle'));
    });
    expect(getByTestId('mock-doodle-editable')).toHaveTextContent('true');

    act(() => {
      fireEvent.press(getByTestId('mock-doodle-commit'));
    });
    expect(ref.current?.getDoodleSnapshot().strokes).toHaveLength(2);
  });

  it('keeps text and photo doodle drafts separate', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const view = renderCaptureCard(ref);

    act(() => {
      fireEvent.press(view.getByTestId('capture-decorate-toggle'));
    });
    act(() => {
      fireEvent.press(view.getByTestId('capture-doodle-toggle'));
    });
    act(() => {
      fireEvent.press(view.getByTestId('mock-doodle-commit'));
    });
    expect(ref.current?.getDoodleSnapshot().strokes).toHaveLength(2);

    view.rerender(
      <CaptureCard
        ref={ref}
        snapHeight={700}
        topInset={0}
        isSearching={false}
        captureMode="camera"
        cameraSessionKey={1}
        captureScale={new Animated.Value(1)}
        captureTranslateY={new Animated.Value(0)}
        colors={{
          primary: '#FFC107',
          primarySoft: 'rgba(255, 193, 7, 0.2)',
          captureButtonBg: '#1C1C1E',
          card: '#FFFFFF',
          border: '#E5E5EA',
          text: '#1C1C1E',
          secondaryText: '#8E8E93',
          captureCardText: '#1C1C1E',
          captureCardPlaceholder: 'rgba(28,28,30,0.48)',
          captureCardBorder: 'rgba(255,255,255,0.22)',
          captureGlassFill: 'rgba(255,252,246,0.62)',
          captureGlassBorder: 'rgba(255,255,255,0.3)',
          captureGlassText: '#2B2621',
          captureGlassIcon: 'rgba(43,38,33,0.52)',
          captureGlassPlaceholder: 'rgba(43,38,33,0.34)',
          captureGlassColorScheme: 'light',
          captureCameraOverlay: 'rgba(28,28,30,0.48)',
          captureCameraOverlayBorder: 'rgba(255,255,255,0.16)',
          captureCameraOverlayText: '#FFFDFC',
          captureFlashOverlay: 'rgba(255,250,242,0.96)',
        }}
        t={((_: string, fallback?: string) => fallback ?? '') as any}
        noteText="Draft memory"
        onChangeNoteText={() => undefined}
        restaurantName="Cafe"
        onChangeRestaurantName={() => undefined}
        capturedPhoto="file:///photo.jpg"
        onRetakePhoto={() => undefined}
        needsCameraPermission={false}
        onRequestCameraPermission={() => undefined}
        facing="back"
        onToggleFacing={() => undefined}
        onOpenPhotoLibrary={() => undefined}
        cameraRef={{ current: null }}
        shouldRenderCameraPreview={false}
        flashAnim={new Animated.Value(0)}
        permissionGranted
        onShutterPressIn={() => undefined}
        onShutterPressOut={() => undefined}
        onTakePicture={() => undefined}
        onSaveNote={() => undefined}
        onOpenNotes={() => undefined}
        saving={false}
        shutterScale={new Animated.Value(1)}
        cameraStatusText={null}
        libraryImportLocked={false}
        importingPhoto={false}
        shareTarget="private"
        onChangeShareTarget={() => undefined}
        footerContent={<View />}
      />
    );

    expect(ref.current?.getDoodleSnapshot()).toEqual({ enabled: false, strokes: [] });
  });

  it('keeps the share toggle visible beside the restaurant field', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const handleChangeShareTarget = jest.fn();
    const { getByTestId } = renderCaptureCard(ref, {
      restaurantName: '',
      onChangeShareTarget: handleChangeShareTarget,
    });

    act(() => {
      fireEvent.press(getByTestId('capture-share-target-toggle'));
    });

    expect(handleChangeShareTarget).toHaveBeenCalledWith('shared');
  });

  it('pastes a sticker from the clipboard on long press in text mode', async () => {
    const ref = React.createRef<CaptureCardHandle>();
    mockClipboardHasImageAsync.mockResolvedValue(true);
    mockClipboardGetImageAsync.mockResolvedValue({
      data: 'data:image/png;base64,ZmFrZS1zdGlja2Vy',
      size: { width: 120, height: 120 },
    });

    const { getByTestId } = renderCaptureCard(ref, {
      noteText: '',
    });

    await act(async () => {
      fireEvent(getByTestId('capture-sticker-toggle'), 'longPress');
    });

    await waitFor(() => {
      expect(mockWriteAsStringAsync).toHaveBeenCalledWith(
        expect.stringContaining('file:///cache/clipboard-sticker-'),
        'ZmFrZS1zdGlja2Vy',
        { encoding: 'base64' }
      );
    });

    expect(mockImportStickerAsset).toHaveBeenCalledWith({
      uri: expect.stringContaining('file:///cache/clipboard-sticker-'),
      mimeType: 'image/png',
      name: 'clipboard-sticker.png',
    });
    expect(ref.current?.getStickerSnapshot().placements).toHaveLength(1);
  });

  it('pastes a sticker from the clipboard on long press in photo mode', async () => {
    const ref = React.createRef<CaptureCardHandle>();
    mockClipboardHasImageAsync.mockResolvedValue(true);
    mockClipboardGetImageAsync.mockResolvedValue({
      data: 'data:image/png;base64,cGhvdG8tc3RpY2tlcg==',
      size: { width: 140, height: 140 },
    });

    const { getByTestId } = renderCaptureCard(ref, {
      captureMode: 'camera',
      capturedPhoto: 'file:///photo.jpg',
    });

    await act(async () => {
      fireEvent(getByTestId('capture-sticker-toggle'), 'longPress');
    });

    await waitFor(() => {
      expect(ref.current?.getStickerSnapshot().placements).toHaveLength(1);
    });
  });

  it('shows a friendly alert when there is no clipboard image to paste', async () => {
    const ref = React.createRef<CaptureCardHandle>();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockClipboardHasImageAsync.mockResolvedValue(false);

    const { getByTestId } = renderCaptureCard(ref);

    await act(async () => {
      fireEvent(getByTestId('capture-sticker-toggle'), 'longPress');
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'No sticker to paste',
        'Copy a transparent sticker image first, then long press again to paste it.'
      );
    });
  });
});

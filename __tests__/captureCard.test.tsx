import React from 'react';
import { Alert, Platform, View } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { getImageAsync, hasImageAsync } from 'expo-clipboard';
import { deleteAsync, writeAsStringAsync } from '../utils/fileSystem';
import { importStickerAsset } from '../services/noteStickers';
import CaptureCard, { type CaptureCardHandle } from '../components/home/CaptureCard';

const transparentPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFAAH/e+m+7wAAAABJRU5ErkJggg==';
let mockClipboardPasteButtonAvailable = true;
let mockCameraViewProps: any = null;
let mockClipboardPastePayload: any = {
  type: 'image',
  data: 'data:image/png;base64,ZmFrZS1zdGlja2Vy',
  size: { width: 120, height: 120 },
};

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{name}</Text>,
  };
});

jest.mock('@expo/ui/swift-ui', () => {
  const { View } = require('react-native');
  return {
    BottomSheet: ({ children, isPresented }: any) => (isPresented ? <View>{children}</View> : null),
    Group: ({ children }: any) => <View>{children}</View>,
    Host: ({ children }: any) => <View>{children}</View>,
    RNHostView: ({ children }: any) => <View>{children}</View>,
  };
});

jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  environment: jest.fn(),
  presentationDragIndicator: jest.fn(),
}));

jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockCameraView = (props: any) => {
    mockCameraViewProps = props;
    return <View testID="mock-camera-view" />;
  };

  MockCameraView.isAvailableAsync = jest.fn(async () => true);

  return {
    CameraView: MockCameraView,
  };
});

jest.mock('expo-clipboard', () => ({
  __esModule: true,
  hasImageAsync: jest.fn(),
  getImageAsync: jest.fn(),
  ClipboardPasteButton: ({ onPress, testID, accessibilityLabel }: any) => {
    const React = require('react');
    const { Pressable } = require('react-native');

    if (!mockClipboardPasteButtonAvailable) {
      return null;
    }

    return (
      <Pressable
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        onPress={() => {
          if (mockClipboardPastePayload) {
            onPress(mockClipboardPastePayload);
          }
        }}
      />
    );
  },
  get isPasteButtonAvailable() {
    return mockClipboardPasteButtonAvailable;
  },
}));

jest.mock('../utils/fileSystem', () => ({
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

jest.mock('expo-image-picker', () => ({
  __esModule: true,
  getMediaLibraryPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

jest.mock('expo-sensors', () => ({
  DeviceMotion: {
    isAvailableAsync: jest.fn(async () => false),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

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

jest.mock('../components/AppBottomSheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockAppBottomSheet({ children, visible }: any) {
    return visible ? <View>{children}</View> : null;
  };
});

jest.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    isDark: false,
    colors: {
      text: '#1C1C1E',
      secondaryText: '#8E8E93',
      primary: '#FFC107',
      border: '#E5E5EA',
    },
  }),
}));

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
          <Text testID="mock-doodle-active-color">{String(props.activeColor)}</Text>
          <Pressable
            testID="mock-doodle-commit"
            onPress={() =>
              props.onChangeStrokes?.([
                { color: props.activeColor, points: [0.1, 0.1, 0.2, 0.2] },
                { color: props.activeColor, points: [0.3, 0.3, 0.4, 0.4] },
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
  const { Pressable, Text, View } = require('react-native');

  return {
    __esModule: true,
    default: function MockNoteStickerCanvas(props: any) {
      return (
        <View testID="mock-sticker-canvas">
          <Text testID="mock-sticker-editable">{String(props.editable)}</Text>
          <Text testID="mock-sticker-selected">{String(props.selectedPlacementId ?? 'null')}</Text>
          <Pressable testID="mock-sticker-canvas-empty" onPress={() => props.onPressCanvas?.()} />
        </View>
      );
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
    outlineEnabled: true,
    asset,
  })),
  duplicateStickerPlacement: jest.fn((placements: any[]) => placements),
  importStickerAsset: jest.fn(),
  setStickerPlacementOutlineEnabled: jest.fn((placements: any[], placementId: string, outlineEnabled: boolean) =>
    placements.map((placement) =>
      placement.id === placementId ? { ...placement, outlineEnabled } : placement
    )
  ),
  updateStickerPlacementTransform: jest.fn((placements: any[]) => placements),
}));

const mockClipboardHasImageAsync = hasImageAsync as jest.MockedFunction<typeof hasImageAsync>;
const mockClipboardGetImageAsync = getImageAsync as jest.MockedFunction<typeof getImageAsync>;
const mockWriteAsStringAsync = writeAsStringAsync as jest.MockedFunction<typeof writeAsStringAsync>;
const mockDeleteAsync = deleteAsync as jest.MockedFunction<typeof deleteAsync>;
const mockImportStickerAsset = importStickerAsset as jest.MockedFunction<typeof importStickerAsset>;
const createSharedValue = (initialValue: number) => ({ value: initialValue } as any);

function createCaptureCardProps(
  ref: React.RefObject<CaptureCardHandle | null>,
  props: Partial<React.ComponentProps<typeof CaptureCard>> = {}
) {
  const animatedValue = createSharedValue(1);
  const zeroValue = createSharedValue(0);

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
    cameraPermissionRequiresSettings: false,
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
    radius: 150,
    onChangeRadius: () => undefined,
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
    mockClipboardPasteButtonAvailable = true;
    mockCameraViewProps = null;
    mockClipboardPastePayload = {
      type: 'image',
      data: 'data:image/png;base64,ZmFrZS1zdGlja2Vy',
      size: { width: 120, height: 120 },
    };
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
    const { getByTestId } = renderCaptureCard(ref, {
      noteText: '',
    });

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

  it('mirrors the front camera preview and disables the native shutter animation', async () => {
    const ref = React.createRef<CaptureCardHandle>();
    renderCaptureCard(ref, {
      captureMode: 'camera',
      facing: 'front',
      shouldRenderCameraPreview: true,
    });

    await waitFor(() => {
      expect(mockCameraViewProps).toMatchObject({
        facing: 'front',
        mirror: true,
        animateShutter: false,
      });
    });
  });

  it('lets you change the text-card doodle color', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const { getByTestId } = renderCaptureCard(ref, {
      noteText: '',
    });

    act(() => {
      fireEvent.press(getByTestId('capture-decorate-toggle'));
    });
    act(() => {
      fireEvent.press(getByTestId('capture-doodle-toggle'));
    });

    expect(getByTestId('mock-doodle-active-color')).toHaveTextContent('#1C1C1E');

    act(() => {
      fireEvent.press(getByTestId('capture-doodle-color-2'));
    });

    expect(getByTestId('mock-doodle-active-color')).toHaveTextContent('#FFC107');

    act(() => {
      fireEvent.press(getByTestId('mock-doodle-commit'));
    });

    expect(ref.current?.getDoodleSnapshot()).toEqual({
      enabled: true,
      strokes: [
        { color: '#FFC107', points: [0.1, 0.1, 0.2, 0.2] },
        { color: '#FFC107', points: [0.3, 0.3, 0.4, 0.4] },
      ],
    });
  });

  it('lets you change the photo-card doodle color', () => {
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

    expect(getByTestId('mock-doodle-active-color')).toHaveTextContent('#FFFFFF');

    act(() => {
      fireEvent.press(getByTestId('capture-doodle-color-2'));
    });

    expect(getByTestId('mock-doodle-active-color')).toHaveTextContent('#FFC107');

    act(() => {
      fireEvent.press(getByTestId('mock-doodle-commit'));
    });

    expect(ref.current?.getDoodleSnapshot()).toEqual({
      enabled: true,
      strokes: [
        { color: '#FFC107', points: [0.1, 0.1, 0.2, 0.2] },
        { color: '#FFC107', points: [0.3, 0.3, 0.4, 0.4] },
      ],
    });
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
        captureScale={createSharedValue(1)}
        captureTranslateY={createSharedValue(0)}
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
        flashAnim={createSharedValue(0)}
        permissionGranted
        onShutterPressIn={() => undefined}
        onShutterPressOut={() => undefined}
        onTakePicture={() => undefined}
        onSaveNote={() => undefined}
        onOpenNotes={() => undefined}
        saving={false}
        shutterScale={createSharedValue(1)}
        cameraStatusText={null}
        libraryImportLocked={false}
        importingPhoto={false}
        radius={150}
        onChangeRadius={() => undefined}
        shareTarget="private"
        onChangeShareTarget={() => undefined}
        footerContent={<View />}
      />
    );

    expect(ref.current?.getDoodleSnapshot()).toEqual({ enabled: false, strokes: [] });
  });

  it('hides the view-all action while camera permission is required', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const { getByText, queryByText } = renderCaptureCard(ref, {
      captureMode: 'camera',
      needsCameraPermission: true,
      permissionGranted: false,
    });

    expect(getByText('Grant Access')).toBeTruthy();
    expect(queryByText('grid-outline')).toBeNull();
  });

  it('switches the camera permission CTA to settings when the prompt is blocked', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const { getByText, queryByText } = renderCaptureCard(ref, {
      captureMode: 'camera',
      needsCameraPermission: true,
      cameraPermissionRequiresSettings: true,
      permissionGranted: false,
    });

    expect(getByText('Camera access is blocked for Noto. Open Settings to take photos.')).toBeTruthy();
    expect(getByText('Open Settings')).toBeTruthy();
    expect(queryByText('Grant Access')).toBeNull();
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

  it('opens a note color sheet and applies the selected swatch', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const handleChangeNoteColor = jest.fn();
    const { getByTestId, queryByTestId } = renderCaptureCard(ref, {
      noteColor: 'marigold-glow',
      onChangeNoteColor: handleChangeNoteColor,
    });

    expect(queryByTestId('capture-note-color-sunset-coral')).toBeNull();

    act(() => {
      fireEvent.press(getByTestId('capture-note-color-toggle'));
    });

    expect(getByTestId('capture-note-color-sunset-coral')).toBeTruthy();

    act(() => {
      fireEvent.press(getByTestId('capture-note-color-sunset-coral'));
    });

    expect(handleChangeNoteColor).toHaveBeenCalledWith('sunset-coral');
    expect(queryByTestId('capture-note-color-sunset-coral')).toBeNull();
  });

  it('opens the compact radius picker and applies the selection', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const handleChangeRadius = jest.fn();
    const { getByTestId, queryByTestId } = renderCaptureCard(ref, {
      onChangeRadius: handleChangeRadius,
    });

    expect(getByTestId('capture-radius-toggle')).toBeTruthy();
    expect(queryByTestId('capture-radius-150')).toBeNull();

    act(() => {
      fireEvent.press(getByTestId('capture-radius-toggle'));
    });

    expect(getByTestId('capture-radius-250')).toBeTruthy();

    act(() => {
      fireEvent.press(getByTestId('capture-radius-250'));
    });

    expect(handleChangeRadius).toHaveBeenCalledWith(250);
    expect(queryByTestId('capture-radius-250')).toBeNull();
  });

  it('drops the animated card transform while the android note input is focused', () => {
    const originalPlatform = Platform.OS;
    Platform.OS = 'android';

    try {
      const ref = React.createRef<CaptureCardHandle>();
      const { getByTestId } = renderCaptureCard(ref);

      const hasTransform = () =>
        getByTestId('capture-card-area').props.style.some((item: { transform?: unknown } | null) => Boolean(item?.transform));

      expect(hasTransform()).toBe(true);

      act(() => {
        fireEvent(getByTestId('capture-note-input'), 'focus');
      });

      expect(hasTransform()).toBe(false);

      act(() => {
        fireEvent(getByTestId('capture-note-input'), 'blur');
      });

      expect(hasTransform()).toBe(true);
    } finally {
      Platform.OS = originalPlatform;
    }
  });

  it('shows an inline paste action on an empty text card and pastes after tapping it', async () => {
    const ref = React.createRef<CaptureCardHandle>();
    mockClipboardHasImageAsync.mockResolvedValue(true);
    mockClipboardGetImageAsync.mockResolvedValue({
      data: 'data:image/png;base64,ZmFrZS1zdGlja2Vy',
      size: { width: 120, height: 120 },
    });

    const { getByTestId, queryByTestId } = renderCaptureCard(ref, {
      noteText: '',
    });

    await waitFor(() => {
      expect(getByTestId('capture-inline-paste-sticker')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId('capture-inline-paste-sticker'));
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
    expect(queryByTestId('capture-inline-paste-sticker')).toBeNull();
  });

  it('shows the inline paste action on an empty text card without pre-reading the clipboard', async () => {
    const ref = React.createRef<CaptureCardHandle>();

    const { getByTestId } = renderCaptureCard(ref, {
      noteText: '',
    });

    await waitFor(() => {
      expect(getByTestId('capture-inline-paste-sticker')).toBeTruthy();
    });
  });

  it('hides the inline paste action when decorate is opened', async () => {
    const ref = React.createRef<CaptureCardHandle>();

    const { getByTestId, queryByTestId } = renderCaptureCard(ref, {
      noteText: '',
    });

    await waitFor(() => {
      expect(getByTestId('capture-inline-paste-sticker')).toBeTruthy();
    });

    act(() => {
      fireEvent.press(getByTestId('capture-decorate-toggle'));
    });

    expect(queryByTestId('capture-inline-paste-sticker')).toBeNull();
  });

  it('shows a paste popover on photo-card long press and pastes after confirmation', async () => {
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
      fireEvent(getByTestId('capture-card-paste-surface'), 'longPress', {
        nativeEvent: { locationX: 144, locationY: 212 },
      });
    });

    expect(getByTestId('capture-card-paste-popover')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('capture-card-paste-action'));
    });

    await waitFor(() => {
      expect(ref.current?.getStickerSnapshot().placements).toHaveLength(1);
    });
  });

  it('opens the sticker source sheet from a tap on the add button', async () => {
    const ref = React.createRef<CaptureCardHandle>();
    mockClipboardHasImageAsync.mockResolvedValue(true);

    const { getByTestId } = renderCaptureCard(ref, {
      noteText: '',
    });

    act(() => {
      fireEvent.press(getByTestId('capture-decorate-toggle'));
    });
    act(() => {
      fireEvent.press(getByTestId('capture-sticker-toggle'));
    });

    await act(async () => {
      fireEvent.press(getByTestId('capture-sticker-import'));
    });

    expect(getByTestId('sticker-source-option-clipboard')).toBeTruthy();
    expect(getByTestId('sticker-source-option-photos')).toBeTruthy();
  });

  it('treats sticker edit mode like doodle mode for parent scroll locking', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const onDoodleModeChange = jest.fn();
    const { getByTestId } = renderCaptureCard(ref, {
      noteText: '',
      onDoodleModeChange,
    });

    act(() => {
      fireEvent.press(getByTestId('capture-decorate-toggle'));
    });
    act(() => {
      fireEvent.press(getByTestId('capture-sticker-toggle'));
    });

    expect(onDoodleModeChange).toHaveBeenLastCalledWith(true);

    act(() => {
      fireEvent.press(getByTestId('capture-sticker-toggle'));
    });

    expect(onDoodleModeChange).toHaveBeenLastCalledWith(false);
  });

  it('clears sticker selection first, then exits sticker mode on empty-card taps', async () => {
    const ref = React.createRef<CaptureCardHandle>();
    mockClipboardHasImageAsync.mockResolvedValue(true);
    mockClipboardGetImageAsync.mockResolvedValue({
      data: `data:image/png;base64,${transparentPngBase64}`,
    } as any);
    mockImportStickerAsset.mockResolvedValue({
      id: 'asset-1',
      ownerUid: '__local__',
      localUri: 'file:///documents/stickers/asset-1.png',
      remotePath: null,
      mimeType: 'image/png',
      width: 120,
      height: 120,
      createdAt: '2026-03-27T00:00:00.000Z',
      updatedAt: null,
      source: 'import',
    } as any);

    const { getByTestId } = renderCaptureCard(ref, {
      noteText: '',
    });

    await waitFor(() => {
      expect(getByTestId('capture-inline-paste-sticker')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId('capture-inline-paste-sticker'));
    });

    await waitFor(() => {
      expect(getByTestId('mock-sticker-selected')).toHaveTextContent('placement-1');
      expect(getByTestId('mock-sticker-editable')).toHaveTextContent('true');
    });

    act(() => {
      fireEvent.press(getByTestId('mock-sticker-canvas-empty'));
    });

    expect(getByTestId('mock-sticker-selected')).toHaveTextContent('null');
    expect(getByTestId('mock-sticker-editable')).toHaveTextContent('true');

    act(() => {
      fireEvent.press(getByTestId('mock-sticker-canvas-empty'));
    });

    expect(getByTestId('mock-sticker-editable')).toHaveTextContent('false');
  });

  it('still offers inline paste after a sticker already exists and editing is closed', async () => {
    const ref = React.createRef<CaptureCardHandle>();
    mockClipboardHasImageAsync.mockResolvedValue(true);
    mockClipboardGetImageAsync.mockResolvedValue({
      data: `data:image/png;base64,${transparentPngBase64}`,
      size: { width: 120, height: 120 },
    });

    const { getByTestId } = renderCaptureCard(ref, {
      noteText: '',
    });

    await waitFor(() => {
      expect(getByTestId('capture-inline-paste-sticker')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId('capture-inline-paste-sticker'));
    });

    await waitFor(() => {
      expect(ref.current?.getStickerSnapshot().placements).toHaveLength(1);
    });

    act(() => {
      fireEvent.press(getByTestId('mock-sticker-canvas-empty'));
    });
    act(() => {
      fireEvent.press(getByTestId('mock-sticker-canvas-empty'));
    });

    await waitFor(() => {
      expect(getByTestId('capture-inline-paste-sticker')).toBeTruthy();
    });
  });

  it('closes decorate mode from an outside-card tap', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const { getByTestId } = renderCaptureCard(ref);

    act(() => {
      fireEvent.press(getByTestId('capture-decorate-toggle'));
    });
    act(() => {
      fireEvent.press(getByTestId('capture-doodle-toggle'));
    });

    expect(getByTestId('mock-doodle-editable')).toHaveTextContent('true');
    expect(getByTestId('capture-decorate-dismiss-surface').props.pointerEvents).toBe('auto');

    act(() => {
      fireEvent.press(getByTestId('capture-decorate-dismiss-surface'));
    });

    expect(getByTestId('mock-doodle-editable')).toHaveTextContent('false');
    expect(getByTestId('capture-decorate-dismiss-surface').props.pointerEvents).toBe('none');
  });

  it('keeps text-input long press native and does not paste a sticker', async () => {
    const ref = React.createRef<CaptureCardHandle>();
    mockClipboardHasImageAsync.mockResolvedValue(true);

    const { getByTestId, queryByTestId } = renderCaptureCard(ref);

    if (queryByTestId('capture-card-paste-dismiss')) {
      await act(async () => {
        fireEvent.press(getByTestId('capture-card-paste-dismiss'));
      });
    }

    mockClipboardHasImageAsync.mockClear();

    await act(async () => {
      fireEvent(getByTestId('capture-note-input'), 'longPress');
    });

    expect(queryByTestId('capture-card-paste-popover')).toBeNull();
    expect(mockClipboardHasImageAsync).not.toHaveBeenCalled();
    expect(ref.current?.getStickerSnapshot().placements).toHaveLength(0);
  });

  it('keeps the inline paste action inert when the native paste control has no image payload', async () => {
    const ref = React.createRef<CaptureCardHandle>();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockClipboardPastePayload = null;

    const { getByTestId, queryByTestId } = renderCaptureCard(ref, {
      noteText: '',
    });

    await waitFor(() => {
      expect(getByTestId('capture-inline-paste-sticker')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId('capture-inline-paste-sticker'));
    });

    expect(mockImportStickerAsset).not.toHaveBeenCalled();
    expect(queryByTestId('capture-card-paste-popover')).toBeNull();
    expect(alertSpy).not.toHaveBeenCalled();
  });
});

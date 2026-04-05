import React from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { getImageAsync, hasImageAsync } from 'expo-clipboard';
import { deleteAsync, writeAsStringAsync } from '../utils/fileSystem';
import { importStickerAsset } from '../services/noteStickers';
import CaptureCard, { type CaptureCardHandle } from '../components/home/CaptureCard';

const transparentPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFAAH/e+m+7wAAAABJRU5ErkJggg==';
let mockClipboardPasteButtonAvailable = true;
let mockCameraViewProps: any = null;
let mockCameraMountCount = 0;
let mockCameraUnmountCount = 0;
let mockClipboardPastePayload: any = {
  type: 'image',
  data: 'data:image/png;base64,ZmFrZS1zdGlja2Vy',
  size: { width: 120, height: 120 },
};
let mockClipboardListeners: Array<() => void> = [];

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

jest.mock('react-native-vision-camera', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockCameraView = React.forwardRef((props: any, ref: any) => {
    mockCameraViewProps = props;
    React.useEffect(() => {
      props.onInitialized?.();
      mockCameraMountCount += 1;
      return () => {
        mockCameraUnmountCount += 1;
      };
    }, []);
    React.useImperativeHandle(ref, () => ({
      takePhoto: jest.fn(),
      startRecording: jest.fn(),
      stopRecording: jest.fn(),
      cancelRecording: jest.fn(),
    }));
    return <View testID="mock-camera-view" />;
  });
  MockCameraView.displayName = 'MockCameraView';

  MockCameraView.getCameraPermissionStatus = jest.fn(() => 'granted');

  return {
    Camera: MockCameraView,
    useCameraPermission: () => ({ hasPermission: true, requestPermission: jest.fn(async () => true) }),
    useCameraDevice: () => ({
      id: 'back-camera',
      position: 'back',
      neutralZoom: 1,
      maxZoom: 4,
    }),
  };
});

jest.mock('expo-clipboard', () => ({
  __esModule: true,
  hasImageAsync: jest.fn(),
  getImageAsync: jest.fn(),
  addClipboardListener: jest.fn((listener: () => void) => {
    mockClipboardListeners.push(listener);
    return {
      remove: () => {
        mockClipboardListeners = mockClipboardListeners.filter((entry) => entry !== listener);
      },
    };
  }),
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

jest.mock('../components/sheets/AppBottomSheet', () => {
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

jest.mock('../components/notes/NoteDoodleCanvas', () => {
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

jest.mock('../components/notes/NoteStickerCanvas', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');

  return {
    __esModule: true,
    default: function MockNoteStickerCanvas(props: any) {
      const selectedPlacement = props.placements?.find((placement: any) => placement.id === props.selectedPlacementId);
      return (
        <View testID="mock-sticker-canvas">
          <Text testID="mock-sticker-editable">{String(props.editable)}</Text>
          <Text testID="mock-sticker-selected">{String(props.selectedPlacementId ?? 'null')}</Text>
          <Pressable
            testID="mock-sticker-select-first"
            onPress={() => props.onChangeSelectedPlacementId?.(props.placements?.[0]?.id ?? null)}
          />
          {selectedPlacement ? (
            <>
              <Pressable
                testID={`note-sticker-lock-toggle-${selectedPlacement.id}`}
                onPress={() => props.onToggleSelectedPlacementMotionLock?.(selectedPlacement.id)}
              />
              {selectedPlacement.renderMode !== 'stamp' ? (
                <Pressable
                  testID={`note-sticker-outline-toggle-${selectedPlacement.id}`}
                  onPress={() => props.onToggleSelectedPlacementOutline?.(selectedPlacement.id)}
                />
              ) : null}
            </>
          ) : null}
          <Pressable testID="mock-sticker-canvas-empty" onPress={() => props.onPressCanvas?.()} />
        </View>
      );
    },
  };
});

jest.mock('../services/noteStickers', () => ({
  bringStickerPlacementToFront: jest.fn((placements: any[]) => placements),
  createStickerPlacement: jest.fn((asset: any, existingPlacements: any[] = [], options?: any) => ({
    id: `placement-${existingPlacements.length + 1}`,
    assetId: asset.id,
    x: 0.5,
    y: 0.5,
    scale: 1,
    rotation: 0,
    zIndex: existingPlacements.length + 1,
    opacity: 1,
    outlineEnabled: true,
    motionLocked: false,
    renderMode: options?.renderMode ?? (asset.suggestedRenderMode === 'stamp' ? 'stamp' : 'default'),
    asset,
  })),
  duplicateStickerPlacement: jest.fn((placements: any[]) => placements),
  importStickerAsset: jest.fn(),
  setStickerPlacementMotionLocked: jest.fn((placements: any[], placementId: string, motionLocked: boolean) =>
    placements.map((placement) =>
      placement.id === placementId ? { ...placement, motionLocked } : placement
    )
  ),
  setStickerPlacementRenderMode: jest.fn((placements: any[], placementId: string, renderMode: 'default' | 'stamp') =>
    placements.map((placement) =>
      placement.id === placementId ? { ...placement, renderMode } : placement
    )
  ),
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
const mockImagePicker = jest.requireMock('expo-image-picker') as {
  getMediaLibraryPermissionsAsync: jest.Mock;
  requestMediaLibraryPermissionsAsync: jest.Mock;
  launchImageLibraryAsync: jest.Mock;
};
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
    selectedPhotoFilterId: 'original' as const,
    onChangePhotoFilter: () => undefined,
    cameraRef: { current: null },
    cameraDevice: {
      id: 'back-camera',
      position: 'back',
      neutralZoom: 1,
      maxZoom: 4,
    } as any,
    isCameraPreviewActive: false,
    flashAnim: zeroValue,
    permissionGranted: true,
    onShutterPressIn: () => undefined,
    onShutterPressOut: () => undefined,
    onTakePicture: () => undefined,
    onStartLivePhotoCapture: () => undefined,
    onSaveNote: () => undefined,
    saving: false,
    shutterScale: animatedValue,
    isLivePhotoSaveGuardActive: false,
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
    mockCameraMountCount = 0;
    mockCameraUnmountCount = 0;
    mockClipboardListeners = [];
    mockClipboardPastePayload = {
      type: 'image',
      data: 'data:image/png;base64,ZmFrZS1zdGlja2Vy',
      size: { width: 120, height: 120 },
    };
    mockClipboardHasImageAsync.mockResolvedValue(false);
    mockWriteAsStringAsync.mockResolvedValue(undefined);
    mockDeleteAsync.mockResolvedValue(undefined);
    mockImagePicker.getMediaLibraryPermissionsAsync.mockResolvedValue({
      status: 'granted',
      canAskAgain: true,
    });
    mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      status: 'granted',
      canAskAgain: true,
    });
    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: true,
      assets: [],
    });
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

  it('removes the restaurant field in text mode and keeps the action row', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const { getByTestId, queryByTestId } = renderCaptureCard(ref, {
      restaurantName: '',
    });

    expect(queryByTestId('capture-restaurant-input')).toBeNull();
    expect(getByTestId('capture-doodle-toggle')).toBeTruthy();
  });

  it('uses the simplified camera action row instead of the restaurant field', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const { getByTestId, queryByTestId } = renderCaptureCard(ref, {
      captureMode: 'camera',
      restaurantName: '',
    });

    expect(queryByTestId('capture-restaurant-input')).toBeNull();
    expect(getByTestId('capture-library-button')).toBeTruthy();
  });

  it('tracks local doodle state through the imperative handle', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const { getByTestId, queryByTestId } = renderCaptureCard(ref, {
      noteText: '',
    });

    expect(ref.current?.getDoodleSnapshot()).toEqual({ enabled: false, strokes: [] });

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
    expect(queryByTestId('mock-doodle-editable')).toBeNull();
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
    expect(getByTestId('capture-auto-emoji-pop-label')).toHaveTextContent('☕️');
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

  it('uses the accent color for capture text selections', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const { getByTestId } = renderCaptureCard(ref);

    expect(getByTestId('capture-note-input').props.selectionColor).toBe('#FFC107');
  });

  it('keeps doodle editing available on captured photos', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const { getByTestId } = renderCaptureCard(ref, {
      captureMode: 'camera',
      capturedPhoto: 'file:///photo.jpg',
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
      isCameraPreviewActive: true,
    });

    await waitFor(() => {
      expect(mockCameraViewProps).toMatchObject({
        isActive: true,
        isMirrored: true,
        preview: true,
        photo: true,
        resizeMode: 'cover',
        androidPreviewViewType: 'texture-view',
      });
    });
  });

  it('uses a shutter long press for live photo capture without firing the normal photo tap', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const onTakePicture = jest.fn();
    const onStartLivePhotoCapture = jest.fn();
    const onShutterPressOut = jest.fn();
    const { getByTestId } = renderCaptureCard(ref, {
      captureMode: 'camera',
      permissionGranted: true,
      needsCameraPermission: false,
      onTakePicture,
      onStartLivePhotoCapture,
      onShutterPressOut,
    });

    const shutter = getByTestId('capture-shutter-button');

    fireEvent(shutter, 'longPress');
    fireEvent(shutter, 'pressOut');
    fireEvent(shutter, 'press');

    expect(onStartLivePhotoCapture).toHaveBeenCalledTimes(1);
    expect(onShutterPressOut).toHaveBeenCalledTimes(1);
    expect(onTakePicture).not.toHaveBeenCalled();
    expect(shutter.props.hitSlop).toBe(12);
  });

  it('mounts the camera as soon as Android permission is granted', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const view = renderCaptureCard(ref, {
      captureMode: 'camera',
      permissionGranted: false,
      needsCameraPermission: true,
    });

    expect(view.queryByTestId('mock-camera-view')).toBeNull();

    view.rerender(
      <CaptureCard
        {...createCaptureCardProps(ref, {
          captureMode: 'camera',
          permissionGranted: true,
          needsCameraPermission: false,
          isCameraPreviewActive: true,
        })}
      />
    );

    expect(view.getByTestId('mock-camera-view')).toBeTruthy();
  });

  it('remounts the camera when the live preview becomes active again', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const view = renderCaptureCard(ref, {
      captureMode: 'camera',
      permissionGranted: true,
      needsCameraPermission: false,
      isCameraPreviewActive: false,
    });

    expect(view.getByTestId('mock-camera-view')).toBeTruthy();
    const initialMountCount = mockCameraMountCount;
    const initialUnmountCount = mockCameraUnmountCount;
    expect(mockCameraViewProps?.isActive).toBe(false);

    view.rerender(
      <CaptureCard
        {...createCaptureCardProps(ref, {
          captureMode: 'camera',
          permissionGranted: true,
          needsCameraPermission: false,
          isCameraPreviewActive: true,
        })}
      />
    );

    expect(view.getByTestId('mock-camera-view')).toBeTruthy();
    expect(mockCameraMountCount).toBeGreaterThan(initialMountCount);
    expect(mockCameraUnmountCount).toBeGreaterThan(initialUnmountCount);
  });

  it('starts Android camera active when the preview is active', () => {
    const originalPlatform = Platform.OS;
    Platform.OS = 'android';

    try {
      const ref = React.createRef<CaptureCardHandle>();
      renderCaptureCard(ref, {
        captureMode: 'camera',
        permissionGranted: true,
        needsCameraPermission: false,
        isCameraPreviewActive: true,
      });

      expect(mockCameraViewProps?.isActive).toBe(true);
    } finally {
      Platform.OS = originalPlatform;
    }
  });

  it('shows filter circles for captured photos and lets you choose one', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const onChangePhotoFilter = jest.fn();
    const { getByTestId } = renderCaptureCard(ref, {
      captureMode: 'camera',
      capturedPhoto: 'file:///captured-photo.jpg',
      selectedPhotoFilterId: 'original',
      onChangePhotoFilter,
    });

    fireEvent.press(getByTestId('capture-filter-vivid'));

    expect(onChangePhotoFilter).toHaveBeenCalledWith('vivid');
  });

  it('keeps the original captured-photo controls and blocks save during the live-photo guard', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const onSaveNote = jest.fn();
    const { getByTestId, queryByText, queryByTestId } = renderCaptureCard(ref, {
      captureMode: 'camera',
      capturedPhoto: 'file:///captured-photo.jpg',
      capturedPairedVideo: 'file:///captured-photo.mov',
      isLivePhotoSaveGuardActive: true,
      onSaveNote,
    });

    fireEvent.press(getByTestId('capture-save-button'));

    expect(onSaveNote).not.toHaveBeenCalled();
    expect(queryByText('time-outline')).toBeNull();
    expect(getByTestId('capture-retake-button')).toBeTruthy();
    expect(getByTestId('capture-share-target-toggle')).toBeTruthy();
    expect(queryByTestId('capture-shutter-button')).toBeNull();
  });

  it('renders live photo playback on the captured-photo review surface', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const { getByLabelText, queryByTestId } = renderCaptureCard(ref, {
      captureMode: 'camera',
      capturedPhoto: 'file:///captured-photo.jpg',
      capturedPairedVideo: 'file:///captured-photo.mov',
      selectedPhotoFilterId: 'original',
    });

    expect(getByLabelText('Preview live photo motion')).toBeTruthy();
    expect(queryByTestId('capture-filter-vivid')).toBeNull();
    expect(queryByTestId('capture-card-paste-surface')).toBeNull();
  });

  it('keeps the simplified camera action row without removing the footer controls', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const { getByTestId, queryByLabelText, queryByTestId } = renderCaptureCard(ref, {
      captureMode: 'camera',
      cameraInstructionText: 'Tap for a photo. Hold for a live photo.',
    });

    expect(queryByLabelText('Tap for a photo. Hold for a live photo.')).toBeNull();
    expect(getByTestId('capture-library-button')).toBeTruthy();
    expect(getByTestId('capture-shutter-button')).toBeTruthy();
    expect(getByTestId('capture-share-target-toggle')).toBeTruthy();
    expect(queryByTestId('capture-radius-toggle')).toBeNull();
  });

  it('lets you change the text-card doodle color', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const { getByTestId } = renderCaptureCard(ref, {
      noteText: '',
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
        selectedPhotoFilterId="original"
        onChangePhotoFilter={() => undefined}
        cameraRef={{ current: null }}
        isCameraPreviewActive={false}
        flashAnim={createSharedValue(0)}
        permissionGranted
        onShutterPressIn={() => undefined}
        onShutterPressOut={() => undefined}
        onTakePicture={() => undefined}
        onSaveNote={() => undefined}
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

  it('restores text-card interactions after leaving doodle mode through a camera round-trip', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const view = renderCaptureCard(ref, {
      noteText: 'Draft memory',
    });

    act(() => {
      fireEvent.press(view.getByTestId('capture-doodle-toggle'));
    });

    expect(view.getByTestId('capture-note-input').props.editable).toBe(true);

    view.rerender(
      <CaptureCard
        {...createCaptureCardProps(ref, {
          captureMode: 'camera',
          permissionGranted: true,
          needsCameraPermission: false,
          isCameraPreviewActive: true,
        })}
      />
    );

    view.rerender(
      <CaptureCard
        {...createCaptureCardProps(ref, {
          noteText: 'Draft memory',
        })}
      />
    );

    expect(view.getByTestId('capture-note-input').props.editable).toBe(true);
    expect(view.queryByTestId('capture-radius-toggle')).toBeNull();
    expect(view.queryByTestId('capture-note-color-toggle')).toBeNull();
  });

  it('fully closes doodle mode when you tap the doodle toggle again', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const view = renderCaptureCard(ref, {
      noteText: 'Draft memory',
    });

    act(() => {
      fireEvent.press(view.getByTestId('capture-doodle-toggle'));
    });

    expect(view.getByTestId('mock-doodle-editable')).toHaveTextContent('true');
    expect(view.getByTestId('capture-note-input').props.editable).toBe(true);

    act(() => {
      fireEvent.press(view.getByTestId('capture-doodle-toggle'));
    });

    expect(view.queryByTestId('mock-doodle-editable')).toBeNull();
    expect(view.getByTestId('capture-note-input').props.editable).toBe(true);
  });

  it('restores text-card interactions after leaving sticker mode through a camera round-trip', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const view = renderCaptureCard(ref, {
      noteText: 'Draft memory',
    });

    act(() => {
      fireEvent.press(view.getByTestId('capture-sticker-toggle'));
    });

    expect(view.getByTestId('capture-note-input').props.editable).toBe(true);

    view.rerender(
      <CaptureCard
        {...createCaptureCardProps(ref, {
          captureMode: 'camera',
          permissionGranted: true,
          needsCameraPermission: false,
          isCameraPreviewActive: true,
        })}
      />
    );

    view.rerender(
      <CaptureCard
        {...createCaptureCardProps(ref, {
          noteText: 'Draft memory',
        })}
      />
    );

    expect(view.getByTestId('capture-note-input').props.editable).toBe(true);
    expect(view.queryByTestId('capture-radius-toggle')).toBeNull();
    expect(view.queryByTestId('capture-note-color-toggle')).toBeNull();
  });

  it('fully closes sticker mode when you tap the sticker toggle again', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const view = renderCaptureCard(ref, {
      noteText: 'Draft memory',
    });

    act(() => {
      fireEvent.press(view.getByTestId('capture-sticker-toggle'));
    });

    expect(view.getByTestId('capture-sticker-import')).toBeTruthy();
    expect(view.getByTestId('capture-note-input').props.editable).toBe(true);

    act(() => {
      fireEvent.press(view.getByTestId('capture-sticker-toggle'));
    });

    expect(view.queryByTestId('capture-sticker-import')).toBeNull();
    expect(view.getByTestId('capture-note-input').props.editable).toBe(true);
  });

  it('mounts the sticker canvas as soon as sticker mode opens on the text card', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const view = renderCaptureCard(ref, {
      noteText: 'Draft memory',
    });

    expect(view.queryByTestId('mock-sticker-canvas')).toBeNull();

    act(() => {
      fireEvent.press(view.getByTestId('capture-sticker-toggle'));
    });

    expect(view.getByTestId('mock-sticker-canvas')).toBeTruthy();
  });

  it('restores captured-photo controls after closing doodle mode', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const onChangePhotoFilter = jest.fn();
    const view = renderCaptureCard(ref, {
      captureMode: 'camera',
      capturedPhoto: 'file:///photo.jpg',
      onChangePhotoFilter,
    });

    act(() => {
      fireEvent.press(view.getByTestId('capture-doodle-toggle'));
    });

    expect(view.getByTestId('mock-doodle-editable')).toHaveTextContent('true');

    act(() => {
      fireEvent.press(view.getByTestId('capture-doodle-toggle'));
    });

    expect(view.queryByTestId('mock-doodle-editable')).toBeNull();

    act(() => {
      fireEvent.press(view.getByTestId('capture-filter-vivid'));
    });

    expect(onChangePhotoFilter).toHaveBeenCalledWith('vivid');
  });

  it('hides the share toggle while camera permission is required', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const { getByText, queryByTestId } = renderCaptureCard(ref, {
      captureMode: 'camera',
      needsCameraPermission: true,
      permissionGranted: false,
    });

    expect(getByText('Grant Access')).toBeTruthy();
    expect(queryByTestId('capture-share-target-toggle')).toBeNull();
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

  it('lets you toggle the share target from the capture action row', () => {
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

  it('hides the note color control in text mode and keeps the default note color', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const handleChangeNoteColor = jest.fn();
    const { queryByTestId } = renderCaptureCard(ref, {
      noteColor: 'sunset-coral',
      onChangeNoteColor: handleChangeNoteColor,
    });

    expect(queryByTestId('capture-note-color-toggle')).toBeNull();
    expect(handleChangeNoteColor).toHaveBeenCalledWith('marigold-glow');
  });

  it('hides the compact radius picker in text mode', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const handleChangeRadius = jest.fn();
    const { queryByTestId } = renderCaptureCard(ref, {
      onChangeRadius: handleChangeRadius,
    });

    expect(queryByTestId('capture-radius-toggle')).toBeNull();
    expect(queryByTestId('capture-radius-150')).toBeNull();
    expect(handleChangeRadius).not.toHaveBeenCalled();
  });

  it('drops the animated card transform while the android note input is focused', async () => {
    const originalPlatform = Platform.OS;
    Platform.OS = 'android';

    try {
      const ref = React.createRef<CaptureCardHandle>();
      const { getByTestId, rerender } = renderCaptureCard(ref);

      const hasTransform = () => {
        const flattenedStyle = StyleSheet.flatten(getByTestId('capture-card-area').props.style);
        return Array.isArray(flattenedStyle?.transform) && flattenedStyle.transform.length > 0;
      };

      expect(hasTransform()).toBe(true);

      act(() => {
        fireEvent(getByTestId('capture-note-input'), 'focus');
      });

      expect(hasTransform()).toBe(false);

      act(() => {
        fireEvent(getByTestId('capture-note-input'), 'blur');
      });

      await waitFor(() => {
        expect(hasTransform()).toBe(true);
      });

      rerender(
        <CaptureCard
          {...createCaptureCardProps(ref, {
            captureMode: 'camera',
            permissionGranted: true,
            needsCameraPermission: false,
            isCameraPreviewActive: true,
          })}
        />
      );

      expect(hasTransform()).toBe(false);
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

  it('shows the inline paste action on an empty text card when the clipboard has an image', async () => {
    const ref = React.createRef<CaptureCardHandle>();
    mockClipboardHasImageAsync.mockResolvedValue(true);

    const { getByTestId } = renderCaptureCard(ref, {
      noteText: '',
    });

    await waitFor(() => {
      expect(getByTestId('capture-inline-paste-sticker')).toBeTruthy();
    });
  });

  it('hides the inline paste action on an empty text card when the clipboard has no image', async () => {
    const ref = React.createRef<CaptureCardHandle>();

    const { queryByTestId } = renderCaptureCard(ref, {
      noteText: '',
    });

    await waitFor(() => {
      expect(queryByTestId('capture-inline-paste-sticker')).toBeNull();
    });
  });

  it('hides the inline paste action when doodle mode is opened', async () => {
    const ref = React.createRef<CaptureCardHandle>();
    mockClipboardHasImageAsync.mockResolvedValue(true);

    const { getByTestId, queryByTestId } = renderCaptureCard(ref, {
      noteText: '',
    });

    await waitFor(() => {
      expect(getByTestId('capture-inline-paste-sticker')).toBeTruthy();
    });

    act(() => {
      fireEvent.press(getByTestId('capture-doodle-toggle'));
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

  it('locks sticker motion from the selected sticker controls in the capture editor', async () => {
    const ref = React.createRef<CaptureCardHandle>();
    mockClipboardHasImageAsync.mockResolvedValue(true);
    mockClipboardGetImageAsync.mockResolvedValue({
      data: 'data:image/png;base64,cGhvdG8tc3RpY2tlcg==',
      size: { width: 140, height: 140 },
    });

    const { getByTestId, queryByTestId } = renderCaptureCard(ref, {
      captureMode: 'camera',
      capturedPhoto: 'file:///photo.jpg',
    });

    await act(async () => {
      fireEvent(getByTestId('capture-card-paste-surface'), 'longPress', {
        nativeEvent: { locationX: 144, locationY: 212 },
      });
    });

    await act(async () => {
      fireEvent.press(getByTestId('capture-card-paste-action'));
    });

    await waitFor(() => {
      expect(ref.current?.getStickerSnapshot().placements).toHaveLength(1);
    });

    fireEvent.press(getByTestId('mock-sticker-select-first'));
    expect(getByTestId('note-sticker-lock-toggle-placement-1')).toBeTruthy();
    expect(getByTestId('note-sticker-outline-toggle-placement-1')).toBeTruthy();

    fireEvent.press(getByTestId('note-sticker-lock-toggle-placement-1'));

    expect(queryByTestId('capture-sticker-more')).toBeNull();
    expect(ref.current?.getStickerSnapshot().placements[0]?.motionLocked).toBe(true);
  });

  it('creates a stamp directly from the sticker source sheet', async () => {
    const ref = React.createRef<CaptureCardHandle>();
    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///photo.jpg',
          mimeType: 'image/jpeg',
          fileName: 'photo.jpg',
        },
      ],
    });

    const { getByTestId } = renderCaptureCard(ref, {
      captureMode: 'camera',
      capturedPhoto: 'file:///photo.jpg',
    });

    act(() => {
      fireEvent.press(getByTestId('capture-sticker-toggle'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('capture-sticker-import'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('sticker-source-option-create-stamp'));
    });

    await waitFor(() => {
      expect(ref.current?.getStickerSnapshot().placements).toHaveLength(1);
    });

    expect(ref.current?.getStickerSnapshot().placements[0]?.renderMode).toBe('stamp');
    expect(mockImportStickerAsset).toHaveBeenCalledWith(
      {
        uri: 'file:///photo.jpg',
        mimeType: 'image/jpeg',
        name: 'photo.jpg',
      },
      undefined
    );
  });

  it('hides the outline toggle on selected stamp stickers', async () => {
    const ref = React.createRef<CaptureCardHandle>();
    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///photo.jpg',
          mimeType: 'image/jpeg',
          fileName: 'photo.jpg',
        },
      ],
    });

    const { getByTestId, queryByTestId } = renderCaptureCard(ref, {
      captureMode: 'camera',
      capturedPhoto: 'file:///photo.jpg',
    });

    act(() => {
      fireEvent.press(getByTestId('capture-sticker-toggle'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('capture-sticker-import'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('sticker-source-option-create-stamp'));
    });

    await waitFor(() => {
      expect(ref.current?.getStickerSnapshot().placements).toHaveLength(1);
    });

    fireEvent.press(getByTestId('mock-sticker-select-first'));

    expect(getByTestId('note-sticker-lock-toggle-placement-1')).toBeTruthy();
    expect(queryByTestId('note-sticker-outline-toggle-placement-1')).toBeNull();
  });

  it('opens the sticker source sheet from a tap on the add button', async () => {
    const ref = React.createRef<CaptureCardHandle>();
    mockClipboardHasImageAsync.mockResolvedValue(true);

    const { getByTestId } = renderCaptureCard(ref, {
      noteText: '',
    });

    act(() => {
      fireEvent.press(getByTestId('capture-sticker-toggle'));
    });

    await act(async () => {
      fireEvent.press(getByTestId('capture-sticker-import'));
    });

    expect(getByTestId('sticker-source-option-create-sticker')).toBeTruthy();
    expect(getByTestId('sticker-source-option-create-stamp')).toBeTruthy();
    expect(getByTestId('sticker-source-option-clipboard')).toBeTruthy();
  });

  it('requests a transparent asset when creating a floating sticker from photos', async () => {
    const ref = React.createRef<CaptureCardHandle>();
    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///sticker.png',
          mimeType: 'image/png',
          fileName: 'sticker.png',
        },
      ],
    });

    const { getByTestId } = renderCaptureCard(ref, {
      noteText: '',
    });

    act(() => {
      fireEvent.press(getByTestId('capture-sticker-toggle'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('capture-sticker-import'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('sticker-source-option-create-sticker'));
    });

    await waitFor(() => {
      expect(mockImportStickerAsset).toHaveBeenCalledWith(
        {
          uri: 'file:///sticker.png',
          mimeType: 'image/png',
          name: 'sticker.png',
        },
        { requiresTransparency: true }
      );
    });
  });

  it('treats sticker edit mode like doodle mode for parent scroll locking', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const onDoodleModeChange = jest.fn();
    const { getByTestId } = renderCaptureCard(ref, {
      noteText: '',
      onDoodleModeChange,
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

  it('clears text sticker editing state when switching away to camera and back', async () => {
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

    const view = renderCaptureCard(ref, {
      noteText: '',
    });

    await waitFor(() => {
      expect(view.getByTestId('capture-inline-paste-sticker')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(view.getByTestId('capture-inline-paste-sticker'));
    });

    await waitFor(() => {
      expect(view.getByTestId('mock-sticker-selected')).toHaveTextContent('placement-1');
      expect(view.getByTestId('mock-sticker-editable')).toHaveTextContent('true');
    });

    view.rerender(
      <CaptureCard
        {...createCaptureCardProps(ref, {
          noteText: '',
          captureMode: 'camera',
          isCameraPreviewActive: true,
        })}
      />
    );

    view.rerender(
      <CaptureCard
        {...createCaptureCardProps(ref, {
          noteText: '',
          captureMode: 'text',
        })}
      />
    );

    await waitFor(() => {
      expect(view.getByTestId('mock-sticker-selected')).toHaveTextContent('null');
      expect(view.getByTestId('mock-sticker-editable')).toHaveTextContent('false');
    });
  });

  it('closes text sticker edit mode as soon as the mode-switch animation starts', async () => {
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

    const view = renderCaptureCard(ref, {
      noteText: '',
    });

    await waitFor(() => {
      expect(view.getByTestId('capture-inline-paste-sticker')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(view.getByTestId('capture-inline-paste-sticker'));
    });

    await waitFor(() => {
      expect(view.getByTestId('mock-sticker-selected')).toHaveTextContent('placement-1');
      expect(view.getByTestId('mock-sticker-editable')).toHaveTextContent('true');
    });

    view.rerender(
      <CaptureCard
        {...createCaptureCardProps(ref, {
          noteText: '',
          isModeSwitchAnimating: true,
        })}
      />
    );

    await waitFor(() => {
      expect(view.getByTestId('mock-sticker-selected')).toHaveTextContent('null');
      expect(view.getByTestId('mock-sticker-editable')).toHaveTextContent('false');
    });
  });

  it('does not carry text doodle state into the live camera surface', async () => {
    const ref = React.createRef<CaptureCardHandle>();
    const view = renderCaptureCard(ref, {
      noteText: '',
    });

    act(() => {
      fireEvent.press(view.getByTestId('capture-doodle-toggle'));
    });

    expect(view.getByTestId('mock-doodle-editable')).toHaveTextContent('true');

    view.rerender(
      <CaptureCard
        {...createCaptureCardProps(ref, {
          noteText: '',
          captureMode: 'camera',
          isCameraPreviewActive: true,
        })}
      />
    );

    await waitFor(() => {
      expect(view.queryByTestId('mock-doodle-canvas')).toBeNull();
    });
  });

  it('does not carry text sticker placements into the live camera surface', async () => {
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

    const view = renderCaptureCard(ref, {
      noteText: '',
    });

    await waitFor(() => {
      expect(view.getByTestId('capture-inline-paste-sticker')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(view.getByTestId('capture-inline-paste-sticker'));
    });

    await waitFor(() => {
      expect(view.getByTestId('mock-sticker-canvas')).toBeTruthy();
    });

    view.rerender(
      <CaptureCard
        {...createCaptureCardProps(ref, {
          noteText: '',
          captureMode: 'camera',
          isCameraPreviewActive: true,
        })}
      />
    );

    await waitFor(() => {
      expect(view.queryByTestId('mock-sticker-canvas')).toBeNull();
    });
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

  it('switching from doodle to sticker mode closes doodle editing', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const { getByTestId, queryByTestId } = renderCaptureCard(ref);

    act(() => {
      fireEvent.press(getByTestId('capture-doodle-toggle'));
    });

    expect(getByTestId('mock-doodle-editable')).toHaveTextContent('true');

    act(() => {
      fireEvent.press(getByTestId('capture-sticker-toggle'));
    });

    expect(queryByTestId('mock-doodle-editable')).toBeNull();
    expect(getByTestId('capture-sticker-import')).toBeTruthy();
  });

  it('keeps text-input long press native and does not paste a sticker', async () => {
    const ref = React.createRef<CaptureCardHandle>();
    mockClipboardHasImageAsync.mockResolvedValue(true);

    const { getByTestId, queryByTestId } = renderCaptureCard(ref);

    await act(async () => {
      fireEvent(getByTestId('capture-note-input'), 'longPress');
    });

    expect(queryByTestId('capture-card-paste-popover')).toBeNull();
    expect(mockClipboardHasImageAsync).not.toHaveBeenCalled();
    expect(ref.current?.getStickerSnapshot().placements).toHaveLength(0);
  });

  it('hides the inline paste affordance when the native paste control is unavailable', async () => {
    const originalPlatform = Platform.OS;
    Platform.OS = 'ios';

    try {
      const ref = React.createRef<CaptureCardHandle>();
      mockClipboardPasteButtonAvailable = false;

      const { queryByTestId } = renderCaptureCard(ref, {
        noteText: '',
      });

      await waitFor(() => {
        expect(queryByTestId('capture-inline-paste-sticker')).toBeNull();
      });
    } finally {
      Platform.OS = originalPlatform;
    }
  });

  it('shows the Android fallback paste action when the native paste control is unavailable', async () => {
    const originalPlatform = Platform.OS;
    Platform.OS = 'android';

    try {
      const ref = React.createRef<CaptureCardHandle>();
      mockClipboardPasteButtonAvailable = false;
      mockClipboardHasImageAsync.mockResolvedValue(true);

      const { getByTestId } = renderCaptureCard(ref, {
        noteText: '',
      });

      await waitFor(() => {
        expect(getByTestId('capture-inline-paste-sticker')).toBeTruthy();
      });
    } finally {
      Platform.OS = originalPlatform;
    }
  });

  it('keeps the inline paste action inert when the native paste control has no image payload', async () => {
    const ref = React.createRef<CaptureCardHandle>();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockClipboardHasImageAsync.mockResolvedValue(true);
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

  it('updates the inline paste action when clipboard image availability changes', async () => {
    const ref = React.createRef<CaptureCardHandle>();
    mockClipboardHasImageAsync.mockResolvedValue(false);

    const { queryByTestId } = renderCaptureCard(ref, {
      noteText: '',
    });

    await waitFor(() => {
      expect(queryByTestId('capture-inline-paste-sticker')).toBeNull();
    });

    mockClipboardHasImageAsync.mockResolvedValue(true);

    await act(async () => {
      mockClipboardListeners.forEach((listener) => listener());
    });

    await waitFor(() => {
      expect(queryByTestId('capture-inline-paste-sticker')).toBeTruthy();
    });
  });
});

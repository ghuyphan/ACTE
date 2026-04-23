import { act, renderHook } from '@testing-library/react-native';
import { useCaptureCardCameraController } from '../components/home/useCaptureCardCameraController';

type MockGesture = {
  kind: string;
  gestures?: MockGesture[];
  handlers: {
    onBegin?: () => void;
    onUpdate?: (event: { scale: number }) => void;
    onEnd?: () => void;
    onFinalize?: () => void;
  };
};

function createControllerOptions(
  overrides: Partial<Parameters<typeof useCaptureCardCameraController>[0]> = {}
): Parameters<typeof useCaptureCardCameraController>[0] {
  return {
    captureMode: 'camera',
    capturedPhoto: null,
    cameraRef: { current: null },
    cameraDevice: {
      id: 'back-wide-camera',
      position: 'back',
      neutralZoom: 1,
      minZoom: 1,
      maxZoom: 4,
      supportsFocus: true,
    } as any,
    cameraSessionKey: 1,
    permissionGranted: true,
    isCameraPreviewActive: true,
    isCameraRevealAllowed: true,
    backCameraLens: 'wide',
    backCameraLensZoomConfig: {
      'ultra-wide': { anchor: 0.5, min: 0.5, max: 1 },
      wide: { anchor: 1, min: 1, max: 8 },
      telephoto: { anchor: 2, min: 2, max: 16 },
    },
    facing: 'back',
    cameraInstructionText: null,
    isLivePhotoCaptureInProgress: false,
    allowShutterLongPress: true,
    interactionsDisabled: false,
    reduceMotionEnabled: true,
    shutterScale: { value: 1 } as any,
    colors: {
      primary: '#FFC107',
      border: '#E5E5EA',
    },
    t: ((_: string, fallback?: string) => fallback ?? '') as any,
    cardSize: 300,
    livePhotoRingStrokeWidth: 4,
    onCameraGestureActiveChange: jest.fn(),
    onChangeBackCameraLens: jest.fn(),
    onToggleFacing: jest.fn(),
    onTakePicture: jest.fn(),
    onShutterPressOut: jest.fn(),
    onStartLivePhotoCapture: jest.fn(),
    ...overrides,
  };
}

function getPinchGesture(gesture: unknown) {
  const exclusiveGesture = gesture as MockGesture;
  return exclusiveGesture.gestures?.find((entry) => entry.kind === 'pinch') as MockGesture;
}

describe('useCaptureCardCameraController', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('keeps pinch zoom on the active lens instead of swapping lenses mid-gesture', () => {
    const onChangeBackCameraLens = jest.fn();
    const { result } = renderHook(() =>
      useCaptureCardCameraController(
        createControllerOptions({
          onChangeBackCameraLens,
        })
      )
    );

    act(() => {
      result.current.handleCameraPreviewStarted();
    });

    const pinchGesture = getPinchGesture(result.current.cameraZoomGesture);

    act(() => {
      pinchGesture.handlers.onBegin?.();
      pinchGesture.handlers.onUpdate?.({ scale: 3 });
    });

    expect(onChangeBackCameraLens).not.toHaveBeenCalled();
    expect(result.current.cameraZoomLabel).toBe('2.5x');
    expect(result.current.cameraZoomSelectorLabel).toBe('2.5x');
    expect(result.current.cameraPreviewZoom).toBeCloseTo(2.54, 2);

    act(() => {
      pinchGesture.handlers.onFinalize?.();
    });
  });

  it('clamps pinch zoom to the active lens range instead of jumping to another rear lens', () => {
    const onChangeBackCameraLens = jest.fn();
    const { result } = renderHook(() =>
      useCaptureCardCameraController(
        createControllerOptions({
          onChangeBackCameraLens,
        })
      )
    );

    act(() => {
      result.current.handleCameraPreviewStarted();
    });

    const pinchGesture = getPinchGesture(result.current.cameraZoomGesture);

    act(() => {
      pinchGesture.handlers.onBegin?.();
      pinchGesture.handlers.onUpdate?.({ scale: 0.2 });
    });

    expect(onChangeBackCameraLens).not.toHaveBeenCalled();
    expect(result.current.cameraZoomLabel).toBe('1.0x');
    expect(result.current.cameraZoomSelectorLabel).toBe('1x');
    expect(result.current.cameraPreviewZoom).toBe(1);

    act(() => {
      pinchGesture.handlers.onFinalize?.();
    });
  });

  it('waits for the new rear lens to become active before applying its anchor zoom', () => {
    const onChangeBackCameraLens = jest.fn();
    const { result, rerender } = renderHook(
      (options: Parameters<typeof useCaptureCardCameraController>[0]) =>
        useCaptureCardCameraController(options),
      {
        initialProps: createControllerOptions({
          onChangeBackCameraLens,
        }),
      }
    );

    act(() => {
      result.current.handleBackCameraLensPress('telephoto');
    });

    expect(onChangeBackCameraLens).toHaveBeenCalledWith('telephoto');
    expect(result.current.cameraZoomLabel).toBe('1.0x');
    expect(result.current.cameraZoomSelectorLabel).toBe('1x');
    expect(result.current.cameraPreviewZoom).toBe(1);

    act(() => {
      rerender(
        createControllerOptions({
          onChangeBackCameraLens,
          backCameraLens: 'telephoto',
          cameraDevice: {
            id: 'back-telephoto-camera',
            position: 'back',
            neutralZoom: 1,
            minZoom: 1,
            maxZoom: 4,
            supportsFocus: true,
          } as any,
        })
      );
    });

    expect(result.current.cameraZoomLabel).toBe('2.0x');
    expect(result.current.cameraZoomSelectorLabel).toBe('2x');
    expect(result.current.cameraPreviewZoom).toBe(1);
    expect(result.current.showCameraZoomBadge).toBe(true);
  });
});

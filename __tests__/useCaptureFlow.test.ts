import { act, renderHook } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { AppState } from 'react-native';
import { useCaptureFlow } from '../hooks/useCaptureFlow';

const mockRequestPermission = jest.fn(async () => true);
const mockTakePhoto = jest.fn();
const mockStartRecording = jest.fn();
const mockStopRecording = jest.fn(async () => undefined);
const mockCancelRecording = jest.fn(async () => undefined);
const mockUseCameraDevice = jest.fn();
let mockPermissionStatus: 'granted' | 'not-determined' | 'denied' | 'restricted' = 'granted';
let mockHasPermission = true;
let mockPlatformOS: 'ios' | 'android' = 'ios';

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  Object.defineProperty(actual.Platform, 'OS', {
    configurable: true,
    get: () => mockPlatformOS,
  });
  return actual;
});

jest.mock('react-native-vision-camera', () => {
  const React = require('react');

  const MockCamera = React.forwardRef((_props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      takePhoto: mockTakePhoto,
      startRecording: mockStartRecording,
      stopRecording: mockStopRecording,
      cancelRecording: mockCancelRecording,
    }));
    return null;
  });

  MockCamera.getCameraPermissionStatus = jest.fn(() => mockPermissionStatus);

  return {
    Camera: MockCamera,
    useCameraDevice: (...args: any[]) => mockUseCameraDevice(...args),
    useCameraPermission: () => ({ hasPermission: mockHasPermission, requestPermission: mockRequestPermission }),
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
  },
}));

describe('useCaptureFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCameraDevice.mockImplementation((position: 'back' | 'front', filter?: { physicalDevices?: string[] }) => {
      if (position === 'front') {
        return {
          id: 'front-camera',
          position: 'front',
          neutralZoom: 1,
          maxZoom: 2,
        };
      }

      if (filter?.physicalDevices?.includes('ultra-wide-angle-camera')) {
        return {
          id: 'back-ultra-wide-camera',
          position: 'back',
          neutralZoom: 1,
          maxZoom: 2,
        };
      }

      if (filter?.physicalDevices?.includes('telephoto-camera')) {
        return {
          id: 'back-telephoto-camera',
          position: 'back',
          neutralZoom: 1,
          maxZoom: 6,
        };
      }

      return {
        id: 'back-camera',
        position: 'back',
        neutralZoom: 1,
        maxZoom: 4,
      };
    });
    mockTakePhoto.mockResolvedValue({ path: '/tmp/captured-photo.jpg' });
    mockStartRecording.mockImplementation(({ onRecordingFinished }: any) => {
      setTimeout(() => {
        onRecordingFinished?.({ path: '/tmp/captured-live-photo.mov' });
      }, 0);
    });
    mockPermissionStatus = 'granted';
    mockHasPermission = true;
    mockPlatformOS = 'ios';
    AppState.currentState = 'active';
  });

  it('prefers the wide-angle back camera by default and checks for ultra-wide support', () => {
    const { result } = renderHook(() => useCaptureFlow());

    expect(mockUseCameraDevice).toHaveBeenCalledWith('back', {
      physicalDevices: ['wide-angle-camera'],
    });
    expect(mockUseCameraDevice).toHaveBeenCalledWith('back', {
      physicalDevices: ['ultra-wide-angle-camera'],
    });
    expect(mockUseCameraDevice).toHaveBeenCalledWith('back', {
      physicalDevices: ['telephoto-camera'],
    });
    expect(result.current.cameraDevice?.id).toBe('back-camera');
    expect(result.current.hasUltraWideBackCamera).toBe(true);
    expect(result.current.hasTelephotoBackCamera).toBe(true);
    expect(result.current.availableBackCameraLenses).toEqual(['ultra-wide', 'wide', 'telephoto']);
  });

  it('switches to the ultra-wide back camera when requested', () => {
    const { result } = renderHook(() => useCaptureFlow());

    act(() => {
      result.current.setBackCameraLens('ultra-wide');
    });

    expect(result.current.backCameraLens).toBe('ultra-wide');
    expect(result.current.cameraDevice?.id).toBe('back-ultra-wide-camera');
  });

  it('switches to the telephoto back camera when requested', () => {
    const { result } = renderHook(() => useCaptureFlow());

    act(() => {
      result.current.setBackCameraLens('telephoto');
    });

    expect(result.current.backCameraLens).toBe('telephoto');
    expect(result.current.cameraDevice?.id).toBe('back-telephoto-camera');
  });

  it('captures a photo and normalizes the saved file uri', async () => {
    const { result } = renderHook(() => useCaptureFlow());

    act(() => {
      result.current.cameraRef.current = {
        takePhoto: mockTakePhoto,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        cancelRecording: mockCancelRecording,
      } as any;
    });

    await act(async () => {
      await result.current.takePicture();
    });

    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
    expect(mockTakePhoto).toHaveBeenCalledWith({ enableShutterSound: false });
    expect(result.current.capturedPhoto).toBe('file:///tmp/captured-photo.jpg');
  });

  it('ignores overlapping still photo captures', async () => {
    let resolvePhoto: ((value: { path: string }) => void) | null = null;
    mockTakePhoto.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolvePhoto = resolve;
      })
    );
    const { result } = renderHook(() => useCaptureFlow());

    act(() => {
      result.current.cameraRef.current = {
        takePhoto: mockTakePhoto,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        cancelRecording: mockCancelRecording,
      } as any;
    });

    let firstCapture: Promise<void> = Promise.resolve();
    let secondCapture: Promise<void> = Promise.resolve();
    await act(async () => {
      firstCapture = result.current.takePicture();
      secondCapture = result.current.takePicture();
      expect(mockTakePhoto).toHaveBeenCalledTimes(1);
      resolvePhoto?.({ path: '/tmp/captured-photo.jpg' });
      await Promise.all([firstCapture, secondCapture]);
    });

    expect(result.current.capturedPhoto).toBe('file:///tmp/captured-photo.jpg');
  });

  it('ignores overlapping raw photo-file captures', async () => {
    let resolvePhoto: ((value: { path: string }) => void) | null = null;
    mockTakePhoto.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolvePhoto = resolve;
      })
    );
    const { result } = renderHook(() => useCaptureFlow());

    act(() => {
      result.current.cameraRef.current = {
        takePhoto: mockTakePhoto,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        cancelRecording: mockCancelRecording,
      } as any;
    });

    let firstCapture: Promise<string | null> = Promise.resolve(null);
    let secondCapture: Promise<string | null> = Promise.resolve(null);
    let capturedUris: Array<string | null> = [];
    await act(async () => {
      firstCapture = result.current.capturePhotoFile();
      secondCapture = result.current.capturePhotoFile();
      expect(mockTakePhoto).toHaveBeenCalledTimes(1);
      resolvePhoto?.({ path: '/tmp/captured-photo.jpg' });
      capturedUris = await Promise.all([firstCapture, secondCapture]);
    });

    expect(capturedUris).toEqual(['file:///tmp/captured-photo.jpg', null]);
    expect(result.current.capturedPhoto).toBeNull();
  });

  it('restores the active camera facing from a persisted draft', () => {
    const { result } = renderHook(() => useCaptureFlow());

    act(() => {
      result.current.restoreCaptureState({
        captureMode: 'camera',
        cameraSubmode: 'dual',
        noteText: '',
        capturedPhoto: null,
        capturedPairedVideo: null,
        dualPrimaryPhoto: 'file:///tmp/primary.jpg',
        dualSecondaryPhoto: null,
        dualPrimaryFacing: 'back',
        dualSecondaryFacing: null,
        facing: 'front',
        radius: 150,
        selectedPhotoFilterId: 'original',
      });
    });

    expect(result.current.facing).toBe('front');
    expect(result.current.dualPrimaryFacing).toBe('back');
  });

  it('captures a live photo by taking a still photo and pairing it with a recorded motion clip', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useCaptureFlow());

    try {
      act(() => {
        result.current.cameraRef.current = {
          takePhoto: mockTakePhoto,
          startRecording: mockStartRecording,
          stopRecording: mockStopRecording,
          cancelRecording: mockCancelRecording,
        } as any;
      });

      await act(async () => {
        await result.current.startLivePhotoCapture();
      });

      expect(mockStartRecording).toHaveBeenCalledWith(
        expect.objectContaining({
          fileType: 'mp4',
          videoCodec: 'h265',
          onRecordingFinished: expect.any(Function),
          onRecordingError: expect.any(Function),
        })
      );
      expect(mockTakePhoto).toHaveBeenCalledWith({ enableShutterSound: false });
      expect(result.current.capturedPhoto).toBeNull();

      await act(async () => {
        const finishPromise = result.current.finishLivePhotoCapture();
        jest.advanceTimersByTime(0);
        await finishPromise;
      });

      expect(mockStopRecording).toHaveBeenCalledTimes(1);
      expect(result.current.capturedPhoto).toBe('file:///tmp/captured-photo.jpg');
      expect(result.current.capturedPairedVideo).toBe('file:///tmp/captured-live-photo.mov');
      expect(result.current.isLivePhotoCaptureInProgress).toBe(false);
      expect(result.current.isLivePhotoSaveGuardActive).toBe(true);

      act(() => {
        jest.advanceTimersByTime(900);
      });

      expect(result.current.isLivePhotoSaveGuardActive).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('captures a live photo on Android with the Android video codec', async () => {
    jest.useFakeTimers();
    mockPlatformOS = 'android';
    const { result } = renderHook(() => useCaptureFlow());

    try {
      act(() => {
        result.current.cameraRef.current = {
          takePhoto: mockTakePhoto,
          startRecording: mockStartRecording,
          stopRecording: mockStopRecording,
          cancelRecording: mockCancelRecording,
        } as any;
      });

      await act(async () => {
        await result.current.startLivePhotoCapture();
      });

      expect(mockStartRecording).toHaveBeenCalledWith(
        expect.objectContaining({
          fileType: 'mp4',
          videoCodec: 'h264',
          onRecordingFinished: expect.any(Function),
          onRecordingError: expect.any(Function),
        })
      );

      await act(async () => {
        const finishPromise = result.current.finishLivePhotoCapture();
        jest.advanceTimersByTime(0);
        await finishPromise;
      });

      expect(result.current.capturedPhoto).toBe('file:///tmp/captured-photo.jpg');
      expect(result.current.capturedPairedVideo).toBe('file:///tmp/captured-live-photo.mov');
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps a live photo recording active only briefly after release', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useCaptureFlow());

    try {
      act(() => {
        result.current.cameraRef.current = {
          takePhoto: mockTakePhoto,
          startRecording: mockStartRecording,
          stopRecording: mockStopRecording,
          cancelRecording: mockCancelRecording,
        } as any;
      });

      await act(async () => {
        await result.current.startLivePhotoCapture();
      });

      act(() => {
        result.current.handleShutterPressOut();
        jest.advanceTimersByTime(100);
      });

      expect(mockStopRecording).not.toHaveBeenCalled();
      expect(result.current.isLivePhotoCaptureInProgress).toBe(true);

      act(() => {
        jest.advanceTimersByTime(100);
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockStopRecording).toHaveBeenCalledTimes(1);
      expect(result.current.isLivePhotoCaptureInProgress).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not suppress the next photo tap after a live photo recording fails to start', async () => {
    mockStartRecording.mockImplementationOnce(() => {
      throw new Error('camera unavailable');
    });

    const { result } = renderHook(() => useCaptureFlow());

    act(() => {
      result.current.cameraRef.current = {
        takePhoto: mockTakePhoto,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        cancelRecording: mockCancelRecording,
      } as any;
    });

    await act(async () => {
      await result.current.startLivePhotoCapture();
    });

    await act(async () => {
      await result.current.takePicture();
    });

    expect(mockTakePhoto).toHaveBeenCalledTimes(1);
    expect(result.current.capturedPhoto).toBe('file:///tmp/captured-photo.jpg');
  });

  it('cancels an in-flight live photo recording when the capture flow is reset', async () => {
    const { result } = renderHook(() => useCaptureFlow());

    act(() => {
      result.current.cameraRef.current = {
        takePhoto: mockTakePhoto,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        cancelRecording: mockCancelRecording,
      } as any;
    });

    await act(async () => {
      await result.current.startLivePhotoCapture();
    });

    act(() => {
      result.current.resetCapture();
    });

    expect(mockCancelRecording).toHaveBeenCalledTimes(1);
    expect(result.current.isLivePhotoCaptureInProgress).toBe(false);
    expect(result.current.capturedPhoto).toBeNull();
  });

  it('cancels an in-flight live photo recording on unmount', async () => {
    const hook = renderHook(() => useCaptureFlow());

    act(() => {
      hook.result.current.cameraRef.current = {
        takePhoto: mockTakePhoto,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        cancelRecording: mockCancelRecording,
      } as any;
    });

    await act(async () => {
      await hook.result.current.startLivePhotoCapture();
    });

    hook.unmount();

    expect(mockCancelRecording).toHaveBeenCalledTimes(1);
  });

  it('treats denied camera permission as re-requestable on Android', () => {
    mockPlatformOS = 'android';
    mockPermissionStatus = 'denied';
    mockHasPermission = false;

    const { result } = renderHook(() => useCaptureFlow());

    expect(result.current.permission).toEqual({
      granted: false,
      canAskAgain: true,
      status: 'denied',
    });
  });

  it('treats denied camera permission as settings-only on iOS', () => {
    mockPlatformOS = 'ios';
    mockPermissionStatus = 'denied';
    mockHasPermission = false;

    const { result } = renderHook(() => useCaptureFlow());

    expect(result.current.permission).toEqual({
      granted: false,
      canAskAgain: false,
      status: 'denied',
    });
  });

  it('refreshes the camera session after permission is granted in camera mode', async () => {
    mockPlatformOS = 'android';
    mockPermissionStatus = 'not-determined';
    mockHasPermission = false;

    const { result } = renderHook(() => useCaptureFlow());

    act(() => {
      result.current.toggleCaptureMode();
    });

    expect(result.current.captureMode).toBe('camera');
    const sessionKeyBeforePermission = result.current.cameraSessionKey;

    await act(async () => {
      await result.current.requestPermission();
    });

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(result.current.permission.granted).toBe(true);
    expect(result.current.permission.status).toBe('granted');
    expect(result.current.cameraSessionKey).toBe(sessionKeyBeforePermission + 1);
  });

  it('switches capture modes on Android without animating the card shell', () => {
    mockPlatformOS = 'android';

    const { result } = renderHook(() => useCaptureFlow());

    act(() => {
      result.current.toggleCaptureMode();
    });

    expect(result.current.captureMode).toBe('camera');
    expect(result.current.isModeSwitchAnimating).toBe(false);
    expect(result.current.captureScale.value).toBe(1);
    expect(result.current.captureTranslateY.value).toBe(0);
  });

  it('refreshes the camera session when returning from the permission sheet', () => {
    AppState.currentState = 'inactive';
    let appStateListener: ((state: 'active' | 'background' | 'inactive') => void) | null = null;
    const remove = jest.fn();
    const addEventListenerSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      appStateListener = listener as (state: 'active' | 'background' | 'inactive') => void;
      return { remove } as any;
    });

    const { result } = renderHook(() => useCaptureFlow());

    act(() => {
      result.current.toggleCaptureMode();
    });

    const sessionKeyBeforeForeground = result.current.cameraSessionKey;

    act(() => {
      appStateListener?.('active');
    });

    expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
    expect(result.current.cameraSessionKey).toBe(sessionKeyBeforeForeground + 1);
  });
});

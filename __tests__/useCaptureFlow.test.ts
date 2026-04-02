import { act, renderHook } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { AppState } from 'react-native';
import { useCaptureFlow } from '../hooks/useCaptureFlow';

const mockRequestPermission = jest.fn(async () => true);
const mockTakePhoto = jest.fn();
const mockStartRecording = jest.fn();
const mockStopRecording = jest.fn(async () => undefined);
const mockCancelRecording = jest.fn(async () => undefined);
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
    useCameraDevice: () => ({
      id: 'back-camera',
      position: 'back',
      neutralZoom: 1,
      maxZoom: 4,
    }),
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

  it('captures a photo without triggering the custom flash overlay animation', async () => {
    const { result } = renderHook(() => useCaptureFlow());

    act(() => {
      result.current.cameraRef.current = {
        takePhoto: mockTakePhoto,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        cancelRecording: mockCancelRecording,
      } as any;
      result.current.flashAnim.value = 0;
    });

    await act(async () => {
      await result.current.takePicture();
    });

    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
    expect(mockTakePhoto).toHaveBeenCalledWith({ enableShutterSound: false });
    expect(result.current.capturedPhoto).toBe('file:///tmp/captured-photo.jpg');
    expect(result.current.flashAnim.value).toBe(0);
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

  it('keeps a live photo recording active for a minimum capture window after release', async () => {
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
        jest.advanceTimersByTime(500);
      });

      expect(mockStopRecording).not.toHaveBeenCalled();
      expect(result.current.isLivePhotoCaptureInProgress).toBe(true);

      act(() => {
        jest.advanceTimersByTime(500);
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

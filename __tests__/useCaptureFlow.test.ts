import { act, renderHook } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useCaptureFlow } from '../hooks/useCaptureFlow';

const mockRequestPermission = jest.fn(async () => true);
const mockTakePhoto = jest.fn();
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
    mockPermissionStatus = 'granted';
    mockHasPermission = true;
    mockPlatformOS = 'ios';
  });

  it('captures a photo without triggering the custom flash overlay animation', async () => {
    const { result } = renderHook(() => useCaptureFlow());

    act(() => {
      result.current.cameraRef.current = {
        takePhoto: mockTakePhoto,
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
});

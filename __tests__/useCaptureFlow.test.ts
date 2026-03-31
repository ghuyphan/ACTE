import { act, renderHook } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useCaptureFlow } from '../hooks/useCaptureFlow';

const mockRequestPermission = jest.fn(async () => ({ granted: true, canAskAgain: true }));
const mockTakePhoto = jest.fn();

jest.mock('react-native-vision-camera', () => {
  const React = require('react');

  const MockCamera = React.forwardRef((_props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      takePhoto: mockTakePhoto,
    }));
    return null;
  });

  MockCamera.getCameraPermissionStatus = jest.fn(() => 'granted');

  return {
    Camera: MockCamera,
    useCameraDevice: () => ({
      id: 'back-camera',
      position: 'back',
      neutralZoom: 1,
      maxZoom: 4,
    }),
    useCameraPermission: () => ({ hasPermission: true, requestPermission: mockRequestPermission }),
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
});

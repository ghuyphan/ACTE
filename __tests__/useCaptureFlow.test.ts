import { act, renderHook } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useCaptureFlow } from '../hooks/useCaptureFlow';

const mockRequestPermission = jest.fn(async () => ({ granted: true, canAskAgain: true }));
const mockTakePictureAsync = jest.fn();

jest.mock('expo-camera', () => ({
  CameraView: function MockCameraView() {
    return null;
  },
  useCameraPermissions: () => [{ granted: true, canAskAgain: true }, mockRequestPermission],
}));

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
    mockTakePictureAsync.mockResolvedValue({ uri: 'file:///captured-photo.jpg' });
  });

  it('captures a photo without triggering the custom flash overlay animation', async () => {
    const { result } = renderHook(() => useCaptureFlow());

    act(() => {
      result.current.cameraRef.current = {
        takePictureAsync: mockTakePictureAsync,
      } as any;
      result.current.flashAnim.value = 0;
    });

    await act(async () => {
      await result.current.takePicture();
    });

    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
    expect(mockTakePictureAsync).toHaveBeenCalledWith({ quality: 0.35 });
    expect(result.current.capturedPhoto).toBe('file:///captured-photo.jpg');
    expect(result.current.flashAnim.value).toBe(0);
  });
});

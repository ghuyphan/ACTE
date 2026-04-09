import * as MediaLibrary from 'expo-media-library';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import {
  captureViewAsImage,
  cleanupCapturedImage,
  exportPolaroid,
  POLAROID_EXPORT_HEIGHT,
  POLAROID_EXPORT_WIDTH,
  requestSavePermission,
} from '../services/polaroidExport';

describe('polaroidExport', () => {
  const mediaLibraryMock = MediaLibrary as jest.Mocked<typeof MediaLibrary>;
  const captureRefMock = captureRef as jest.MockedFunction<typeof captureRef>;
  const releaseCaptureMock = releaseCapture as jest.MockedFunction<typeof releaseCapture>;
  const viewRef = { current: {} as any };

  beforeEach(() => {
    jest.clearAllMocks();
    mediaLibraryMock.getPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: true,
      status: 'granted',
      expires: 'never',
    } as any);
    mediaLibraryMock.requestPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: true,
      status: 'granted',
      expires: 'never',
    } as any);
    mediaLibraryMock.saveToLibraryAsync.mockResolvedValue(undefined);
    captureRefMock.mockResolvedValue('file:///tmp/noto-polaroid.png');
  });

  it('requests add-only permission when current access is denied', async () => {
    mediaLibraryMock.getPermissionsAsync.mockResolvedValueOnce({
      granted: false,
      canAskAgain: true,
      status: 'denied',
      expires: 'never',
    } as any);

    await expect(requestSavePermission()).resolves.toBe('granted');

    expect(mediaLibraryMock.getPermissionsAsync).toHaveBeenCalledWith(true);
    expect(mediaLibraryMock.requestPermissionsAsync).toHaveBeenCalledWith(true);
  });

  it('reports blocked permission when the system cannot ask again', async () => {
    mediaLibraryMock.getPermissionsAsync.mockResolvedValueOnce({
      granted: false,
      canAskAgain: true,
      status: 'denied',
      expires: 'never',
    } as any);
    mediaLibraryMock.requestPermissionsAsync.mockResolvedValueOnce({
      granted: false,
      canAskAgain: false,
      status: 'denied',
      expires: 'never',
    } as any);

    await expect(requestSavePermission()).resolves.toBe('blocked');
  });

  it('captures the export view with the expected high-res dimensions', async () => {
    await expect(captureViewAsImage(viewRef)).resolves.toBe('file:///tmp/noto-polaroid.png');

    expect(captureRefMock).toHaveBeenCalledWith(
      viewRef,
      expect.objectContaining({
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: POLAROID_EXPORT_WIDTH,
        height: POLAROID_EXPORT_HEIGHT,
      })
    );
  });

  it('returns permission-denied before capture when access is not granted', async () => {
    mediaLibraryMock.getPermissionsAsync.mockResolvedValueOnce({
      granted: false,
      canAskAgain: true,
      status: 'denied',
      expires: 'never',
    } as any);
    mediaLibraryMock.requestPermissionsAsync.mockResolvedValueOnce({
      granted: false,
      canAskAgain: true,
      status: 'denied',
      expires: 'never',
    } as any);

    await expect(exportPolaroid(viewRef)).resolves.toBe('permission-denied');
    expect(captureRefMock).not.toHaveBeenCalled();
  });

  it('returns save-failed and still releases the temporary capture', async () => {
    mediaLibraryMock.saveToLibraryAsync.mockRejectedValueOnce(new Error('save failed'));

    await expect(exportPolaroid(viewRef)).resolves.toBe('save-failed');
    expect(releaseCaptureMock).toHaveBeenCalledWith('file:///tmp/noto-polaroid.png');
  });

  it('returns success and cleans up the temporary file', async () => {
    await expect(exportPolaroid(viewRef)).resolves.toBe('success');

    expect(mediaLibraryMock.saveToLibraryAsync).toHaveBeenCalledWith('file:///tmp/noto-polaroid.png');
    expect(releaseCaptureMock).toHaveBeenCalledWith('file:///tmp/noto-polaroid.png');
  });

  it('cleans up captures defensively when asked directly', () => {
    cleanupCapturedImage('file:///tmp/keep-me-short-lived.png');
    cleanupCapturedImage(null);

    expect(releaseCaptureMock).toHaveBeenCalledTimes(1);
    expect(releaseCaptureMock).toHaveBeenCalledWith('file:///tmp/keep-me-short-lived.png');
  });
});

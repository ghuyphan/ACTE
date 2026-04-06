const mockManipulateAsync = jest.fn();

jest.mock('expo-image-manipulator', () => ({
  __esModule: true,
  manipulateAsync: (...args: unknown[]) => mockManipulateAsync(...args),
  SaveFormat: {
    JPEG: 'jpeg',
  },
}));

describe('stampCutter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockManipulateAsync.mockResolvedValue({
      uri: 'file:///cache/stamp-cut.jpg',
    });
  });

  function loadModule() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../services/stampCutter');
  }

  it('clamps transform offsets to keep the crop covered', () => {
    const { normalizeStampCutterTransform } = loadModule();

    const normalized = normalizeStampCutterTransform(
      { width: 1600, height: 1200 },
      { width: 320, height: 420 },
      { zoom: 1, offsetX: 400, offsetY: -400 }
    );

    expect(normalized.zoom).toBe(1);
    expect(normalized.maxOffsetX).toBeGreaterThan(0);
    expect(normalized.maxOffsetY).toBeGreaterThanOrEqual(0);
    expect(normalized.offsetX).toBe(normalized.maxOffsetX);
    expect(normalized.offsetY).toBe(-normalized.maxOffsetY);
  });

  it('normalizes rotation into a stable signed and unsigned range', () => {
    const {
      normalizeStampCutterRotation,
      snapStampCutterRotation,
      normalizeStampCutterTransform,
    } = loadModule();

    expect(normalizeStampCutterRotation(-450)).toBe(270);
    expect(normalizeStampCutterRotation(450, true)).toBe(90);
    expect(snapStampCutterRotation(1.4)).toBe(0);
    expect(snapStampCutterRotation(-181.5)).toBe(178.5);

    const normalized = normalizeStampCutterTransform(
      { width: 1200, height: 800 },
      { width: 320, height: 420 },
      { zoom: 1.2, rotation: -450 }
    );

    expect(normalized.rotation).toBe(270);
  });

  it('converts preview offsets into a source crop rect', () => {
    const { calculateStampCutterCropRect } = loadModule();

    const centeredCrop = calculateStampCutterCropRect(
      { width: 1600, height: 1200 },
      { width: 320, height: 420 },
      { x: 96, y: 120, width: 128, height: 90 },
      { zoom: 1, offsetX: 0, offsetY: 0 }
    );
    const shiftedCrop = calculateStampCutterCropRect(
      { width: 1600, height: 1200 },
      { width: 320, height: 420 },
      { x: 96, y: 120, width: 128, height: 90 },
      { zoom: 1, offsetX: 90, offsetY: -60 }
    );

    expect(shiftedCrop.x).toBeLessThan(centeredCrop.x);
    expect(shiftedCrop.y).toBeGreaterThanOrEqual(centeredCrop.y);
    expect(shiftedCrop.width).toBeCloseTo(centeredCrop.width, 5);
    expect(shiftedCrop.height).toBeCloseTo(centeredCrop.height, 5);
  });

  it('exports a rounded JPEG crop for import', async () => {
    const { exportStampCutoutImageSource } = loadModule();

    const result = await exportStampCutoutImageSource(
      {
        source: {
          uri: 'file:///photo.jpg',
          mimeType: 'image/jpeg',
          name: 'photo.jpg',
        },
        width: 2000,
        height: 1500,
      },
      { width: 280.4, height: 360.2 },
      { x: 84.1, y: 110.2, width: 72.3, height: 54.6 },
      { zoom: 1.4, offsetX: 24.2, offsetY: -18.7 }
    );

    expect(mockManipulateAsync).toHaveBeenCalledWith(
      'file:///photo.jpg',
      [
        {
          crop: expect.objectContaining({
            originX: expect.any(Number),
            originY: expect.any(Number),
            width: expect.any(Number),
            height: expect.any(Number),
          }),
        },
      ],
      expect.objectContaining({
        compress: 0.94,
        format: 'jpeg',
      })
    );
    expect(result.source).toEqual({
      uri: 'file:///cache/stamp-cut.jpg',
      mimeType: 'image/jpeg',
      name: 'photo-stamp.jpg',
    });
  });

  it('rotates before cropping when the draft is rotated', async () => {
    mockManipulateAsync
      .mockResolvedValueOnce({
        uri: 'file:///cache/rotated.jpg',
        width: 1900,
        height: 2100,
      })
      .mockResolvedValueOnce({
        uri: 'file:///cache/stamp-cut.jpg',
      });

    const { exportStampCutoutImageSource } = loadModule();

    const result = await exportStampCutoutImageSource(
      {
        source: {
          uri: 'file:///photo.jpg',
          mimeType: 'image/jpeg',
          name: 'photo.jpg',
        },
        width: 2000,
        height: 1500,
      },
      { width: 280.4, height: 360.2 },
      { x: 84.1, y: 110.2, width: 72.3, height: 54.6 },
      { zoom: 1.4, offsetX: 24.2, offsetY: -18.7, rotation: -450 }
    );

    expect(mockManipulateAsync).toHaveBeenNthCalledWith(
      1,
      'file:///photo.jpg',
      [{ rotate: 270 }],
      expect.objectContaining({
        compress: 1,
        format: 'jpeg',
      })
    );
    expect(mockManipulateAsync).toHaveBeenNthCalledWith(
      2,
      'file:///cache/rotated.jpg',
      [
        {
          crop: expect.objectContaining({
            originX: expect.any(Number),
            originY: expect.any(Number),
            width: expect.any(Number),
            height: expect.any(Number),
          }),
        },
      ],
      expect.objectContaining({
        compress: 0.94,
        format: 'jpeg',
      })
    );
    expect(result.intermediateCleanupUri).toBe('file:///cache/rotated.jpg');
  });
});

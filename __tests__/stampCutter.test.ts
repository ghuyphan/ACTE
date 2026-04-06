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
    expect(normalized.maxOffsetY).toBeGreaterThan(0);
    expect(normalized.offsetX).toBe(normalized.maxOffsetX);
    expect(normalized.offsetY).toBe(-normalized.maxOffsetY);
  });

  it('converts preview offsets into a source crop rect', () => {
    const { calculateStampCutterCropRect } = loadModule();

    const centeredCrop = calculateStampCutterCropRect(
      { width: 1600, height: 1200 },
      { width: 320, height: 420 },
      { zoom: 1, offsetX: 0, offsetY: 0 }
    );
    const shiftedCrop = calculateStampCutterCropRect(
      { width: 1600, height: 1200 },
      { width: 320, height: 420 },
      { zoom: 1, offsetX: 90, offsetY: -60 }
    );

    expect(shiftedCrop.x).toBeLessThan(centeredCrop.x);
    expect(shiftedCrop.y).toBeGreaterThan(centeredCrop.y);
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
});

import { getStickerOutlineOffsets, getStickerPinchScale } from '../components/notes/stickerCanvasMetrics';

describe('stickerCanvasMetrics', () => {
  it('uses a lighter outline profile for smaller stickers', () => {
    expect(getStickerOutlineOffsets(4.5)).toEqual([
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: -1 },
      { x: 0, y: 1 },
    ]);
  });

  it('keeps the fuller outline profile for larger stickers', () => {
    expect(getStickerOutlineOffsets(6)).toEqual([
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -0.82, y: -0.82 },
      { x: -0.82, y: 0.82 },
      { x: 0.82, y: -0.82 },
      { x: 0.82, y: 0.82 },
    ]);
  });

  it('can force a denser circular outline profile for platforms that need it', () => {
    expect(getStickerOutlineOffsets(4.5, { preferContinuous: true })).toEqual([
      { x: -1, y: 0 },
      { x: -0.92, y: -0.38 },
      { x: -0.71, y: -0.71 },
      { x: -0.38, y: -0.92 },
      { x: 0, y: -1 },
      { x: 0.38, y: -0.92 },
      { x: 0.71, y: -0.71 },
      { x: 0.92, y: -0.38 },
      { x: 1, y: 0 },
      { x: 0.92, y: 0.38 },
      { x: 0.71, y: 0.71 },
      { x: 0.38, y: 0.92 },
      { x: 0, y: 1 },
      { x: -0.38, y: 0.92 },
      { x: -0.71, y: 0.71 },
      { x: -0.92, y: 0.38 },
    ]);
  });

  it('makes pinch-resize a bit more responsive without bypassing scale clamps', () => {
    expect(getStickerPinchScale(1, 1.1)).toBeCloseTo(1.119, 3);
    expect(getStickerPinchScale(1, 0.9)).toBeCloseTo(0.883, 3);
    expect(getStickerPinchScale(2.9, 1.2)).toBe(3);
    expect(getStickerPinchScale(0.4, 0.1)).toBe(0.35);
  });
});

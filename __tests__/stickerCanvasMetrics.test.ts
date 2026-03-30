import { getStickerOutlineOffsets } from '../components/stickerCanvasMetrics';

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
});

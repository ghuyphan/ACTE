import { getStampFrameMetrics } from '../components/notes/stampFrameMetrics';

describe('stampFrameMetrics', () => {
  it('keeps the png-hole stamp template geometry stable across scale for the same aspect ratio', () => {
    const reference = getStampFrameMetrics(272, 309);
    const scaled = getStampFrameMetrics(136, 154.5);

    expect(reference.topCenters).toHaveLength(scaled.topCenters.length);
    expect(reference.leftCenters).toHaveLength(scaled.leftCenters.length);
    expect(reference.topCenters).toHaveLength(9);
    expect(reference.leftCenters).toHaveLength(10);
    expect(scaled.perforationRadius).toBeCloseTo(reference.perforationRadius / 2, 6);
    expect(scaled.perforationOffset).toBeCloseTo(reference.perforationOffset / 2, 6);
    expect(scaled.borderRadius).toBeCloseTo(reference.borderRadius / 2, 6);
  });

  it('adapts perforation counts to aspect ratio without changing them across scale', () => {
    const landscape = getStampFrameMetrics(360, 240);
    const scaledLandscape = getStampFrameMetrics(180, 120);

    expect(landscape.topCenters.length).toBeGreaterThan(landscape.leftCenters.length);
    expect(landscape.topCenters).toHaveLength(scaledLandscape.topCenters.length);
    expect(landscape.leftCenters).toHaveLength(scaledLandscape.leftCenters.length);
  });
});

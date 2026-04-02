import {
  createRenderedStrokeCache,
  getOrCreateRenderedStroke,
  type DoodleStroke,
} from '../components/notes/NoteDoodleCanvas';

describe('NoteDoodleCanvas render cache', () => {
  it('reuses cached render data for the same stroke and size', () => {
    const cache = createRenderedStrokeCache();
    const stroke: DoodleStroke = {
      color: '#1C1C1E',
      points: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
    };

    const firstRender = getOrCreateRenderedStroke(cache, stroke, 200, 160, true);
    const secondRender = getOrCreateRenderedStroke(cache, stroke, 200, 160, true);

    expect(secondRender).toBe(firstRender);
  });

  it('invalidates cached render data when the canvas size changes', () => {
    const cache = createRenderedStrokeCache();
    const stroke: DoodleStroke = {
      color: '#1C1C1E',
      points: [0.15, 0.25, 0.35, 0.45],
    };

    const firstRender = getOrCreateRenderedStroke(cache, stroke, 200, 160, true);
    const resizedRender = getOrCreateRenderedStroke(cache, stroke, 240, 160, true);

    expect(resizedRender).not.toBe(firstRender);
  });
});

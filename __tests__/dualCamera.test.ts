import { createSequentialDualCameraStillCapture } from '../services/dualCamera';

describe('dual camera helpers', () => {
  it('keeps the second sequential shot as the composed main image', () => {
    expect(
      createSequentialDualCameraStillCapture({
        firstShotUri: 'file:///first.jpg',
        firstShotFacing: 'front',
        secondShotUri: 'file:///second.jpg',
        secondShotFacing: 'back',
      })
    ).toEqual({
      primaryUri: 'file:///second.jpg',
      secondaryUri: 'file:///first.jpg',
      primaryFacing: 'back',
      secondaryFacing: 'front',
      width: 0,
      height: 0,
    });
  });
});

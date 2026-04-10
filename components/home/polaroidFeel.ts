export type PolaroidFeelConfig = {
  initialScale: number;
  overshootScale: number;
  initialRotation: number;
  settleRotation: number;
  flashPeakOpacity: number;
  glowPeakOpacity: number;
  enterDuration: number;
  settleDuration: number;
  holdDuration: number;
  fadeDuration: number;
};

export function getPolaroidFeelConfig(reduceMotionEnabled: boolean): PolaroidFeelConfig {
  if (reduceMotionEnabled) {
    return {
      initialScale: 0.992,
      overshootScale: 1.008,
      initialRotation: 0.25,
      settleRotation: 0,
      flashPeakOpacity: 0,
      glowPeakOpacity: 0.12,
      enterDuration: 130,
      settleDuration: 150,
      holdDuration: 720,
      fadeDuration: 140,
    };
  }

  return {
    initialScale: 0.958,
    overshootScale: 1.018,
    initialRotation: 2.4,
    settleRotation: 0.35,
    flashPeakOpacity: 0.22,
    glowPeakOpacity: 0.18,
    enterDuration: 260,
    settleDuration: 240,
    holdDuration: 1120,
    fadeDuration: 220,
  };
}

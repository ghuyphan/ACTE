import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  FadeOutDown,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated';

export const mapMotionDurations = {
  instant: 0,
  fast: 110,
  standard: 170,
  slow: 240,
} as const;

export const mapMotionEasing = {
  standard: Easing.bezier(0.22, 1, 0.36, 1),
  emphasis: Easing.bezier(0.2, 0.9, 0.2, 1),
  press: Easing.out(Easing.quad),
} as const;

export const mapMotionPressTiming = {
  duration: mapMotionDurations.fast,
  easing: mapMotionEasing.press,
} as const;

export function getMapLayoutTransition(reduceMotionEnabled: boolean) {
  return reduceMotionEnabled
    ? LinearTransition.duration(mapMotionDurations.fast)
    : LinearTransition.duration(mapMotionDurations.standard).easing(mapMotionEasing.standard);
}

export function getMapOverlayEnter(reduceMotionEnabled: boolean) {
  return reduceMotionEnabled
    ? FadeIn.duration(mapMotionDurations.fast).reduceMotion(ReduceMotion.Never)
    : FadeInDown.duration(mapMotionDurations.standard)
        .easing(mapMotionEasing.standard)
        .reduceMotion(ReduceMotion.Never);
}

export function getMapOverlayExit(reduceMotionEnabled: boolean) {
  return reduceMotionEnabled
    ? FadeOut.duration(mapMotionDurations.fast).reduceMotion(ReduceMotion.Never)
    : FadeOut.duration(mapMotionDurations.standard).reduceMotion(ReduceMotion.Never);
}

export function getMapCardEnter(reduceMotionEnabled: boolean) {
  return reduceMotionEnabled
    ? FadeInUp.duration(mapMotionDurations.fast).reduceMotion(ReduceMotion.Never)
    : FadeInUp.duration(mapMotionDurations.standard)
        .easing(mapMotionEasing.emphasis)
        .reduceMotion(ReduceMotion.Never);
}

export function getMapCardExit(reduceMotionEnabled: boolean) {
  return reduceMotionEnabled
    ? FadeOutDown.duration(mapMotionDurations.fast).reduceMotion(ReduceMotion.Never)
    : FadeOutDown.duration(mapMotionDurations.standard).reduceMotion(ReduceMotion.Never);
}

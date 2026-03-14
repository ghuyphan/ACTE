import {
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

export const mapMotionSpring = {
  damping: 20,
  stiffness: 180,
  mass: 0.82,
} as const;

export const mapMotionEmphasisSpring = {
  damping: 22,
  stiffness: 240,
  mass: 0.72,
} as const;

export const mapMotionPressSpring = {
  damping: 20,
  stiffness: 260,
  mass: 0.7,
} as const;

export function getMapLayoutTransition(reduceMotionEnabled: boolean) {
  return reduceMotionEnabled
    ? LinearTransition.duration(mapMotionDurations.fast)
    : LinearTransition.springify().damping(mapMotionSpring.damping).stiffness(mapMotionSpring.stiffness);
}

export function getMapOverlayEnter(reduceMotionEnabled: boolean) {
  return reduceMotionEnabled
    ? FadeIn.duration(mapMotionDurations.fast).reduceMotion(ReduceMotion.Never)
    : FadeInDown.springify()
        .damping(mapMotionSpring.damping)
        .stiffness(mapMotionSpring.stiffness)
        .mass(mapMotionSpring.mass)
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
    : FadeInUp.springify()
        .damping(mapMotionSpring.damping)
        .stiffness(mapMotionSpring.stiffness)
        .mass(mapMotionSpring.mass)
        .reduceMotion(ReduceMotion.Never);
}

export function getMapCardExit(reduceMotionEnabled: boolean) {
  return reduceMotionEnabled
    ? FadeOutDown.duration(mapMotionDurations.fast).reduceMotion(ReduceMotion.Never)
    : FadeOutDown.duration(mapMotionDurations.standard).reduceMotion(ReduceMotion.Never);
}

import * as Haptics from 'expo-haptics';
import { Easing } from 'react-native-reanimated';

export const REDUCED_MOTION_SCALE = 0.55;

export const CAPTURE_BUTTON_PRESS_IN = { duration: 120, easing: Easing.out(Easing.quad) };
export const CAPTURE_BUTTON_PRESS_OUT = { duration: 160, easing: Easing.out(Easing.cubic) };
export const CAPTURE_BUTTON_STATE_IN = { duration: 160, easing: Easing.out(Easing.cubic) };
export const CAPTURE_BUTTON_STATE_OUT = { duration: 210, easing: Easing.out(Easing.cubic) };
export const CAPTURE_SAVE_SUCCESS_SCALE = { duration: 220, easing: Easing.out(Easing.cubic) };
export const CAPTURE_SAVE_SUCCESS_RESET = { duration: 220, easing: Easing.out(Easing.back(1.1)) };
export const CAPTURE_SAVE_SUCCESS_EXIT = { duration: 170, easing: Easing.out(Easing.cubic) };
export const CAPTURE_SAVE_BUSY_SCALE = { duration: 150, easing: Easing.out(Easing.cubic) };
export const CAPTURE_MODE_SWITCH_OUT = { duration: 110, easing: Easing.out(Easing.cubic) };
export const CAPTURE_MODE_SWITCH_IN = { duration: 220, easing: Easing.out(Easing.cubic) };
export const CAPTURE_EMOJI_POP_ENTER = { duration: 180, easing: Easing.out(Easing.cubic) };
export const CAPTURE_EMOJI_POP_HOLD = { duration: 520 };
export const CAPTURE_EMOJI_POP_EXIT = { duration: 240, easing: Easing.in(Easing.quad) };
export const CAPTURE_EMOJI_POP_LIFT = { duration: 220, easing: Easing.out(Easing.cubic) };
export const CAPTURE_EMOJI_POP_DRIFT = { duration: 620, easing: Easing.out(Easing.quad) };
export const CAPTURE_EMOJI_POP_BOUNCE = { duration: 180, easing: Easing.out(Easing.back(1.2)) };
export const CAPTURE_EMOJI_POP_SETTLE = { duration: 220, easing: Easing.out(Easing.cubic) };
export const CAPTURE_TOOLBAR_ENTER = { duration: 160, easing: Easing.out(Easing.cubic) };
export const CAPTURE_TOOLBAR_EXIT = { duration: 120, easing: Easing.in(Easing.quad) };

export function scaleCaptureDuration(duration: number, reduceMotionEnabled: boolean) {
  return reduceMotionEnabled ? Math.round(duration * REDUCED_MOTION_SCALE) : duration;
}

export function getCaptureTiming<T extends { duration: number }>(
  config: T,
  reduceMotionEnabled: boolean
): T {
  if (!reduceMotionEnabled) {
    return config;
  }

  return {
    ...config,
    duration: scaleCaptureDuration(config.duration, true),
  };
}

export function triggerCaptureCardHaptic(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light
) {
  void Haptics.impactAsync(style);
}

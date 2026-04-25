import { getGlassSurfacePalette } from '../../ui/glassTokens';
import type { CaptureCardColors } from './captureShared';

export type CaptureControlVisualState = 'idle' | 'active' | 'disabled' | 'busy';

export const CAPTURE_CONTROL_DISABLED_OPACITY = 0.55;
export const CAPTURE_CONTROL_BUSY_OPACITY = 1;

export function getCaptureControlVisualState({
  active = false,
  busy = false,
  disabled = false,
}: {
  active?: boolean;
  busy?: boolean;
  disabled?: boolean;
}): CaptureControlVisualState {
  if (disabled) {
    return 'disabled';
  }

  if (busy) {
    return 'busy';
  }

  if (active) {
    return 'active';
  }

  return 'idle';
}

export function getCaptureChromePalette(colors: CaptureCardColors) {
  return getGlassSurfacePalette({
    isDark: colors.captureGlassColorScheme === 'dark',
    borderColor: colors.captureCardBorder,
    colors,
  });
}

export function getCaptureGlassActionVisuals(
  colors: CaptureCardColors,
  state: CaptureControlVisualState = 'idle'
) {
  const glassPalette = getCaptureChromePalette(colors);
  const active = state === 'active' || state === 'busy';

  return {
    active,
    borderColor: glassPalette.controlBorderColor,
    disabledOpacity: state === 'busy'
      ? CAPTURE_CONTROL_BUSY_OPACITY
      : CAPTURE_CONTROL_DISABLED_OPACITY,
    fallbackColor: active
      ? glassPalette.activeControlBackgroundColor
      : glassPalette.controlBackgroundColor,
    glassColorScheme: colors.captureGlassColorScheme,
    iconColor: colors.captureGlassText,
  } as const;
}

export function getCaptureShutterVisuals(colors: CaptureCardColors) {
  return {
    fillColor: colors.primary,
    ringColor: colors.border,
    contentColor: '#FFFFFF',
  } as const;
}

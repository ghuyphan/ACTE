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
    fillColor: colors.captureButtonBg,
    ringColor: colors.border,
    contentColor: getReadableOnColor(colors.captureButtonBg, colors.text),
  } as const;
}

function getReadableOnColor(backgroundColor: string, fallbackTextColor: string) {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(backgroundColor.trim());
  if (!match) {
    return '#FFFFFF';
  }

  const hex = match[1].length === 3
    ? match[1].split('').map((char) => `${char}${char}`).join('')
    : match[1];
  const red = parseInt(hex.slice(0, 2), 16) / 255;
  const green = parseInt(hex.slice(2, 4), 16) / 255;
  const blue = parseInt(hex.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

  return luminance > 0.72 ? fallbackTextColor : '#FFFFFF';
}

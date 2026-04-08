import { Platform, type ViewStyle } from 'react-native';
import { Shadows } from '../../constants/theme';

const ANDROID_OVERLAY_BORDER = {
  light: 'rgba(113,86,26,0.18)',
  dark: 'rgba(255,255,255,0.08)',
} as const;

const ANDROID_OVERLAY_FILL = {
  light: 'rgba(255,251,246,0.88)',
  dark: 'rgba(24,20,18,0.76)',
} as const;

const ANDROID_OVERLAY_MUTED_FILL = {
  light: 'rgba(255,255,255,0.62)',
  dark: 'rgba(255,255,255,0.1)',
} as const;

const ANDROID_OVERLAY_SCRIM = {
  light: 'rgba(255,255,255,0.44)',
  dark: 'rgba(255,255,255,0.05)',
} as const;

export const mapOverlayTokens = {
  overlayRadius: 24,
  overlayCompactRadius: 18,
  overlayPadding: 14,
  overlayPaddingCompact: 12,
  overlayGap: 8,
  overlayCardGap: 10,
  overlayMinHeight: 40,
  controlHeight: 36,
  floatingButtonSize: 46,
  overlayBorderColor: {
    light: 'rgba(17,24,39,0.06)',
    dark: 'rgba(255,255,255,0.14)',
  },
  overlayShadow: (
    Platform.OS === 'android'
      ? {
          shadowColor: '#000',
          ...Shadows.androidChrome,
        }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.08,
          shadowRadius: 20,
          elevation: 4,
          borderCurve: 'continuous',
        }
  ) satisfies ViewStyle,
} as const;

export function getOverlayBorderColor(isDark: boolean) {
  if (Platform.OS === 'android') {
    return isDark ? ANDROID_OVERLAY_BORDER.dark : ANDROID_OVERLAY_BORDER.light;
  }

  return isDark ? mapOverlayTokens.overlayBorderColor.dark : mapOverlayTokens.overlayBorderColor.light;
}

export function getOverlayFallbackColor(isDark: boolean) {
  if (Platform.OS === 'android') {
    return isDark ? ANDROID_OVERLAY_FILL.dark : ANDROID_OVERLAY_FILL.light;
  }

  return isDark ? 'rgba(16,18,24,0.78)' : 'rgba(255,255,255,0.82)';
}

export function getOverlayMutedFillColor(isDark: boolean) {
  if (Platform.OS === 'android') {
    return isDark ? ANDROID_OVERLAY_MUTED_FILL.dark : ANDROID_OVERLAY_MUTED_FILL.light;
  }

  return isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.05)';
}

export function getOverlayScrimColor(isDark: boolean) {
  if (Platform.OS === 'android') {
    return isDark ? ANDROID_OVERLAY_SCRIM.dark : ANDROID_OVERLAY_SCRIM.light;
  }

  return isDark ? 'rgba(12,12,18,0.10)' : 'rgba(255,255,255,0.04)';
}

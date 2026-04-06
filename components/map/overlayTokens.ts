import type { ViewStyle } from 'react-native';

export const mapOverlayTokens = {
  overlayRadius: 26,
  overlayCompactRadius: 20,
  overlayPadding: 16,
  overlayPaddingCompact: 12,
  overlayGap: 10,
  overlayCardGap: 12,
  overlayMinHeight: 40,
  controlHeight: 38,
  floatingButtonSize: 46,
  overlayBorderColor: {
    light: 'rgba(71,49,25,0.10)',
    dark: 'rgba(255,247,237,0.12)',
  },
  overlayShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.09,
    shadowRadius: 24,
    elevation: 5,
    borderCurve: 'continuous',
  } satisfies ViewStyle,
} as const;

export function getOverlayBorderColor(isDark: boolean) {
  return isDark ? mapOverlayTokens.overlayBorderColor.dark : mapOverlayTokens.overlayBorderColor.light;
}

export function getOverlayFallbackColor(isDark: boolean) {
  return isDark ? 'rgba(30,22,18,0.88)' : 'rgba(255,251,246,0.9)';
}

export function getOverlayMutedFillColor(isDark: boolean) {
  return isDark ? 'rgba(255,247,237,0.08)' : 'rgba(166,98,50,0.08)';
}

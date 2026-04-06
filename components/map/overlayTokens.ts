import type { ViewStyle } from 'react-native';

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
  overlayShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    borderCurve: 'continuous',
  } satisfies ViewStyle,
} as const;

export function getOverlayBorderColor(isDark: boolean) {
  return isDark ? mapOverlayTokens.overlayBorderColor.dark : mapOverlayTokens.overlayBorderColor.light;
}

export function getOverlayFallbackColor(isDark: boolean) {
  return isDark ? 'rgba(16,18,24,0.78)' : 'rgba(255,255,255,0.82)';
}

export function getOverlayMutedFillColor(isDark: boolean) {
  return isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.05)';
}

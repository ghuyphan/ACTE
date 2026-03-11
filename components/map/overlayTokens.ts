import type { ViewStyle } from 'react-native';

export const mapOverlayTokens = {
  overlayRadius: 20,
  overlayPadding: 12,
  overlayGap: 10,
  overlayMinHeight: 42,
  overlayBorderColor: {
    light: 'rgba(0,0,0,0.08)',
    dark: 'rgba(255,255,255,0.16)',
  },
  overlayShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  } satisfies ViewStyle,
} as const;

export function getOverlayBorderColor(isDark: boolean) {
  return isDark ? mapOverlayTokens.overlayBorderColor.dark : mapOverlayTokens.overlayBorderColor.light;
}

export function getOverlayFallbackColor(isDark: boolean) {
  return isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.84)';
}

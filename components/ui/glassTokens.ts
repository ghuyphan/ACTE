import { Platform, StyleSheet, type ViewStyle } from 'react-native';
import { Shadows } from '../../constants/theme';

interface GlassSurfacePaletteOptions {
  isDark: boolean;
  borderColor?: string;
}

export const glassTokens = {
  borderWidth: StyleSheet.hairlineWidth,
  headerContainerRadius: 30,
  iconControlSize: 42,
  iconControlRadius: 21,
  compactControlHeight: 34,
  compactControlRadius: 17,
  pillControlHeight: 40,
  pillControlRadius: 20,
} as const;

export const glassContainerShadow: ViewStyle =
  Platform.OS === 'android'
    ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }
    : Shadows.floating;

export function getGlassSurfacePalette({
  isDark,
  borderColor,
}: GlassSurfacePaletteOptions) {
  return {
    fallbackSurfaceColor: isDark
      ? 'rgba(24,24,28,0.94)'
      : 'rgba(255,252,246,0.94)',
    fallbackControlBackgroundColor: isDark
      ? 'rgba(255,255,255,0.94)'
      : 'rgba(255,255,255,0.88)',
    controlBackgroundColor: isDark
      ? 'rgba(24,20,18,0.68)'
      : 'rgba(255,251,246,0.88)',
    controlBorderColor:
      borderColor ?? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(113,86,26,0.18)'),
    activeControlBackgroundColor: isDark
      ? 'rgba(255,247,232,0.14)'
      : 'rgba(109,95,74,0.10)',
    subtleControlBackgroundColor: isDark
      ? 'rgba(255,247,232,0.08)'
      : 'rgba(255,255,255,0.62)',
    subtleControlBorderColor: isDark
      ? 'rgba(255,255,255,0.12)'
      : 'rgba(113,86,26,0.12)',
    searchFieldBackgroundColor: isDark
      ? 'rgba(255,247,232,0.22)'
      : 'rgba(255,255,255,0.88)',
    searchFieldBorderColor: isDark
      ? 'rgba(255,255,255,0.08)'
      : 'rgba(113,86,26,0.10)',
    dockedBackdropColor: isDark
      ? 'rgba(18,13,10,0.22)'
      : 'rgba(255,251,244,0.24)',
  } as const;
}

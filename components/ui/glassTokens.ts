import { Platform, StyleSheet, type ViewStyle } from 'react-native';
import { Shadows } from '../../constants/theme';

interface GlassSurfacePaletteOptions {
  isDark: boolean;
  borderColor?: string;
  colors?: Partial<{
    card: string;
    surface: string;
    border: string;
    primarySoft: string;
    chromeSurface: string;
    chromeBorder: string;
    noticeSurface: string;
    noticeBorder: string;
    glassOverlaySurface: string;
    glassOverlayBorder: string;
    glassBackdrop: string;
    captureGlassFill: string;
    captureGlassBorder: string;
    captureCardBorder: string;
    androidTabShellMutedBackground: string;
    androidTabShellMutedBorder: string;
    androidTabShellSelectedBackground: string;
    androidTabShellSelectedBorder: string;
    androidTabShellScrim: string;
  }>;
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
  colors,
}: GlassSurfacePaletteOptions) {
  return {
    fallbackSurfaceColor: isDark
      ? colors?.glassBackdrop ?? colors?.surface ?? 'rgba(24,24,28,0.94)'
      : colors?.glassBackdrop ?? colors?.surface ?? 'rgba(255,252,246,0.94)',
    fallbackControlBackgroundColor: isDark
      ? colors?.glassOverlaySurface ??
        colors?.captureGlassFill ??
        colors?.androidTabShellSelectedBackground ??
        colors?.noticeSurface ??
        colors?.card ??
        'rgba(255,255,255,0.94)'
      : colors?.glassOverlaySurface ??
        colors?.captureGlassFill ??
        colors?.androidTabShellSelectedBackground ??
        colors?.noticeSurface ??
        colors?.card ??
        'rgba(255,255,255,0.88)',
    controlBackgroundColor: isDark
      ? colors?.glassOverlaySurface ?? colors?.captureGlassFill ?? colors?.androidTabShellMutedBackground ?? 'rgba(24,20,18,0.68)'
      : colors?.glassOverlaySurface ?? colors?.captureGlassFill ?? colors?.androidTabShellMutedBackground ?? 'rgba(255,251,246,0.88)',
    controlBorderColor:
      borderColor ??
      colors?.glassOverlayBorder ??
      colors?.captureGlassBorder ??
      colors?.androidTabShellMutedBorder ??
      colors?.border ??
      (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(113,86,26,0.18)'),
    activeControlBackgroundColor: isDark
      ? colors?.primarySoft ?? colors?.androidTabShellSelectedBackground ?? 'rgba(255,247,232,0.14)'
      : colors?.primarySoft ?? colors?.androidTabShellSelectedBackground ?? 'rgba(109,95,74,0.10)',
    subtleControlBackgroundColor: isDark
      ? colors?.chromeSurface ?? colors?.glassOverlaySurface ?? 'rgba(255,247,232,0.08)'
      : colors?.chromeSurface ?? colors?.glassOverlaySurface ?? 'rgba(255,255,255,0.62)',
    subtleControlBorderColor: isDark
      ? colors?.chromeBorder ?? colors?.glassOverlayBorder ?? 'rgba(255,255,255,0.12)'
      : colors?.chromeBorder ?? colors?.glassOverlayBorder ?? 'rgba(113,86,26,0.12)',
    searchFieldBackgroundColor: isDark
      ? colors?.noticeSurface ?? colors?.glassOverlaySurface ?? 'rgba(255,247,232,0.22)'
      : colors?.noticeSurface ?? colors?.glassOverlaySurface ?? 'rgba(255,255,255,0.88)',
    searchFieldBorderColor: isDark
      ? colors?.noticeBorder ?? colors?.glassOverlayBorder ?? 'rgba(255,255,255,0.08)'
      : colors?.noticeBorder ?? colors?.glassOverlayBorder ?? 'rgba(113,86,26,0.10)',
    dockedBackdropColor: isDark
      ? colors?.glassBackdrop ?? colors?.androidTabShellScrim ?? 'rgba(18,13,10,0.22)'
      : colors?.glassBackdrop ?? colors?.androidTabShellScrim ?? 'rgba(255,251,244,0.24)',
  } as const;
}

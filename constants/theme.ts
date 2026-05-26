/**
 * Design tokens for the Noto app.
 * Primary theme logic lives in hooks/useTheme.tsx — this file provides
 * supplementary constants (fonts, spacing, radii).
 */

import { Platform } from 'react-native';

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Radii = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  card: 28,      // Card corners
  pill: 999,     // Pill buttons
} as const;

export const Layout = {
  screenPadding: 20,
  floatingGap: 8,
  headerHeight: 60,
  buttonHeight: 56,
  iconBadge: 30,
  cardRadius: 60,
  pillRadius: 20,
} as const;

export const Shadows = {
  floating: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
  },
  button: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  androidChrome: {
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 10,
  },
} as const;

export const CaptureChrome = {
  shadowDark: '#000000',
  shutterContent: '#FFFFFF',
  stickerPastePopoverBackground: 'rgba(255, 250, 242, 0.96)',
  stickerPasteButtonText: '#FFFDFC',
  livePhotoBorder: {
    dark: 'rgba(255,255,255,0.14)',
    light: 'rgba(255,255,255,0.42)',
  },
  dualCaptureGuide: {
    lightBackground: 'rgba(255,248,239,0.92)',
    darkBackground: 'rgba(28,28,30,0.42)',
    lightBorder: 'rgba(255,255,255,0.72)',
    lightInactivePip: 'rgba(43,38,33,0.18)',
    darkInactivePip: 'rgba(255,247,232,0.3)',
    lightDivider: 'rgba(43,38,33,0.12)',
    darkDivider: 'rgba(255,247,232,0.22)',
  },
  cameraLensSelector: {
    lightBackground: 'rgba(18,18,20,0.52)',
    darkBackground: 'rgba(12,12,14,0.68)',
    lightBorder: 'rgba(255,255,255,0.18)',
    darkBorder: 'rgba(255,255,255,0.14)',
    lightInactiveBackground: 'rgba(255,255,255,0.06)',
    darkInactiveBackground: 'rgba(255,255,255,0.04)',
    lightActiveBackground: 'rgba(255,255,255,0.14)',
    darkActiveBackground: 'rgba(0,0,0,0.22)',
    inactiveText: 'rgba(255,253,252,0.92)',
  },
} as const;

export const PremiumNoteFinishChrome = {
  holoRainbowSweepColors: [
    'rgba(255,255,255,0.0)',
    'rgba(255,226,112,0.28)',
    'rgba(255,137,204,0.24)',
    'rgba(140,116,255,0.2)',
    'rgba(81,233,255,0.24)',
    'rgba(188,255,151,0.18)',
    'rgba(255,255,255,0.0)',
  ],
  holoSpectrumColors: [
    'rgba(255,0,0,0)',
    'rgba(255,112,112,0.18)',
    'rgba(255,188,94,0.24)',
    'rgba(255,244,125,0.26)',
    'rgba(156,255,160,0.22)',
    'rgba(90,223,255,0.24)',
    'rgba(148,129,255,0.26)',
    'rgba(255,118,216,0.22)',
    'rgba(255,255,255,0)',
  ],
  holoPrismRibbonColors: [
    'rgba(255,255,255,0.0)',
    'rgba(255,255,255,0.12)',
    'rgba(255,239,112,0.34)',
    'rgba(120,243,255,0.38)',
    'rgba(255,145,226,0.3)',
    'rgba(255,255,255,0.0)',
  ],
  holoSpectrumAccentColors: [
    'rgba(255,255,255,0)',
    'rgba(118,245,255,0.24)',
    'rgba(255,160,228,0.24)',
    'rgba(255,243,128,0.22)',
    'rgba(255,255,255,0)',
  ],
  holoSheenColors: [
    'rgba(255,255,255,0.0)',
    'rgba(255,255,255,0.02)',
    'rgba(255,255,255,0.22)',
    'rgba(255,255,255,0.55)',
    'rgba(255,255,255,0.68)',
    'rgba(255,255,255,0.55)',
    'rgba(255,255,255,0.22)',
    'rgba(255,255,255,0.0)',
  ],
  holoLeftRailColors: [
    'rgba(255,184,228,0.34)',
    'rgba(121,232,255,0.14)',
    'rgba(255,255,255,0.0)',
  ],
  holoRightRailColors: [
    'rgba(255,255,255,0.0)',
    'rgba(255,228,125,0.2)',
    'rgba(103,225,255,0.34)',
  ],
  edgeBorder: 'rgba(255,255,255,0.22)',
  rgbEdgeShadow: '#A36BFF',
  holoEdgeShadow: '#8AF6FF',
  chromeEdgeShadow: '#D2B8FF',
  sparkleBackground: 'rgba(255,255,255,0.92)',
  sparkleShadow: '#FFFFFF',
  interferenceLineBackground: 'rgba(255,255,255,0.85)',
  frameBloomBorder: 'rgba(255,250,236,0.52)',
  frameBloomShadow: '#FFF6C8',
  edgeGlowBorder: 'rgba(232,248,255,0.68)',
  edgeGlowShadow: '#BDEEFF',
  innerGlowBorder: 'rgba(255,255,255,0.3)',
} as const;

export const Sheet = {
  maxHeight: 680,
  ios: {
    horizontalPadding: 24,
    headerTopPadding: 24,
    headerBottomSpacing: 16,
    bottomPadding: 28,
    legacyCornerRadius: 10,
  },
  android: {
    horizontalPadding: 20,
    headerTopPadding: 20,
    headerBottomSpacing: 16,
    bottomPadding: 36,
    comfortBottomPadding: 12,
    floatingHorizontalInset: 12,
    radius: 28,
    handleWidth: 42,
    handleHeight: 4,
  },
} as const;

export const Typography = {
  screenTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    fontFamily: 'Noto Sans',
  },
  heroTitle: {
    fontSize: 48,
    fontWeight: '900' as const,
    letterSpacing: 2,
    fontFamily: 'Noto Sans',
  },
  heroSubtitle: {
    fontSize: 18,
    fontWeight: '500' as const,
    lineHeight: 26,
    fontFamily: 'Noto Sans',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Noto Sans',
  },
  button: {
    fontSize: 17,
    fontWeight: '700' as const,
    fontFamily: 'Noto Sans',
  },
  pill: {
    fontSize: 15,
    fontWeight: '600' as const,
    fontFamily: 'Noto Sans',
  },
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'Noto Sans',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'Noto Sans',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "'Noto Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
})!;

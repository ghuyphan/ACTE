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
  cardRadius: 40,
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
} as const;

export const Typography = {
  screenTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    fontFamily: 'System',
  },
  heroTitle: {
    fontSize: 48,
    fontWeight: '900' as const,
    letterSpacing: 2,
    fontFamily: 'System',
  },
  heroSubtitle: {
    fontSize: 18,
    fontWeight: '500' as const,
    lineHeight: 26,
    fontFamily: 'System',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'System',
  },
  button: {
    fontSize: 17,
    fontWeight: '700' as const,
    fontFamily: 'System',
  },
  pill: {
    fontSize: 15,
    fontWeight: '600' as const,
    fontFamily: 'System',
  },
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
})!;

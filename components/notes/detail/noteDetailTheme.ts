import type { ThemeColors } from '../../../hooks/useTheme';

export type NoteDetailColors = Pick<
  ThemeColors,
  'border' | 'card' | 'danger' | 'primary' | 'secondaryText' | 'text'
> &
  Partial<
    Pick<
      ThemeColors,
      | 'captureGlassColorScheme'
      | 'chromeBorder'
      | 'chromeSurface'
      | 'dangerSoft'
      | 'inverseText'
      | 'onPrimary'
      | 'success'
    >
  >;

export function getNoteDetailTheme(colors: NoteDetailColors) {
  const isDark = colors.captureGlassColorScheme === 'dark';

  return {
    actionSurface: colors.chromeSurface ?? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'),
    actionBorder: colors.chromeBorder ?? (isDark ? 'rgba(255,255,255,0.14)' : 'rgba(43,38,33,0.12)'),
    badgeSurface: colors.card,
    badgeBorder: colors.chromeBorder ?? (isDark ? 'rgba(255,255,255,0.14)' : 'rgba(43,38,33,0.12)'),
    destructiveSurface: colors.dangerSoft ?? (isDark ? 'rgba(255,69,58,0.16)' : 'rgba(255,59,48,0.1)'),
    favoriteTint: colors.dangerSoft ?? 'rgba(255, 85, 115, 0.16)',
    captionEditorSurface: isDark ? 'rgba(20,20,20,0.5)' : 'rgba(255,255,255,0.72)',
    captionEditorBorder: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.42)',
    popoverSurface: 'rgba(255,255,255,0.96)',
    popoverBorder: 'rgba(255,255,255,0.24)',
    popoverSecondaryText: 'rgba(28,28,30,0.6)',
    popoverButtonBackground: colors.onPrimary ?? '#1C1C1E',
    popoverButtonText: colors.inverseText ?? '#FFFFFF',
  } as const;
}

export type AppThemeType = 'default' | 'peach' | 'matcha' | 'berry' | 'cotton-candy';

export const DEFAULT_APP_THEME: AppThemeType = 'default';

export const APP_THEME_METADATA = {
  default: {
    labelKey: 'settings.default',
    labelFallback: 'Default',
  },
  peach: {
    labelKey: 'settings.peach',
    labelFallback: 'Peach Sorbet',
  },
  matcha: {
    labelKey: 'settings.matcha',
    labelFallback: 'Matcha Latte',
  },
  berry: {
    labelKey: 'settings.berry',
    labelFallback: 'Blueberry Dream',
  },
  'cotton-candy': {
    labelKey: 'settings.cottonCandy',
    labelFallback: 'Cotton Candy',
  },
} as const satisfies Record<AppThemeType, { labelKey: string; labelFallback: string }>;

export const APP_THEME_PREVIEW_COLORS = {
  default: ['#F3B6C6', '#F7E2A4'],
  peach: ['#F4C4A4', '#F7D7B5'],
  matcha: ['#BFD8A6', '#E3D9A7'],
  berry: ['#B6B1F2', '#F1B7C9'],
  'cotton-candy': ['#C9C2FF', '#F4B8D2'],
} as const satisfies Record<AppThemeType, readonly [string, string]>;

export const APP_THEME_VALUES = Object.keys(APP_THEME_METADATA) as AppThemeType[];

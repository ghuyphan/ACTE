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

export const APP_THEME_VALUES = Object.keys(APP_THEME_METADATA) as AppThemeType[];

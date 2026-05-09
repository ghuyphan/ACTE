import type { AppThemeType } from './appThemes';

type GradientPair = [string, string];
export type NoteColorTier = 'free' | 'plus';
export type NoteColorFinish = 'standard' | 'holo' | 'rgb' | 'chrome';
export type NoteColorStickerMotion = 'physics' | 'water';

export type NoteColorId =
  | 'sunset-coral'
  | 'marigold-glow'
  | 'peach-theme'
  | 'matcha-theme'
  | 'berry-theme'
  | 'cotton-candy-theme'
  | 'muted-rosewood'
  | 'peach-theme-light'
  | 'peach-theme-dark'
  | 'matcha-theme-light'
  | 'matcha-theme-dark'
  | 'berry-theme-light'
  | 'berry-theme-dark'
  | 'cotton-candy-theme-light'
  | 'cotton-candy-theme-dark'
  | 'jade-pop'
  | 'sky-blue'
  | 'tangerine-clay'
  | 'violet-bloom'
  | 'pool-teal'
  | 'periwinkle-ink'
  | 'olive-lime'
  | 'raspberry-dusk'
  | 'aurora-rgb'
  | 'holo-foil'
  | 'chrome-rare';

export type NoteColorPreset = {
  id: NoteColorId;
  card: GradientPair;
  darkCard?: GradientPair;
  tier?: NoteColorTier;
  finish?: NoteColorFinish;
  stickerMotion?: NoteColorStickerMotion;
};

export const NOTE_COLOR_PRESETS: NoteColorPreset[] = [
  { id: 'marigold-glow', card: ['#F6D365', '#FDA085'], darkCard: ['#F2C96F', '#F19A7A'] },
  { id: 'sunset-coral', card: ['#FF9A8B', '#FF6A88'] },
  { id: 'peach-theme', card: ['#FFD9C6', '#F6BCCB'] },
  { id: 'matcha-theme', card: ['#D8E9C1', '#BEE7D7'] },
  { id: 'berry-theme', card: ['#D9D3FF', '#F3CBE9'] },
  { id: 'cotton-candy-theme', card: ['#F8D7E2', '#D4C9FA'] },
  { id: 'muted-rosewood', card: ['#6B4C57', '#A57A84'] },
  { id: 'jade-pop', card: ['#84FAB0', '#8FD3F4'], darkCard: ['#65D28F', '#6FB6CB'] },
  { id: 'sky-blue', card: ['#A1C4FD', '#C2E9FB'], darkCard: ['#7EA7D8', '#8FCBE0'], stickerMotion: 'water' },
  { id: 'tangerine-clay', card: ['#FAD961', '#F76B1C'], darkCard: ['#DFAE45', '#C9652D'] },
  { id: 'pool-teal', card: ['#4FACFE', '#00F2FE'], darkCard: ['#3B91CF', '#2AC5D2'], stickerMotion: 'water' },
  { id: 'aurora-rgb', card: ['#5B5FFF', '#FF4FD8'], tier: 'plus', finish: 'rgb' },
  { id: 'holo-foil', card: ['#F5F1EA', '#DDE6F1'], tier: 'plus', finish: 'holo' },
  { id: 'chrome-rare', card: ['#5E6B88', '#D2A7FF'], tier: 'plus', finish: 'chrome' },
];

export const LEGACY_NOTE_COLOR_PRESETS: NoteColorPreset[] = [
  { id: 'peach-theme-light', card: ['#FFD9C6', '#F6BCCB'] },
  { id: 'peach-theme-dark', card: ['#F4C4A4', '#F0ADC2'] },
  { id: 'matcha-theme-light', card: ['#D8E9C1', '#BEE7D7'] },
  { id: 'matcha-theme-dark', card: ['#BFD8A6', '#A8D9C5'] },
  { id: 'berry-theme-light', card: ['#D9D3FF', '#F3CBE9'] },
  { id: 'berry-theme-dark', card: ['#C9C2FF', '#F0C0E7'] },
  { id: 'cotton-candy-theme-light', card: ['#F8D7E2', '#D4C9FA'] },
  { id: 'cotton-candy-theme-dark', card: ['#F1B7C9', '#C6BCFF'] },
  { id: 'sunset-coral', card: ['#FF9A8B', '#FF6A88'] },
  { id: 'violet-bloom', card: ['#A18CD1', '#FBC2EB'] },
  { id: 'periwinkle-ink', card: ['#8EC5FC', '#E0C3FC'], stickerMotion: 'water' },
  { id: 'olive-lime', card: ['#D4FC79', '#96E6A1'] },
  { id: 'raspberry-dusk', card: ['#FF758C', '#FF7EB3'] },
];

export const DEFAULT_NOTE_COLOR_ID: NoteColorId = 'marigold-glow';

export const NOTE_CARD_GRADIENTS: GradientPair[] = NOTE_COLOR_PRESETS.filter(
  (preset) => preset.tier !== 'plus'
).map((preset) => preset.card);
export const PREMIUM_NOTE_COLOR_IDS: NoteColorId[] = NOTE_COLOR_PRESETS.filter(
  (preset) => preset.tier === 'plus'
).map((preset) => preset.id);

export function getAppThemeCaptureNoteColorId(
  appTheme: AppThemeType,
): NoteColorId {
  if (appTheme === 'default') {
    return 'marigold-glow';
  }

  if (appTheme === 'peach') {
    return 'peach-theme';
  }

  if (appTheme === 'matcha') {
    return 'matcha-theme';
  }

  if (appTheme === 'berry') {
    return 'berry-theme';
  }

  return 'cotton-candy-theme';
}

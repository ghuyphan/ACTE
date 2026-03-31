type GradientPair = [string, string];
export type NoteColorTier = 'free' | 'plus';
export type NoteColorFinish = 'standard' | 'holo' | 'rgb' | 'chrome';
export type NoteColorStickerMotion = 'physics' | 'water';

export type NoteColorId =
  | 'sunset-coral'
  | 'marigold-glow'
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
  tier?: NoteColorTier;
  finish?: NoteColorFinish;
  stickerMotion?: NoteColorStickerMotion;
};

export const NOTE_COLOR_PRESETS: NoteColorPreset[] = [
  // Vibrant, soft, and modern gradients
  { id: 'sunset-coral', card: ['#FF9A8B', '#FF6A88'] },
  { id: 'marigold-glow', card: ['#F6D365', '#FDA085'] },
  { id: 'jade-pop', card: ['#84FAB0', '#8FD3F4'] }, // Added a slight blue hue for a modern pop
  { id: 'sky-blue', card: ['#A1C4FD', '#C2E9FB'], stickerMotion: 'water' },
  { id: 'tangerine-clay', card: ['#FAD961', '#F76B1C'] },
  { id: 'violet-bloom', card: ['#A18CD1', '#FBC2EB'] },
  { id: 'pool-teal', card: ['#4FACFE', '#00F2FE'], stickerMotion: 'water' },
  { id: 'periwinkle-ink', card: ['#8EC5FC', '#E0C3FC'], stickerMotion: 'water' },
  { id: 'olive-lime', card: ['#D4FC79', '#96E6A1'] },
  { id: 'raspberry-dusk', card: ['#FF758C', '#FF7EB3'] },
  { id: 'aurora-rgb', card: ['#5B5FFF', '#FF4FD8'], tier: 'plus', finish: 'rgb' },
  { id: 'holo-foil', card: ['#F5F1EA', '#DDE6F1'], tier: 'plus', finish: 'holo' },
  { id: 'chrome-rare', card: ['#5E6B88', '#D2A7FF'], tier: 'plus', finish: 'chrome' },
];

export const DEFAULT_NOTE_COLOR_ID: NoteColorId = 'marigold-glow';

export const NOTE_CARD_GRADIENTS: GradientPair[] = NOTE_COLOR_PRESETS.filter(
  (preset) => preset.tier !== 'plus'
).map((preset) => preset.card);
export const PREMIUM_NOTE_COLOR_IDS: NoteColorId[] = NOTE_COLOR_PRESETS.filter(
  (preset) => preset.tier === 'plus'
).map((preset) => preset.id);

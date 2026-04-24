import { Appearance } from 'react-native';
import type { AppThemeType } from '../constants/appThemes';
import {
  DEFAULT_NOTE_COLOR_ID,
  getAppThemeCaptureNoteColorId,
  LEGACY_NOTE_COLOR_PRESETS,
  NOTE_CARD_GRADIENTS,
  NOTE_COLOR_PRESETS,
  PREMIUM_NOTE_COLOR_IDS,
  NoteColorId,
  NoteColorFinish,
  NoteColorPreset,
  type NoteColorStickerMotion,
} from '../constants/noteColors';

type GradientPair = [string, string];
export type StickerMotionVariant = 'physics' | 'water';
export type NoteCardTextPalette = {
  color: string;
  shadowColor: string;
  placeholderColor: string;
};
export const APP_THEME_DEFAULT_NOTE_COLOR_ID = 'app-theme-default';

type NotePalette = {
  capture: GradientPair;
  card: GradientPair;
};

const DEFAULT_CAPTURE_GRADIENT: GradientPair = ['#F6D365', '#FDA085'];
const ALL_NOTE_COLOR_PRESETS = [...NOTE_COLOR_PRESETS, ...LEGACY_NOTE_COLOR_PRESETS];

const NOTE_COLOR_PRESET_MAP = new Map<NoteColorId, NoteColorPreset>(
  ALL_NOTE_COLOR_PRESETS.map((preset) => [preset.id, preset])
);

const EMOJI_NOTE_PALETTES: Record<string, NotePalette> = {
  '☕️': {
    capture: ['#D6C6B5', '#B79A7F'],
    card: ['#6B4F44', '#8A6A5F'],
  },
  '🧋': {
    capture: ['#D9CDBE', '#BEA08A'],
    card: ['#70574B', '#8E7263'],
  },
  '🍜': {
    capture: ['#D8C0AE', '#B98A6C'],
    card: ['#755144', '#966A59'],
  },
  '🍣': {
    capture: ['#DDC5CB', '#BF969F'],
    card: ['#70525E', '#916E79'],
  },
  '🍕': {
    capture: ['#D8C0A3', '#BC8F6C'],
    card: ['#734E42', '#956755'],
  },
  '🍔': {
    capture: ['#D8C5A8', '#B79A76'],
    card: ['#6B5741', '#89715B'],
  },
  '🍚': {
    capture: ['#DDD1B0', '#C1AA7E'],
    card: ['#675741', '#837056'],
  },
  '🍰': {
    capture: ['#E1CDD1', '#C09AA3'],
    card: ['#71555F', '#90707B'],
  },
  '🧁': {
    capture: ['#E5C9D0', '#C999A8'],
    card: ['#745260', '#936C7B'],
  },
  '🎉': {
    capture: ['#E5C8B9', '#C99887'],
    card: ['#76514D', '#986B62'],
  },
  '🧄': {
    capture: ['#E0D7BE', '#BEAA82'],
    card: ['#6B5946', '#88735D'],
  },
  '🧅': {
    capture: ['#DED1D5', '#BA9CA6'],
    card: ['#6A5560', '#86717B'],
  },
  '🌶️': {
    capture: ['#DABAB1', '#B98379'],
    card: ['#704C49', '#915F5C'],
  },
  '🍸': {
    capture: ['#D7CCD9', '#B29EB8'],
    card: ['#5E566A', '#7C718B'],
  },
  '👯': {
    capture: ['#E0C9D8', '#BE95B1'],
    card: ['#705066', '#906A83'],
  },
  '🧘': {
    capture: ['#D7D8C9', '#ACB49B'],
    card: ['#56604F', '#748069'],
  },
  '🌿': {
    capture: ['#D4D9C8', '#AAB69A'],
    card: ['#4F5F52', '#6E836F'],
  },
  '🌊': {
    capture: ['#C9DDE0', '#91B7BE'],
    card: ['#49636C', '#6C8790'],
  },
  '🏃': {
    capture: ['#D6D8C0', '#B0B58A'],
    card: ['#5B6048', '#79805F'],
  },
  '🏖️': {
    capture: ['#D1DADF', '#9EB0B7'],
    card: ['#4F6268', '#70868E'],
  },
  '🌆': {
    capture: ['#D4D3DF', '#A4ABB9'],
    card: ['#535F70', '#748195'],
  },
  '🏙️': {
    capture: ['#D1D5E0', '#A2AEBD'],
    card: ['#54616F', '#748395'],
  },
  '🏛️': {
    capture: ['#DDD2C2', '#BCA789'],
    card: ['#655842', '#857458'],
  },
  '🧠': {
    capture: ['#D4CDE1', '#A79BC0'],
    card: ['#56576D', '#767491'],
  },
  '📚': {
    capture: ['#D5D1DE', '#AAA1BC'],
    card: ['#5A5967', '#78768A'],
  },
  '🎨': {
    capture: ['#DCC8C1', '#BC9687'],
    card: ['#70564D', '#8F7367'],
  },
  '🎧': {
    capture: ['#CDD3E1', '#9BA7C0'],
    card: ['#515B72', '#717B95'],
  },
  '🎬': {
    capture: ['#D3D0D8', '#A9A1B3'],
    card: ['#5A5667', '#797289'],
  },
  '🎮': {
    capture: ['#CED5E1', '#9AAABF'],
    card: ['#4F6070', '#718292'],
  },
  '🛍️': {
    capture: ['#E0C9C5', '#BE978F'],
    card: ['#70524D', '#906F67'],
  },
  '💅': {
    capture: ['#E2C7D1', '#C194A8'],
    card: ['#725364', '#916D7F'],
  },
  '🏡': {
    capture: ['#DED1BF', '#BAA185'],
    card: ['#675444', '#86705A'],
  },
  '🛌': {
    capture: ['#D7D1DE', '#A99FBB'],
    card: ['#5A586A', '#78748C'],
  },
  '✈️': {
    capture: ['#CAD9E1', '#96B0BF'],
    card: ['#4D6170', '#6E8295'],
  },
  '🚗': {
    capture: ['#D3D5CE', '#A9ADA0'],
    card: ['#565E5B', '#76807A'],
  },
  '🚇': {
    capture: ['#D6D0C9', '#AD9F91'],
    card: ['#5F564F', '#80746B'],
  },
  '🌙': {
    capture: ['#CBCFDE', '#9DA5BE'],
    card: ['#4D5870', '#6D7893'],
  },
  '🌅': {
    capture: ['#E0C6B8', '#BF9580'],
    card: ['#755044', '#956C5A'],
  },
  '🌃': {
    capture: ['#C8D0DE', '#99A5BD'],
    card: ['#46546E', '#657593'],
  },
  '🌧️': {
    capture: ['#CCD8DD', '#9DB1B9'],
    card: ['#4E626B', '#6F838C'],
  },
  '💖': {
    capture: ['#E3C7CD', '#C3929F'],
    card: ['#74515F', '#946B7B'],
  },
  '🤍': {
    capture: ['#E0D2D1', '#BDA3A7'],
    card: ['#6E5960', '#8E767E'],
  },
  '✨': {
    capture: ['#DED2B6', '#BCA37A'],
    card: ['#6D5841', '#89705A'],
  },
};

function hashToIndex(str: string, max: number): number {
  let hash = 0;
  for (let index = 0; index < str.length; index += 1) {
    hash = (hash * 31 + str.charCodeAt(index)) % max;
  }

  return Math.abs(hash) % max;
}

function clamp(value: number, minValue: number, maxValue: number) {
  return Math.min(maxValue, Math.max(minValue, value));
}

function hashToUnit(str: string): number {
  let hash = 0;
  for (let index = 0; index < str.length; index += 1) {
    hash = (hash * 131 + str.charCodeAt(index)) % 1009;
  }

  return (Math.abs(hash) % 1000) / 999;
}

function resolvePaletteEmoji(text: string, emoji?: string | null) {
  const trimmedEmoji = typeof emoji === 'string' ? emoji.trim() : '';
  if (trimmedEmoji && EMOJI_NOTE_PALETTES[trimmedEmoji]) {
    return trimmedEmoji;
  }

  const safeText = typeof text === 'string' ? text : '';
  return Object.keys(EMOJI_NOTE_PALETTES).find((candidate) => safeText.includes(candidate)) ?? null;
}

function hexToRgb(value: string) {
  const normalized = value.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);

  return {
    red: Number.isFinite(red) ? red : 0,
    green: Number.isFinite(green) ? green : 0,
    blue: Number.isFinite(blue) ? blue : 0,
  };
}

function rgbToHsl(red: number, green: number, blue: number) {
  const normalizedRed = red / 255;
  const normalizedGreen = green / 255;
  const normalizedBlue = blue / 255;
  const max = Math.max(normalizedRed, normalizedGreen, normalizedBlue);
  const min = Math.min(normalizedRed, normalizedGreen, normalizedBlue);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) {
    return { hue: 0, saturation: 0, lightness };
  }

  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue = 0;
  switch (max) {
    case normalizedRed:
      hue = (normalizedGreen - normalizedBlue) / delta + (normalizedGreen < normalizedBlue ? 6 : 0);
      break;
    case normalizedGreen:
      hue = (normalizedBlue - normalizedRed) / delta + 2;
      break;
    default:
      hue = (normalizedRed - normalizedGreen) / delta + 4;
      break;
  }

  return {
    hue: hue * 60,
    saturation,
    lightness,
  };
}

function getWaterColorScore(color: string) {
  const { red, green, blue } = hexToRgb(color);
  const { hue, saturation, lightness } = rgbToHsl(red, green, blue);
  const hueDistance = Math.min(Math.abs(hue - 205), 360 - Math.abs(hue - 205));
  const hueScore = clamp(1 - hueDistance / 55, 0, 1);
  const coolBias = clamp(((blue + green * 0.45) - red) / 135, 0, 1);
  const softLightness = 1 - Math.abs(lightness - 0.72) / 0.38;

  return hueScore * 0.58 + saturation * 0.17 + coolBias * 0.17 + clamp(softLightness, 0, 1) * 0.08;
}

function mixChannel(source: number, target: number, amount: number) {
  return Math.round(source + (target - source) * amount);
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

function srgbChannelToLinear(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function getRelativeLuminance(color: string) {
  const { red, green, blue } = hexToRgb(color);
  const linearRed = srgbChannelToLinear(red);
  const linearGreen = srgbChannelToLinear(green);
  const linearBlue = srgbChannelToLinear(blue);

  return linearRed * 0.2126 + linearGreen * 0.7152 + linearBlue * 0.0722;
}

function getContrastRatio(foreground: string, background: string) {
  const foregroundLuminance = getRelativeLuminance(foreground);
  const backgroundLuminance = getRelativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function softenGradientColor(color: string, amount: number) {
  const { red, green, blue } = hexToRgb(color);
  return rgbToHex(
    mixChannel(red, 255, amount),
    mixChannel(green, 244, amount),
    mixChannel(blue, 232, amount)
  );
}

function blendGradientColor(base: string, accent: string, amount: number) {
  const baseRgb = hexToRgb(base);
  const accentRgb = hexToRgb(accent);

  return rgbToHex(
    mixChannel(baseRgb.red, accentRgb.red, amount),
    mixChannel(baseRgb.green, accentRgb.green, amount),
    mixChannel(baseRgb.blue, accentRgb.blue, amount)
  );
}

function blendGradients(base: GradientPair, accent: GradientPair, amount: number): GradientPair {
  return [
    blendGradientColor(base[0], accent[0], amount),
    blendGradientColor(base[1], accent[1], amount),
  ];
}

const GRADIENT_VARIANT_ACCENTS: string[] = [
  '#CFC1AE',
  '#C5B2A6',
  '#A9B7AC',
  '#AAB6C3',
  '#B6AEBE',
  '#B5B89B',
  '#C2AEB5',
  '#AAB8B9',
];

function createGradientVariation(base: GradientPair, seed: string): GradientPair {
  const accentIndex = hashToIndex(`${seed}:accent`, GRADIENT_VARIANT_ACCENTS.length);
  const accentColor = GRADIENT_VARIANT_ACCENTS[accentIndex] ?? GRADIENT_VARIANT_ACCENTS[0];
  const blendAmount = 0.03 + hashToUnit(`${seed}:amount`) * 0.06;
  const softenedStart = softenGradientColor(base[0], 0.02 + hashToUnit(`${seed}:soft-start`) * 0.04);
  const softenedEnd = softenGradientColor(base[1], 0.01 + hashToUnit(`${seed}:soft-end`) * 0.03);
  const variedGradient = blendGradients([softenedStart, softenedEnd], [accentColor, accentColor], blendAmount);

  return hashToUnit(`${seed}:reverse`) > 0.56
    ? [variedGradient[1], variedGradient[0]]
    : variedGradient;
}

function getBaseGradientSeed(text: string, noteId?: string) {
  const safeSeed = (typeof noteId === 'string' && noteId.trim()) || (typeof text === 'string' ? text.trim() : '');
  const gradientIndex = hashToIndex(safeSeed || 'noto', NOTE_CARD_GRADIENTS.length);
  return NOTE_CARD_GRADIENTS[gradientIndex] ?? DEFAULT_CAPTURE_GRADIENT;
}

export { DEFAULT_NOTE_COLOR_ID, NOTE_COLOR_PRESETS };
export { PREMIUM_NOTE_COLOR_IDS };
export { getAppThemeCaptureNoteColorId };
export type { NoteColorFinish, NoteColorId, NoteColorPreset };

function isAdaptiveThemeFamilyNoteColor(noteColor?: string | null) {
  return noteColor === 'peach-theme'
    || noteColor === 'matcha-theme'
    || noteColor === 'berry-theme'
    || noteColor === 'cotton-candy-theme';
}

function normalizeAdaptiveThemeNoteColor(noteColor?: string | null): NoteColorId | null {
  switch (noteColor) {
    case 'peach-theme':
    case 'peach-theme-light':
    case 'peach-theme-dark':
      return 'peach-theme';
    case 'matcha-theme':
    case 'matcha-theme-light':
    case 'matcha-theme-dark':
      return 'matcha-theme';
    case 'berry-theme':
    case 'berry-theme-light':
    case 'berry-theme-dark':
      return 'berry-theme';
    case 'cotton-candy-theme':
    case 'cotton-candy-theme-light':
    case 'cotton-candy-theme-dark':
      return 'cotton-candy-theme';
    default:
      return null;
  }
}

function resolveDynamicThemeColorScheme(colorScheme?: 'light' | 'dark') {
  if (colorScheme) {
    return colorScheme;
  }

  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

export function resolveConcreteThemeNoteColorId(
  noteColor?: string | null,
  colorScheme?: 'light' | 'dark'
): NoteColorId | null {
  const resolvedColorScheme = resolveDynamicThemeColorScheme(colorScheme);

  switch (noteColor) {
    case 'peach-theme':
      return resolvedColorScheme === 'dark' ? 'peach-theme-dark' : 'peach-theme-light';
    case 'peach-theme-light':
    case 'peach-theme-dark':
      return noteColor;
    case 'matcha-theme':
      return resolvedColorScheme === 'dark' ? 'matcha-theme-dark' : 'matcha-theme-light';
    case 'matcha-theme-light':
    case 'matcha-theme-dark':
      return noteColor;
    case 'berry-theme':
      return resolvedColorScheme === 'dark' ? 'berry-theme-dark' : 'berry-theme-light';
    case 'berry-theme-light':
    case 'berry-theme-dark':
      return noteColor;
    case 'cotton-candy-theme':
      return resolvedColorScheme === 'dark' ? 'cotton-candy-theme-dark' : 'cotton-candy-theme-light';
    case 'cotton-candy-theme-light':
    case 'cotton-candy-theme-dark':
      return noteColor;
    default:
      return null;
  }
}

export function getPickerNoteColorId(noteColor?: string | null): NoteColorId | null {
  return normalizeAdaptiveThemeNoteColor(noteColor) ?? getNoteColorPreset(noteColor)?.id ?? null;
}

function getAdaptiveThemeGradient(
  noteColor?: string | null,
  colorScheme?: 'light' | 'dark'
): GradientPair | null {
  const concreteThemeColorId = resolveConcreteThemeNoteColorId(noteColor, colorScheme);
  if (!concreteThemeColorId) {
    return null;
  }

  return getNoteColorPreset(concreteThemeColorId)?.card ?? null;
}

export function getNoteColorPreset(noteColor?: string | null) {
  if (!noteColor) {
    return null;
  }

  return NOTE_COLOR_PRESET_MAP.get(noteColor as NoteColorId) ?? null;
}

export function getNoteColorFinish(noteColor?: string | null): NoteColorFinish {
  return getNoteColorPreset(noteColor)?.finish ?? 'standard';
}

export function isPremiumNoteColor(noteColor?: string | null) {
  return getNoteColorPreset(noteColor)?.tier === 'plus';
}

export function getNoteColorCardGradient(
  noteColor?: string | null,
  options?: { colorScheme?: 'light' | 'dark' }
): GradientPair | null {
  if (isAdaptiveThemeFamilyNoteColor(noteColor)) {
    const adaptiveGradient = getAdaptiveThemeGradient(noteColor, options?.colorScheme);
    if (adaptiveGradient) {
      return adaptiveGradient;
    }
  }

  return getNoteColorPreset(noteColor)?.card ?? null;
}

export function getNoteColorStickerMotion(noteColor?: string | null): NoteColorStickerMotion | null {
  return getNoteColorPreset(noteColor)?.stickerMotion ?? null;
}

export function isAppThemeDefaultNoteColor(noteColor?: string | null) {
  return noteColor === APP_THEME_DEFAULT_NOTE_COLOR_ID;
}

export function normalizeSavedTextNoteColor(noteColor?: string | null): NoteColorId {
  return resolveConcreteThemeNoteColorId(noteColor) ?? getNoteColorPreset(noteColor)?.id ?? DEFAULT_NOTE_COLOR_ID;
}

export function resolveSavedTextNoteColor(
  noteColor?: string | null,
  options?: { appTheme?: AppThemeType; colorScheme?: 'light' | 'dark' }
): string {
  if (noteColor == null || isAppThemeDefaultNoteColor(noteColor)) {
    if (options?.appTheme) {
      const appThemeColorId = getAppThemeCaptureNoteColorId(options.appTheme);
      return resolveConcreteThemeNoteColorId(appThemeColorId, options.colorScheme) ?? appThemeColorId;
    }

    return APP_THEME_DEFAULT_NOTE_COLOR_ID;
  }

  return normalizeSavedTextNoteColor(noteColor);
}

export function getEditableTextNoteColor(noteColor?: string | null): string | null {
  if (noteColor == null || isAppThemeDefaultNoteColor(noteColor)) {
    return null;
  }

  return normalizeSavedTextNoteColor(noteColor);
}

export function getCaptureNoteGradient(options?: {
  emoji?: string | null;
  text?: string;
  noteColor?: string | null;
  fallbackGradient?: readonly [string, string] | null;
  colorScheme?: 'light' | 'dark';
}): GradientPair {
  const selectedGradient = getNoteColorCardGradient(options?.noteColor, {
    colorScheme: options?.colorScheme,
  });
  if (selectedGradient) {
    return selectedGradient;
  }

  if (options?.fallbackGradient) {
    return [options.fallbackGradient[0], options.fallbackGradient[1]];
  }

  return DEFAULT_CAPTURE_GRADIENT;
}

export function getGradientStickerMotionVariant(
  gradient: readonly [string, string]
): StickerMotionVariant {
  const averageScore =
    gradient.reduce((total, color) => total + getWaterColorScore(color), 0) / gradient.length;
  const bothStopsFeelWatery = gradient.every((color) => getWaterColorScore(color) >= 0.48);

  return averageScore >= 0.53 || bothStopsFeelWatery ? 'water' : 'physics';
}

export function getTextNoteCardGradient(options: {
  text: string;
  noteId?: string;
  emoji?: string | null;
  noteColor?: string | null;
  fallbackGradient?: readonly [string, string] | null;
  colorScheme?: 'light' | 'dark';
}): GradientPair {
  const selectedGradient = getNoteColorCardGradient(options.noteColor, {
    colorScheme: options.colorScheme,
  });
  if (selectedGradient) {
    return selectedGradient;
  }

  if (isAppThemeDefaultNoteColor(options.noteColor)) {
    if (options.fallbackGradient) {
      return [options.fallbackGradient[0], options.fallbackGradient[1]];
    }

    return DEFAULT_CAPTURE_GRADIENT;
  }

  const baseGradient = getBaseGradientSeed(options.text, options.noteId);
  const paletteEmoji = resolvePaletteEmoji(options.text, options.emoji);
  const blendedGradient = paletteEmoji
    ? blendGradients(baseGradient, EMOJI_NOTE_PALETTES[paletteEmoji].card, 0.24)
    : baseGradient;

  return createGradientVariation(
    blendedGradient,
    `${options.noteId ?? options.text}:${options.emoji ?? ''}`
  );
}

const NOTE_CARD_TEXT_LIGHT = '#FFF7E8';
const NOTE_CARD_TEXT_DARK = '#2B2621';

export function getNoteCardTextPalette(
  gradient: readonly [string, string]
): NoteCardTextPalette {
  const candidates: NoteCardTextPalette[] = [
    {
      color: NOTE_CARD_TEXT_LIGHT,
      shadowColor: 'rgba(0,0,0,0.24)',
      placeholderColor: 'rgba(255,247,232,0.56)',
    },
    {
      color: NOTE_CARD_TEXT_DARK,
      shadowColor: 'rgba(0,0,0,0.08)',
      placeholderColor: 'rgba(43,38,33,0.42)',
    },
  ];

  return candidates.reduce<NoteCardTextPalette>((bestCandidate, candidate) => {
    const bestScore = Math.min(
      ...gradient.map((backgroundColor) => getContrastRatio(bestCandidate.color, backgroundColor))
    );
    const candidateScore = Math.min(
      ...gradient.map((backgroundColor) => getContrastRatio(candidate.color, backgroundColor))
    );

    return candidateScore > bestScore ? candidate : bestCandidate;
  }, candidates[0]);
}

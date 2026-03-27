import {
  DEFAULT_NOTE_COLOR_ID,
  NOTE_CARD_GRADIENTS,
  NOTE_COLOR_PRESETS,
  PREMIUM_NOTE_COLOR_IDS,
  NoteColorId,
  NoteColorFinish,
  NoteColorPreset,
} from '../constants/noteColors';

type GradientPair = [string, string];

type NotePalette = {
  capture: GradientPair;
  card: GradientPair;
};

const DEFAULT_CAPTURE_GRADIENT: GradientPair = ['#D8C9B5', '#BCA48A'];

const NOTE_COLOR_PRESET_MAP = new Map<NoteColorId, NoteColorPreset>(
  NOTE_COLOR_PRESETS.map((preset) => [preset.id, preset])
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
  '🌿': {
    capture: ['#D4D9C8', '#AAB69A'],
    card: ['#4F5F52', '#6E836F'],
  },
  '🏃': {
    capture: ['#D6D8C0', '#B0B58A'],
    card: ['#5B6048', '#79805F'],
  },
  '🏖️': {
    capture: ['#D1DADF', '#9EB0B7'],
    card: ['#4F6268', '#70868E'],
  },
  '🏙️': {
    capture: ['#D1D5E0', '#A2AEBD'],
    card: ['#54616F', '#748395'],
  },
  '📚': {
    capture: ['#D5D1DE', '#AAA1BC'],
    card: ['#5A5967', '#78768A'],
  },
  '🎨': {
    capture: ['#DCC8C1', '#BC9687'],
    card: ['#70564D', '#8F7367'],
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

function mixChannel(source: number, target: number, amount: number) {
  return Math.round(source + (target - source) * amount);
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
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
export type { NoteColorFinish, NoteColorId, NoteColorPreset };

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

export function getNoteColorCardGradient(noteColor?: string | null): GradientPair | null {
  return getNoteColorPreset(noteColor)?.card ?? null;
}

export function normalizeSavedTextNoteColor(noteColor?: string | null): NoteColorId {
  return getNoteColorPreset(noteColor)?.id ?? DEFAULT_NOTE_COLOR_ID;
}

export function getCaptureNoteGradient(options?: {
  emoji?: string | null;
  text?: string;
  noteColor?: string | null;
}): GradientPair {
  const selectedGradient = getNoteColorCardGradient(options?.noteColor);
  if (selectedGradient) {
    return selectedGradient;
  }

  return DEFAULT_CAPTURE_GRADIENT;
}

export function getTextNoteCardGradient(options: {
  text: string;
  noteId?: string;
  emoji?: string | null;
  noteColor?: string | null;
}): GradientPair {
  const selectedGradient = getNoteColorCardGradient(options.noteColor);
  if (selectedGradient) {
    return selectedGradient;
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

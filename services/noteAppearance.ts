import { CardGradients } from '../hooks/useTheme';

type GradientPair = [string, string];

type NotePalette = {
  capture: GradientPair;
  card: GradientPair;
};

const DEFAULT_CAPTURE_GRADIENT: GradientPair = ['#E9C97E', '#D7A24D'];

const EMOJI_NOTE_PALETTES: Record<string, NotePalette> = {
  '☕️': {
    capture: ['#F1CF9A', '#D59659'],
    card: ['#7A402A', '#CC6E4C'],
  },
  '🧋': {
    capture: ['#F0D3B4', '#D49A74'],
    card: ['#84523A', '#D08A66'],
  },
  '🍜': {
    capture: ['#F5C89A', '#E9864E'],
    card: ['#8B3D24', '#E1653B'],
  },
  '🍣': {
    capture: ['#F5CCD4', '#E792A5'],
    card: ['#7A3655', '#D86A93'],
  },
  '🍕': {
    capture: ['#F6CB80', '#E88A46'],
    card: ['#8A3B22', '#DA6333'],
  },
  '🍔': {
    capture: ['#EFCA8E', '#D58B51'],
    card: ['#70512D', '#BF7A38'],
  },
  '🍚': {
    capture: ['#EFDCAC', '#DDB46A'],
    card: ['#6E5930', '#C49C45'],
  },
  '🍰': {
    capture: ['#F7D6DF', '#EB9EB8'],
    card: ['#854766', '#D87EA9'],
  },
  '🧄': {
    capture: ['#F3E7BE', '#E0BF73'],
    card: ['#72583A', '#BD9348'],
  },
  '🧅': {
    capture: ['#EEDBE0', '#D4A0B2'],
    card: ['#744666', '#B773A0'],
  },
  '🌶️': {
    capture: ['#F7B09E', '#EE6251'],
    card: ['#84292D', '#E1444D'],
  },
  '🍸': {
    capture: ['#E1D0E4', '#B693C2'],
    card: ['#5E477C', '#A273D3'],
  },
  '🌿': {
    capture: ['#D9E8C7', '#9CC680'],
    card: ['#2D6A51', '#5BB586'],
  },
  '🏃': {
    capture: ['#DCE7BF', '#A7C567'],
    card: ['#556229', '#95B83F'],
  },
  '🏖️': {
    capture: ['#D8EEF2', '#7CC9D4'],
    card: ['#23687A', '#4DBED0'],
  },
  '🏙️': {
    capture: ['#D7DDF3', '#98AEDB'],
    card: ['#355C88', '#6694E8'],
  },
  '📚': {
    capture: ['#E1D8F0', '#B39FD8'],
    card: ['#514D82', '#887EE0'],
  },
  '🎨': {
    capture: ['#F0D0C7', '#DE9577'],
    card: ['#8B4A37', '#DA7B56'],
  },
  '🤍': {
    capture: ['#F6DCDB', '#E6A2AF'],
    card: ['#8A4A6A', '#DB86AB'],
  },
  '✨': {
    capture: ['#F2DEB0', '#E1B95E'],
    card: ['#7A5725', '#D9A63E'],
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
  '#E8C27B',
  '#F0A98D',
  '#7FD0B6',
  '#80B3F2',
  '#B6A0E6',
  '#D4D97C',
  '#F1B6D2',
  '#9ED8E0',
];

function createGradientVariation(base: GradientPair, seed: string): GradientPair {
  const accentIndex = hashToIndex(`${seed}:accent`, GRADIENT_VARIANT_ACCENTS.length);
  const accentColor = GRADIENT_VARIANT_ACCENTS[accentIndex] ?? GRADIENT_VARIANT_ACCENTS[0];
  const blendAmount = 0.08 + hashToUnit(`${seed}:amount`) * 0.14;
  const softenedStart = softenGradientColor(base[0], 0.03 + hashToUnit(`${seed}:soft-start`) * 0.08);
  const softenedEnd = softenGradientColor(base[1], 0.01 + hashToUnit(`${seed}:soft-end`) * 0.05);
  const variedGradient = blendGradients([softenedStart, softenedEnd], [accentColor, accentColor], blendAmount);

  return hashToUnit(`${seed}:reverse`) > 0.56
    ? [variedGradient[1], variedGradient[0]]
    : variedGradient;
}

function getBaseGradientSeed(text: string, noteId?: string) {
  const safeSeed = (typeof noteId === 'string' && noteId.trim()) || (typeof text === 'string' ? text.trim() : '');
  const gradientIndex = hashToIndex(safeSeed || 'noto', CardGradients.length);
  return CardGradients[gradientIndex] ?? DEFAULT_CAPTURE_GRADIENT;
}

function deriveCaptureGradientFromCard(gradient: GradientPair): GradientPair {
  return [
    softenGradientColor(gradient[0], 0.66),
    softenGradientColor(gradient[1], 0.4),
  ];
}

export function getCaptureNoteGradient(options?: {
  emoji?: string | null;
  text?: string;
}): GradientPair {
  void options;
  return DEFAULT_CAPTURE_GRADIENT;
}

export function getTextNoteCardGradient(options: {
  text: string;
  noteId?: string;
  emoji?: string | null;
}): GradientPair {
  const baseGradient = getBaseGradientSeed(options.text, options.noteId);
  const paletteEmoji = resolvePaletteEmoji(options.text, options.emoji);
  const blendedGradient = paletteEmoji
    ? blendGradients(baseGradient, EMOJI_NOTE_PALETTES[paletteEmoji].card, 0.42)
    : baseGradient;

  return createGradientVariation(
    blendedGradient,
    `${options.noteId ?? options.text}:${options.emoji ?? ''}`
  );
}

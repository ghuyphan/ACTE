import { CardGradients } from '../hooks/useTheme';

type GradientPair = [string, string];

type NotePalette = {
  capture: GradientPair;
  card: GradientPair;
};

const DEFAULT_CAPTURE_GRADIENT: GradientPair = ['#E9C97E', '#D7A24D'];

const EMOJI_NOTE_PALETTES: Record<string, NotePalette> = {
  '☕️': {
    capture: ['#E8C791', '#C8925B'],
    card: ['#5C4638', '#8D6A54'],
  },
  '🧋': {
    capture: ['#E8D0B1', '#C79B7B'],
    card: ['#6F5240', '#AE8060'],
  },
  '🍜': {
    capture: ['#F0C6A0', '#DE935C'],
    card: ['#714637', '#B56742'],
  },
  '🍣': {
    capture: ['#F0C8CE', '#DE9BA5'],
    card: ['#69434B', '#A76C76'],
  },
  '🍕': {
    capture: ['#F1C88A', '#D9854A'],
    card: ['#6B4736', '#AD6942'],
  },
  '🍔': {
    capture: ['#EAC690', '#C88A55'],
    card: ['#674635', '#A76F47'],
  },
  '🍚': {
    capture: ['#E7D4A7', '#D0AE67'],
    card: ['#6C573E', '#A98A59'],
  },
  '🍰': {
    capture: ['#F1D1D9', '#E2A9B6'],
    card: ['#6C4D58', '#A87A88'],
  },
  '🧄': {
    capture: ['#EFE3BF', '#D7BD7A'],
    card: ['#66563C', '#A48A57'],
  },
  '🧅': {
    capture: ['#E8D6DA', '#CAA4AC'],
    card: ['#5F4951', '#92727B'],
  },
  '🌶️': {
    capture: ['#F0B4A4', '#DC725C'],
    card: ['#6C3832', '#B55046'],
  },
  '🍸': {
    capture: ['#D7C8D9', '#A98EB0'],
    card: ['#594B63', '#8A7897'],
  },
  '🌿': {
    capture: ['#D5E4C8', '#A4BE8D'],
    card: ['#46584E', '#748C7B'],
  },
  '🏃': {
    capture: ['#D7E2C3', '#9CAF74'],
    card: ['#505B42', '#87946E'],
  },
  '🏖️': {
    capture: ['#D8E6E8', '#94C0C7'],
    card: ['#3F5560', '#6F8A94'],
  },
  '🏙️': {
    capture: ['#D6DCE6', '#A2B1C8'],
    card: ['#495D72', '#7C93AF'],
  },
  '📚': {
    capture: ['#DAD3E6', '#AC9FCA'],
    card: ['#5D5B6A', '#8F8DA1'],
  },
  '🎨': {
    capture: ['#E4D1C7', '#C99884'],
    card: ['#775844', '#B28A68'],
  },
  '🤍': {
    capture: ['#F0D8D7', '#DBA7A1'],
    card: ['#6B4C57', '#A57A84'],
  },
  '✨': {
    capture: ['#E8D8B7', '#D3AE63'],
    card: ['#775844', '#B28A68'],
  },
};

function hashToIndex(str: string, max: number): number {
  let hash = 0;
  for (let index = 0; index < str.length; index += 1) {
    hash = (hash * 31 + str.charCodeAt(index)) % max;
  }

  return Math.abs(hash) % max;
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
  if (paletteEmoji) {
    return blendGradients(baseGradient, EMOJI_NOTE_PALETTES[paletteEmoji].card, 0.36);
  }

  return baseGradient;
}

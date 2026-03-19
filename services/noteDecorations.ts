import type { NoteType } from './database';

function normalize(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function padNormalized(value: string) {
  return value ? ` ${value} ` : ' ';
}

function containsKeyword(paddedText: string, keyword: string) {
  return paddedText.includes(` ${keyword} `);
}

type EmojiRule = {
  emoji: string;
  keywords: string[];
  score?: number;
};

const EMOJI_RULES: EmojiRule[] = [
  {
    emoji: '☕️',
    keywords: [
      'coffee',
      'cafe',
      'ca phe',
      'caphe',
      'espresso',
      'latte',
      'americano',
      'cold brew',
      'brew',
      'roastery',
      'brunch',
    ],
    score: 3,
  },
  {
    emoji: '🧋',
    keywords: ['milk tea', 'tra sua', 'boba', 'bubble tea', 'matcha', 'tea', 'hong tra'],
    score: 3,
  },
  {
    emoji: '🍜',
    keywords: ['pho', 'bun bo', 'bun', 'hu tieu', 'mi cay', 'my cay', 'ramen', 'noodle', 'noodles', 'soup', 'lau', 'hotpot'],
    score: 3,
  },
  {
    emoji: '🍣',
    keywords: ['sushi', 'sashimi', 'omakase', 'japanese', 'izakaya'],
    score: 3,
  },
  {
    emoji: '🍕',
    keywords: ['pizza', 'pasta', 'italian'],
    score: 3,
  },
  {
    emoji: '🍔',
    keywords: ['burger', 'fries', 'fast food', 'fried chicken'],
    score: 3,
  },
  {
    emoji: '🍚',
    keywords: [
      'com',
      'com tam',
      'rice',
      'lunch',
      'dinner',
      'breakfast',
      'meal',
      'banh mi',
      'quan an',
      'grill',
      'bbq',
      'buffet',
      'seafood',
    ],
    score: 2,
  },
  {
    emoji: '🍰',
    keywords: ['cake', 'bakery', 'dessert', 'sweet', 'croissant', 'pastry', 'cookie', 'ice cream', 'kem', 'tiramisu'],
    score: 3,
  },
  {
    emoji: '🍸',
    keywords: ['bar', 'cocktail', 'beer', 'pub', 'wine', 'drinks', 'nightcap', 'speakeasy', 'club'],
    score: 3,
  },
  {
    emoji: '🌿',
    keywords: ['park', 'garden', 'green', 'tree', 'nature', 'plant', 'lake', 'river', 'picnic', 'botanical'],
    score: 3,
  },
  {
    emoji: '🚶',
    keywords: ['walk', 'walking', 'stroll', 'wander', 'walking date'],
    score: 2,
  },
  {
    emoji: '🏃',
    keywords: ['run', 'running', 'jog', 'jogging', 'trail', 'hike', 'hiking'],
    score: 3,
  },
  {
    emoji: '🏋️',
    keywords: ['gym', 'workout', 'fitness', 'exercise', 'pilates', 'yoga'],
    score: 3,
  },
  {
    emoji: '🏖️',
    keywords: ['beach', 'sea', 'ocean', 'coast', 'island', 'resort', 'shore'],
    score: 3,
  },
  {
    emoji: '🏙️',
    keywords: ['city', 'district', 'downtown', 'center', 'centre', 'saigon', 'hcm', 'ha noi', 'dalat', 'da nang'],
    score: 2,
  },
  {
    emoji: '💻',
    keywords: ['work', 'office', 'meeting', 'laptop', 'cowork', 'coworking', 'study', 'deadline', 'project', 'coding', 'code'],
    score: 3,
  },
  {
    emoji: '📚',
    keywords: ['book', 'books', 'read', 'reading', 'bookstore', 'library', 'journal'],
    score: 3,
  },
  {
    emoji: '🎨',
    keywords: ['art', 'gallery', 'museum', 'paint', 'painting', 'design', 'craft'],
    score: 3,
  },
  {
    emoji: '🎵',
    keywords: ['music', 'song', 'concert', 'band', 'jazz', 'lofi', 'vinyl', 'playlist', 'piano'],
    score: 3,
  },
  {
    emoji: '🎬',
    keywords: ['movie', 'cinema', 'film', 'screening', 'theater', 'theatre'],
    score: 3,
  },
  {
    emoji: '🛍️',
    keywords: ['mall', 'shopping', 'market', 'store', 'shop', 'boutique'],
    score: 3,
  },
  {
    emoji: '🏠',
    keywords: ['home', 'house', 'apartment', 'my place', 'at home'],
    score: 3,
  },
  {
    emoji: '🛏️',
    keywords: ['hotel', 'staycation', 'stay', 'resort room'],
    score: 3,
  },
  {
    emoji: '✈️',
    keywords: ['airport', 'flight', 'plane', 'travel', 'trip', 'vacation', 'holiday'],
    score: 3,
  },
  {
    emoji: '🚆',
    keywords: ['station', 'train', 'metro', 'bus', 'bus stop'],
    score: 3,
  },
  {
    emoji: '🌙',
    keywords: ['night', 'evening', 'late', 'moon', 'midnight'],
    score: 2,
  },
  {
    emoji: '🌅',
    keywords: ['sunrise', 'sunset', 'golden hour', 'dawn'],
    score: 3,
  },
  {
    emoji: '🌧️',
    keywords: ['rain', 'rainy', 'storm', 'drizzle'],
    score: 3,
  },
  {
    emoji: '🤍',
    keywords: ['love', 'favorite', 'favourite', 'date', 'special', 'cute', 'cozy', 'cosy', 'romantic'],
    score: 3,
  },
  {
    emoji: '✨',
    keywords: ['beautiful', 'magic', 'memorable', 'spark', 'calm', 'quiet', 'peaceful', 'nice', 'lovely', 'soft'],
    score: 2,
  },
];

export const AUTO_NOTE_EMOJIS = Array.from(
  new Set([
    ...EMOJI_RULES.map((rule) => rule.emoji),
    '📸',
    '☀️',
    '✨',
    '🌙',
  ])
);

function getRuleScore(paddedText: string, rule: EmojiRule) {
  const matches = rule.keywords.reduce((count, keyword) => count + (containsKeyword(paddedText, keyword) ? 1 : 0), 0);
  return matches * (rule.score ?? 1);
}

export function resolveAutoNoteEmoji(options: {
  type: NoteType;
  content: string;
  locationName?: string | null;
  createdAt?: Date;
}) {
  const searchableText = normalize(`${options.content} ${options.locationName ?? ''}`);
  const paddedText = padNormalized(searchableText);
  let bestEmoji: string | null = null;
  let bestScore = 0;

  for (const rule of EMOJI_RULES) {
    const score = getRuleScore(paddedText, rule);
    if (score > bestScore) {
      bestEmoji = rule.emoji;
      bestScore = score;
    }
  }

  if (bestEmoji) {
    return bestEmoji;
  }

  if (options.type === 'photo') {
    return '📸';
  }

  const hour = (options.createdAt ?? new Date()).getHours();
  if (hour >= 18 || hour < 5) {
    return '🌙';
  }

  if (hour >= 5 && hour < 11) {
    return '☀️';
  }

  return '✨';
}

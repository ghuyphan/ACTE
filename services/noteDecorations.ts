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

type NormalizedEmojiRule = EmojiRule & {
  normalizedKeywords: string[];
};

export type InlineNoteEmojiSuggestion = {
  emoji: string;
  matchedText: string;
  matchedKeyword: string;
  exact: boolean;
};

const TRAILING_COMMIT_CHARACTERS = /[\s.,!?;:…]+$/;

function isCommitInsertion(previousText: string, nextText: string) {
  return nextText.length > previousText.length && TRAILING_COMMIT_CHARACTERS.test(nextText);
}

function splitTrailingCommitCharacters(text: string) {
  const trailingCharacters = text.match(TRAILING_COMMIT_CHARACTERS)?.[0] ?? '';
  const committedText = trailingCharacters ? text.slice(0, text.length - trailingCharacters.length) : text;

  return {
    committedText,
    trailingCharacters,
  };
}

function getKeywordSpecificity(keyword: string) {
  const tokenCount = keyword.split(' ').filter(Boolean).length;
  return tokenCount * 100 + keyword.length;
}

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
    emoji: '🧄',
    keywords: ['garlic', 'garlic bread', 'garlic butter', 'toi', 'toi phi', 'toi nuong', 'roasted garlic'],
    score: 3,
  },
  {
    emoji: '🧅',
    keywords: [
      'onion',
      'shallot',
      'shallots',
      'scallion',
      'spring onion',
      'green onion',
      'fried onion',
      'hanh',
      'hanh phi',
      'hanh la',
      'hanh tay',
      'cu hanh',
      'fried shallot',
    ],
    score: 3,
  },
  {
    emoji: '🌶️',
    keywords: ['chili', 'chilli', 'chili oil', 'spicy', 'ot', 'sate', 'sa te', 'ot xanh', 'ot do'],
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

const NORMALIZED_EMOJI_RULES: NormalizedEmojiRule[] = EMOJI_RULES.map((rule) => ({
  ...rule,
  normalizedKeywords: Array.from(new Set(rule.keywords.map((keyword) => normalize(keyword)).filter(Boolean))),
}));

const MAX_KEYWORD_TOKENS = NORMALIZED_EMOJI_RULES.reduce((max, rule) => {
  const ruleMax = rule.normalizedKeywords.reduce((keywordMax, keyword) => {
    return Math.max(keywordMax, keyword.split(' ').length);
  }, 1);

  return Math.max(max, ruleMax);
}, 1);

export const AUTO_NOTE_EMOJIS = Array.from(
  new Set([
    ...EMOJI_RULES.map((rule) => rule.emoji),
    '📸',
    '☀️',
    '✨',
    '🌙',
  ])
);

function getRuleScore(paddedText: string, rule: NormalizedEmojiRule) {
  const matchedKeywords = rule.normalizedKeywords.filter((keyword) => containsKeyword(paddedText, keyword));

  if (matchedKeywords.length === 0) {
    return {
      score: 0,
      matchedKeywordCount: 0,
      strongestKeywordSpecificity: 0,
    };
  }

  const baseScore = rule.score ?? 1;
  const strongestKeywordSpecificity = matchedKeywords.reduce((best, keyword) => {
    return Math.max(best, getKeywordSpecificity(keyword));
  }, 0);
  const specificityScore = matchedKeywords.reduce((sum, keyword) => {
    return sum + getKeywordSpecificity(keyword);
  }, 0);

  return {
    score: specificityScore * baseScore,
    matchedKeywordCount: matchedKeywords.length,
    strongestKeywordSpecificity,
  };
}

function extractActiveSegment(text: string, caret: number) {
  const safeCaret = Math.max(0, Math.min(caret, text.length));
  const beforeCaret = text.slice(0, safeCaret).replace(/\s+$/, '');

  if (!beforeCaret.trim()) {
    return '';
  }

  return beforeCaret
    .split(/[\n\r\t.,!?;:()[\]{}"'“”‘’`~@#$%^&*_+=/\\|-]+/)
    .pop()
    ?.trim() ?? '';
}

function buildInlineSuggestion(
  segment: string,
  candidate: string,
  matchedKeyword: string,
  emoji: string,
  exact: boolean
): InlineNoteEmojiSuggestion | null {
  const tokenCount = candidate.split(' ').length;
  const rawTokens = segment.split(/\s+/).filter(Boolean);
  const matchedText = rawTokens.slice(-tokenCount).join(' ').trim() || matchedKeyword;

  if (!matchedText) {
    return null;
  }

  return {
    emoji,
    matchedText,
    matchedKeyword,
    exact,
  };
}

export function resolveInlineNoteEmojiSuggestion(text: string, caret = text.length): InlineNoteEmojiSuggestion | null {
  const safeText = typeof text === 'string' ? text : '';
  const segment = extractActiveSegment(safeText, caret);
  const normalizedSegment = normalize(segment);

  if (!normalizedSegment || normalizedSegment.length < 2) {
    return null;
  }

  const segmentTokens = normalizedSegment.split(' ').filter(Boolean);
  const maxTokens = Math.min(segmentTokens.length, MAX_KEYWORD_TOKENS);

  for (let tokenCount = maxTokens; tokenCount >= 1; tokenCount -= 1) {
    const candidate = segmentTokens.slice(-tokenCount).join(' ');

    for (const rule of NORMALIZED_EMOJI_RULES) {
      const exactKeyword = rule.normalizedKeywords.find((keyword) => keyword === candidate);
      if (exactKeyword) {
        return buildInlineSuggestion(segment, candidate, exactKeyword, rule.emoji, true);
      }
    }
  }

  if (segmentTokens[segmentTokens.length - 1]?.length < 2) {
    return null;
  }

  for (let tokenCount = maxTokens; tokenCount >= 1; tokenCount -= 1) {
    const candidate = segmentTokens.slice(-tokenCount).join(' ');

    for (const rule of NORMALIZED_EMOJI_RULES) {
      const partialKeyword = [...rule.normalizedKeywords]
        .sort((left, right) => left.length - right.length)
        .find((keyword) => keyword.startsWith(candidate));

      if (partialKeyword) {
        return buildInlineSuggestion(segment, candidate, partialKeyword, rule.emoji, false);
      }
    }
  }

  return null;
}

export function applyCommittedInlineEmoji(previousText: string, nextText: string) {
  const previousValue = typeof previousText === 'string' ? previousText : '';
  const nextValue = typeof nextText === 'string' ? nextText : '';

  if (!isCommitInsertion(previousValue, nextValue)) {
    return nextValue;
  }

  const { committedText, trailingCharacters } = splitTrailingCommitCharacters(nextValue);
  const suggestion = resolveInlineNoteEmojiSuggestion(committedText);

  if (!suggestion?.exact) {
    return nextValue;
  }

  if (committedText.endsWith(` ${suggestion.emoji}`) || committedText.endsWith(suggestion.emoji)) {
    return nextValue;
  }

  return `${committedText} ${suggestion.emoji}${trailingCharacters}`;
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
  let bestMatchedKeywordCount = 0;
  let bestKeywordSpecificity = 0;

  for (const rule of NORMALIZED_EMOJI_RULES) {
    const ruleScore = getRuleScore(paddedText, rule);
    if (
      ruleScore.score > bestScore ||
      (ruleScore.score === bestScore && ruleScore.strongestKeywordSpecificity > bestKeywordSpecificity) ||
      (ruleScore.score === bestScore &&
        ruleScore.strongestKeywordSpecificity === bestKeywordSpecificity &&
        ruleScore.matchedKeywordCount > bestMatchedKeywordCount)
    ) {
      bestEmoji = rule.emoji;
      bestScore = ruleScore.score;
      bestMatchedKeywordCount = ruleScore.matchedKeywordCount;
      bestKeywordSpecificity = ruleScore.strongestKeywordSpecificity;
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

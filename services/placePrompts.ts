export type PlacePromptContext = 'generic' | 'food' | 'revisit' | 'photo';

export interface PlacePrompt {
  id: string;
  text: string;
  contexts: PlacePromptContext[];
}

const PLACE_PROMPTS: PlacePrompt[] = [
  {
    id: 'future-notice',
    text: 'What should future-you notice here?',
    contexts: ['generic', 'revisit'],
  },
  {
    id: 'bring-you-back',
    text: 'What always brings you back here?',
    contexts: ['generic', 'revisit'],
  },
  {
    id: 'tiny-detail',
    text: 'What tiny detail makes this place feel like itself?',
    contexts: ['generic', 'photo'],
  },
  {
    id: 'order-again',
    text: 'What would you order again here?',
    contexts: ['food'],
  },
  {
    id: 'tell-a-friend',
    text: 'What would you tell a friend to try first?',
    contexts: ['food', 'generic'],
  },
  {
    id: 'photo-moment',
    text: 'What made this moment worth keeping?',
    contexts: ['photo'],
  },
  {
    id: 'photo-feeling',
    text: 'What feeling do you want this photo to keep?',
    contexts: ['photo', 'revisit'],
  },
  {
    id: 'changed-since-last-time',
    text: 'What feels different from last time?',
    contexts: ['revisit'],
  },
];

export const MOOD_EMOJIS = ['🙂', '🥹', '🤍', '✨', '☕️', '🌙', '🍜', '🌿'] as const;

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getPromptContext(options: {
  captureMode: 'text' | 'camera';
  locationNameHint?: string | null;
  hasNearbyMemories?: boolean;
}): PlacePromptContext {
  if (options.captureMode === 'camera') {
    return 'photo';
  }

  if (options.hasNearbyMemories) {
    return 'revisit';
  }

  if (options.locationNameHint?.trim()) {
    return 'food';
  }

  return 'generic';
}

export function getPromptsForContext(context: PlacePromptContext) {
  return PLACE_PROMPTS.filter((prompt) => prompt.contexts.includes(context));
}

export function pickPromptForContext(context: PlacePromptContext, seed: string) {
  const prompts = getPromptsForContext(context);
  if (prompts.length === 0) {
    return null;
  }

  return prompts[hashString(`${context}:${seed}`) % prompts.length] ?? null;
}

export function shufflePrompt(currentPromptId: string | null | undefined, context: PlacePromptContext, seed: string) {
  const prompts = getPromptsForContext(context);
  if (prompts.length === 0) {
    return null;
  }

  if (prompts.length === 1) {
    return prompts[0] ?? null;
  }

  const currentIndex = prompts.findIndex((prompt) => prompt.id === currentPromptId);
  const nextIndex = (hashString(`${seed}:${currentPromptId ?? 'none'}`) + Math.max(currentIndex, 0) + 1) % prompts.length;
  return prompts[nextIndex] ?? prompts[0] ?? null;
}

export function getMoodEmojiOptions() {
  return [...MOOD_EMOJIS];
}

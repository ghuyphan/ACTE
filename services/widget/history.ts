import { getPersistentItem, setPersistentItem } from '../../utils/appStorage';

const WIDGET_RECENT_CANDIDATE_KEYS_STORAGE_KEY = 'widget.timeline.recentCandidateKeys.v1';
const MAX_RECENT_WIDGET_CANDIDATE_KEYS = 12;

function normalizeCandidateKeys(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim())
    .slice(0, MAX_RECENT_WIDGET_CANDIDATE_KEYS);
}

export async function loadRecentWidgetCandidateKeys() {
  try {
    const rawValue = await getPersistentItem(WIDGET_RECENT_CANDIDATE_KEYS_STORAGE_KEY);
    if (!rawValue) {
      return [] as string[];
    }

    return normalizeCandidateKeys(JSON.parse(rawValue));
  } catch (error) {
    console.warn('[widgetService] Failed to load recent widget candidate history:', error);
    return [] as string[];
  }
}

export async function saveRecentWidgetCandidateKeys(candidateKeys: string[]) {
  const normalizedCandidateKeys = Array.from(
    new Set(
      candidateKeys
        .filter((candidateKey) => typeof candidateKey === 'string' && candidateKey.trim().length > 0)
        .map((candidateKey) => candidateKey.trim())
    )
  ).slice(0, MAX_RECENT_WIDGET_CANDIDATE_KEYS);

  try {
    await setPersistentItem(
      WIDGET_RECENT_CANDIDATE_KEYS_STORAGE_KEY,
      JSON.stringify(normalizedCandidateKeys)
    );
  } catch (error) {
    console.warn('[widgetService] Failed to persist recent widget candidate history:', error);
  }
}

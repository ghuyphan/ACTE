export function normalizeOptionalString(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

export function getUniqueNormalizedStrings(values: Iterable<string | null | undefined>) {
  const normalizedValues = Array.from(values)
    .map((value) => normalizeOptionalString(value))
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(normalizedValues));
}

export function normalizeForMatching(value: string | null | undefined) {
  return normalizeOptionalString(value)
    .normalize('NFD')
    .replace(/[đĐ]/g, 'd')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function normalizePlaceName(value: string | null | undefined) {
  const normalized = normalizeForMatching(value);
  return normalized || null;
}

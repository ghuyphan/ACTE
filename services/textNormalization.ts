export function normalizeForMatching(value: string | null | undefined) {
  return (value ?? '')
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

export function normalizeOptionalString(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

export function getUniqueNormalizedStrings(values: Iterable<string | null | undefined>) {
  const normalizedValues = Array.from(values)
    .map((value) => normalizeOptionalString(value))
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(normalizedValues));
}

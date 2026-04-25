export function formatSharedPostAuthorHandle(label: string, fallback: string) {
  const trimmed = label.trim() || fallback;
  if (trimmed.startsWith('@')) {
    return trimmed;
  }

  return /^[a-z0-9._]{1,20}$/.test(trimmed) ? `@${trimmed}` : trimmed;
}

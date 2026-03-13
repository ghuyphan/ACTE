export const DEFAULT_NOTE_RADIUS = 150;

export const NOTE_RADIUS_OPTIONS = [100, 150, 250, 400] as const;

export function formatRadiusLabel(radius: number) {
  return `${Math.round(radius)}m`;
}

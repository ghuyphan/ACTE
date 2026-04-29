import type { WidgetProps, WidgetTimelineEntry } from './contract';
import type { WidgetCandidate } from './selection';

const WIDGET_URL_SCHEME = 'noto://';
const WIDGET_TIMELINE_ENTRY_COUNT = 4;
const WIDGET_SLOT_HOURS = 6;

export function buildWidgetUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${WIDGET_URL_SCHEME}${normalizedPath}`;
}

export function getWidgetPrimaryActionUrl(
  candidate: Pick<WidgetCandidate, 'id' | 'source'> | null,
  noteCount: number
) {
  if (!candidate) {
    return noteCount > 0 ? buildWidgetUrl('/notes') : buildWidgetUrl('/');
  }

  if (candidate.source === 'shared') {
    return buildWidgetUrl(`/widget/shared-post/${encodeURIComponent(candidate.id)}`);
  }

  return buildWidgetUrl(`/widget/note/${encodeURIComponent(candidate.id)}`);
}

function getSlotStart(referenceDate: Date) {
  const slotStart = new Date(referenceDate);
  slotStart.setMinutes(0, 0, 0);
  slotStart.setHours(Math.floor(slotStart.getHours() / WIDGET_SLOT_HOURS) * WIDGET_SLOT_HOURS);
  return slotStart;
}

export function buildTimelineDates(
  referenceDate: Date,
  count = WIDGET_TIMELINE_ENTRY_COUNT
) {
  const slotStart = getSlotStart(referenceDate);
  return Array.from({ length: count }, (_, index) => {
    const slotDate = new Date(slotStart);
    slotDate.setHours(slotDate.getHours() + index * WIDGET_SLOT_HOURS);
    return slotDate;
  });
}

export function buildRepeatedWidgetTimeline(
  props: WidgetProps,
  referenceDate: Date
): WidgetTimelineEntry[] {
  return buildTimelineDates(referenceDate).map((date) => ({
    date,
    props,
  }));
}

export function getAuthorInitials(displayName: string | null | undefined) {
  const normalized = typeof displayName === 'string' ? displayName.trim() : '';
  if (!normalized) {
    return '';
  }

  const segments = normalized.split(/\s+/).filter(Boolean);
  if (segments.length === 0) {
    return '';
  }

  return segments
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? '')
    .join('');
}

export function isRenderableWidgetProps(props: WidgetProps) {
  if (props.isIdleState) {
    return true;
  }

  if (props.noteType === 'photo') {
    return Boolean(
      props.backgroundImageUrl?.trim() ||
        props.backgroundImageBase64?.trim()
    );
  }

  return Boolean(
    props.text.trim() ||
      (props.hasDoodle && props.doodleStrokesJson) ||
      (props.hasStickers && props.stickerPlacementsJson)
  );
}

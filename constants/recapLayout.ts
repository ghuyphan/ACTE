import { Layout } from './theme';

const RECAP_CALENDAR_COLUMNS = 7;
const RECAP_CALENDAR_COMPACT_COLUMN_WIDTH = 56;

export const RecapLayout = {
  calendarColumns: RECAP_CALENDAR_COLUMNS,
  calendarCompactColumnWidth: RECAP_CALENDAR_COMPACT_COLUMN_WIDTH,
  horizontalPadding: {
    regular: Layout.screenPadding,
    compact: 14,
  },
  calendarShellPadding: {
    regular: {
      horizontal: 14,
      top: 16,
      bottom: 10,
    },
    compact: {
      horizontal: 10,
      top: 12,
      bottom: 8,
    },
  },
  calendarColumnInset: {
    regular: 2.5,
    compact: 1,
  },
} as const;

function getCalendarInnerWidth(screenWidth: number, compact: boolean) {
  const horizontalPadding = compact
    ? RecapLayout.horizontalPadding.compact
    : RecapLayout.horizontalPadding.regular;
  const shellPadding = compact
    ? RecapLayout.calendarShellPadding.compact.horizontal
    : RecapLayout.calendarShellPadding.regular.horizontal;

  return Math.max(screenWidth - horizontalPadding * 2 - shellPadding * 2, 0);
}

export function resolveNotesRecapLayout(screenWidth: number) {
  const regularCalendarInnerWidth = getCalendarInnerWidth(screenWidth, false);
  const isCompact =
    regularCalendarInnerWidth / RECAP_CALENDAR_COLUMNS <
    RECAP_CALENDAR_COMPACT_COLUMN_WIDTH;
  const horizontalPadding = isCompact
    ? RecapLayout.horizontalPadding.compact
    : RecapLayout.horizontalPadding.regular;
  const calendarShellPadding = isCompact
    ? RecapLayout.calendarShellPadding.compact
    : RecapLayout.calendarShellPadding.regular;
  const calendarInnerWidth = getCalendarInnerWidth(screenWidth, isCompact);
  const calendarColumnInset = isCompact
    ? RecapLayout.calendarColumnInset.compact
    : RecapLayout.calendarColumnInset.regular;
  const calendarColumnWidth = Math.max(
    calendarInnerWidth / RECAP_CALENDAR_COLUMNS,
    0
  );

  return {
    calendarColumnInset,
    calendarColumnWidth,
    calendarInnerWidth,
    calendarShellPadding,
    horizontalPadding,
    isCompact,
  };
}

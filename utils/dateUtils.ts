import i18n from '../constants/i18n';

const LOCALE_MAP: Record<string, string> = {
    vi: 'vi-VN',
    en: 'en-US',
};

function getLocale(): string {
    return LOCALE_MAP[i18n.language] ?? i18n.language;
}

/**
 * Format a date string or Date object using the app's current i18n locale.
 *
 * @param date  – ISO string or Date instance
 * @param style – 'short' for card labels, 'long' for detail screens
 */
export function formatDate(date: Date | string, style: 'short' | 'long' = 'short'): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const locale = getLocale();

    const options: Intl.DateTimeFormatOptions =
        style === 'long'
            ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }
            : { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };

    return d.toLocaleDateString(locale, options);
}

type NoteTimestampStyle = 'card' | 'detail';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const RELATIVE_NOTE_DATE_CUTOFF_DAYS = 7;

function getCompactRelativeUnit(unit: 'minute' | 'hour' | 'day'): string {
    const language = i18n.language;

    if (language === 'vi') {
        if (unit === 'minute') {
            return 'p';
        }

        if (unit === 'hour') {
            return 'g';
        }

        return 'n';
    }

    if (unit === 'minute') {
        return 'm';
    }

    if (unit === 'hour') {
        return 'h';
    }

    return 'd';
}

function formatRelativeNoteTimeFallback(value: number, unit: 'minute' | 'hour' | 'day'): string {
    const absValue = Math.abs(value);

    if (absValue === 0) {
        return `0${getCompactRelativeUnit(unit)}`;
    }

    return `${absValue}${getCompactRelativeUnit(unit)}`;
}

function formatRelativeNoteTime(deltaMs: number): string {
    const absDeltaMs = Math.abs(deltaMs);

    if (absDeltaMs < HOUR_MS) {
        const minutes = Math.max(1, Math.floor(absDeltaMs / MINUTE_MS));
        return formatRelativeNoteTimeFallback(minutes, 'minute');
    }

    if (absDeltaMs < DAY_MS) {
        const hours = Math.max(1, Math.floor(absDeltaMs / HOUR_MS));
        return formatRelativeNoteTimeFallback(hours, 'hour');
    }

    const days = Math.max(1, Math.floor(absDeltaMs / DAY_MS));
    return formatRelativeNoteTimeFallback(days, 'day');
}

export function formatNoteTimestamp(date: Date | string, style: NoteTimestampStyle = 'card', now = new Date()): string {
    const d = typeof date === 'string' ? new Date(date) : date;

    if (Number.isNaN(d.getTime())) {
        return '';
    }

    const locale = getLocale();
    const deltaMs = d.getTime() - now.getTime();
    const absDeltaMs = Math.abs(deltaMs);

    if (absDeltaMs < RELATIVE_NOTE_DATE_CUTOFF_DAYS * DAY_MS) {
        return formatRelativeNoteTime(deltaMs);
    }

    return new Intl.DateTimeFormat(locale, style === 'detail'
        ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
        : { month: 'short', day: 'numeric' }).format(d);
}

export function formatStampDateTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;

    if (Number.isNaN(d.getTime())) {
        return '';
    }

    return new Intl.DateTimeFormat(getLocale(), {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(d);
}

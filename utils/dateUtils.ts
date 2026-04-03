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

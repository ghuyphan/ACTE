import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import vi from './locales/vi.json';
import { getPersistentItem, multiSetPersistent } from '../utils/appStorage';

const STORE_LANGUAGE_KEY = 'settings.lang';
const STORE_LANGUAGE_SOURCE_KEY = 'settings.lang.source';
const EXPLICIT_LANGUAGE_SOURCE = 'user';
export const SUPPORTED_LANGUAGE_CODES = ['en', 'vi'] as const;
export type AppLanguageCode = (typeof SUPPORTED_LANGUAGE_CODES)[number];
const DEFAULT_LANGUAGE: AppLanguageCode = 'en';
let isI18nInitialized = i18n.isInitialized;

export function normalizeAppLanguage(language: string | null | undefined): AppLanguageCode {
    if (!language) {
        return DEFAULT_LANGUAGE;
    }

    const normalized = language.trim().toLowerCase().replace(/_/g, '-');

    if (normalized.startsWith('vi')) {
        return 'vi';
    }

    if (normalized.startsWith('en')) {
        return 'en';
    }

    return DEFAULT_LANGUAGE;
}

export async function detectInitialLanguage(): Promise<AppLanguageCode> {
    try {
        const languageSource = await getPersistentItem(STORE_LANGUAGE_SOURCE_KEY);
        const storedLanguage = await getPersistentItem(STORE_LANGUAGE_KEY);
        if (languageSource === EXPLICIT_LANGUAGE_SOURCE && storedLanguage) {
            return normalizeAppLanguage(storedLanguage);
        }
    } catch (error) {
        console.error('Error reading language', error);
    }

    const [deviceLocale] = getLocales();
    const localeCandidate = [
        deviceLocale?.languageTag,
        deviceLocale?.languageCode,
    ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);

    return normalizeAppLanguage(localeCandidate);
}

// Language detection and caching
const languageDetectorPlugin = {
    type: 'languageDetector' as const,
    async: true,
    init: () => { },
    detect: async function (callback: (lang: string) => void) {
        const language = await detectInitialLanguage();
        callback(language);
    },
    cacheUserLanguage: () => { },
};

const resources = {
    en: { translation: en },
    vi: { translation: vi },
};

export const i18nReady = i18n
    .use(initReactI18next)
    .use(languageDetectorPlugin)
    .init({
        resources,
        compatibilityJSON: 'v4',
        fallbackLng: DEFAULT_LANGUAGE,
        supportedLngs: [...SUPPORTED_LANGUAGE_CODES],
        showSupportNotice: false,
        load: 'languageOnly',
        nonExplicitSupportedLngs: true,
        interpolation: {
            escapeValue: false,
        },
        react: {
            useSuspense: false,
        },
    })
    .then((instance) => {
        isI18nInitialized = true;
        return instance;
    });

export function hasInitializedI18n() {
    return isI18nInitialized;
}

export async function setAppLanguage(language: string): Promise<void> {
    const normalizedLanguage = normalizeAppLanguage(language);

    try {
        await multiSetPersistent([
            [STORE_LANGUAGE_KEY, normalizedLanguage],
            [STORE_LANGUAGE_SOURCE_KEY, EXPLICIT_LANGUAGE_SOURCE],
        ]);
    } catch (error) {
        console.error('Error saving language', error);
    }

    await i18n.changeLanguage(normalizedLanguage);
}

export default i18n;

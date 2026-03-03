import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import vi from './locales/vi.json';

const STORE_LANGUAGE_KEY = 'settings.lang';

// Language detection and caching
const languageDetectorPlugin = {
    type: 'languageDetector' as const,
    async: true,
    init: () => { },
    detect: async function (callback: (lang: string) => void) {
        try {
            // get stored language from Async storage
            await AsyncStorage.getItem(STORE_LANGUAGE_KEY).then((language) => {
                if (language) {
                    // if language was stored before, use this language in the app
                    return callback(language);
                } else {
                    // if language was not stored yet, use device's locale
                    const deviceLang = getLocales()[0].languageCode;
                    return callback(deviceLang || 'en');
                }
            });
        } catch (error) {
            console.log('Error reading language', error);
            const deviceLang = getLocales()[0].languageCode;
            callback(deviceLang || 'en');
        }
    },
    cacheUserLanguage: async function (language: string) {
        try {
            // save a user's language choice in Async storage
            await AsyncStorage.setItem(STORE_LANGUAGE_KEY, language);
        } catch (error) {
            console.log('Error saving language', error);
        }
    },
};

const resources = {
    en: { translation: en },
    vi: { translation: vi },
};

i18n
    .use(initReactI18next)
    .use(languageDetectorPlugin)
    .init({
        resources,
        compatibilityJSON: 'v4',
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
    });

export default i18n;

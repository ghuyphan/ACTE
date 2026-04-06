import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance, AppState, Platform } from 'react-native';
import { NOTE_CARD_GRADIENTS } from '../constants/noteColors';
import { getPersistentItem, getPersistentItemSync, setPersistentItem } from '../utils/appStorage';

export type ThemeType = 'light' | 'dark' | 'system';
type ResolvedColorScheme = 'light' | 'dark';
type NativeColorScheme = ReturnType<typeof Appearance.getColorScheme>;

export interface ThemeColors {
    background: string;
    surface: string;
    card: string;
    text: string;
    secondaryText: string;
    primary: string;
    primarySoft: string;
    accent: string;
    border: string;
    danger: string;
    success: string;
    gradient: string[];
    captureButtonBg: string;
    tabBarBg: string;
    captureCardText: string;
    captureCardPlaceholder: string;
    captureCardBorder: string;
    captureGlassFill: string;
    captureGlassBorder: string;
    captureGlassText: string;
    captureGlassIcon: string;
    captureGlassPlaceholder: string;
    captureGlassColorScheme: 'light' | 'dark';
    captureCameraOverlay: string;
    captureCameraOverlayBorder: string;
    captureCameraOverlayText: string;
    captureFlashOverlay: string;
}

interface ThemeContextType {
    theme: ThemeType;
    isDark: boolean;
    setTheme: (theme: ThemeType) => void;
    colors: ThemeColors;
    themeReady: boolean;
}

export const Colors: { light: ThemeColors; dark: ThemeColors } = {
    light: {
        background: '#F5EEE5',
        surface: '#FCF7F0',
        card: '#FFFCF7',
        text: '#2A2118',
        secondaryText: '#7B6955',
        primary: '#CC9550',
        primarySoft: 'rgba(204, 149, 80, 0.16)',
        accent: '#A66232',
        border: '#E8D9C8',
        danger: '#FF3B30',
        success: '#34C759',
        gradient: ['#F3DDC1', '#D9A25B'],
        captureButtonBg: '#241B12',
        tabBarBg: 'rgba(252,247,240,0.94)',
        captureCardText: '#241B12',
        captureCardPlaceholder: 'rgba(36,27,18,0.42)',
        captureCardBorder: 'rgba(113, 82, 47, 0.12)',
        captureGlassFill: 'rgba(255,252,247,0.68)',
        captureGlassBorder: 'rgba(255,255,255,0.34)',
        captureGlassText: '#2A2118',
        captureGlassIcon: 'rgba(42,33,24,0.56)',
        captureGlassPlaceholder: 'rgba(42,33,24,0.38)',
        captureGlassColorScheme: 'light',
        captureCameraOverlay: 'rgba(28,22,18,0.46)',
        captureCameraOverlayBorder: 'rgba(255,248,240,0.18)',
        captureCameraOverlayText: '#FFF9F1',
        captureFlashOverlay: 'rgba(255,248,239,0.94)',
    },
    dark: {
        background: '#120D0A',
        surface: '#1B1511',
        card: '#241C17',
        text: '#FFF7ED',
        secondaryText: '#B9A590',
        primary: '#E1AE61',
        primarySoft: 'rgba(225, 174, 97, 0.18)',
        accent: '#F0A15B',
        border: '#3B2E26',
        danger: '#FF453A',
        success: '#30D158',
        gradient: ['#E1AE61', '#F08C4D'],
        captureButtonBg: '#FFF7ED',
        tabBarBg: 'rgba(18,13,10,0.92)',
        captureCardText: '#20150E',
        captureCardPlaceholder: 'rgba(32,21,14,0.46)',
        captureCardBorder: 'rgba(255,247,237,0.08)',
        captureGlassFill: 'rgba(31,22,18,0.42)',
        captureGlassBorder: 'rgba(255,247,237,0.14)',
        captureGlassText: '#FFF7E8',
        captureGlassIcon: 'rgba(255,247,232,0.78)',
        captureGlassPlaceholder: 'rgba(255,247,232,0.54)',
        captureGlassColorScheme: 'dark',
        captureCameraOverlay: 'rgba(18,13,10,0.72)',
        captureCameraOverlayBorder: 'rgba(255,247,237,0.14)',
        captureCameraOverlayText: '#FFF7E8',
        captureFlashOverlay: 'rgba(255,244,228,0.88)',
    },
};

// Compatibility export for existing callers that still read note gradients from the theme module.
export const CardGradients: [string, string][] = NOTE_CARD_GRADIENTS;

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'settings.theme';
const VALID_THEMES: ThemeType[] = ['light', 'dark', 'system'];

function normalizeTheme(value: string | null): ThemeType {
    if (value && VALID_THEMES.includes(value as ThemeType)) {
        return value as ThemeType;
    }
    return 'system';
}

function isResolvedColorScheme(colorScheme: NativeColorScheme): colorScheme is ResolvedColorScheme {
    return colorScheme === 'light' || colorScheme === 'dark';
}

export function normalizeSystemColorScheme(
    colorScheme: NativeColorScheme,
    fallback: ResolvedColorScheme = 'light'
): ResolvedColorScheme {
    return isResolvedColorScheme(colorScheme) ? colorScheme : fallback;
}

function readSystemColorScheme(fallback: ResolvedColorScheme = 'light'): ResolvedColorScheme {
    return normalizeSystemColorScheme(Appearance.getColorScheme(), fallback);
}

export function resolveThemePreference(
    theme: ThemeType,
    systemColorScheme: ResolvedColorScheme
): ResolvedColorScheme {
    return theme === 'system' ? systemColorScheme : theme;
}

function syncNativeColorScheme(theme: ThemeType) {
    if (Platform.OS !== 'ios') {
        return;
    }

    try {
        Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme);
    } catch (error) {
        console.warn('Failed to sync native color scheme:', error);
    }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const initialSavedTheme = getPersistentItemSync(THEME_STORAGE_KEY);
    const [theme, setThemeState] = useState<ThemeType>(() => normalizeTheme(initialSavedTheme ?? null));
    const [systemTheme, setSystemTheme] = useState<ResolvedColorScheme>(() =>
        readSystemColorScheme()
    );
    const [themeReady, setThemeReady] = useState(() => initialSavedTheme !== undefined);

    useEffect(() => {
        const syncSystemTheme = () => {
            setSystemTheme((previousTheme) => readSystemColorScheme(previousTheme));
        };

        syncSystemTheme();

        const appearanceSubscription = Appearance.addChangeListener(({ colorScheme }) => {
            setSystemTheme((previousTheme) => normalizeSystemColorScheme(colorScheme, previousTheme));
        });

        const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                syncSystemTheme();
            }
        });

        return () => {
            appearanceSubscription.remove();
            appStateSubscription.remove();
        };
    }, []);

    useEffect(() => {
        if (themeReady) {
            syncNativeColorScheme(theme);
            return;
        }

        getPersistentItem(THEME_STORAGE_KEY).then((savedTheme) => {
            const nextTheme = normalizeTheme(savedTheme);
            setThemeState(nextTheme);
            syncNativeColorScheme(nextTheme);
            setThemeReady(true);
        }).catch(() => {
            syncNativeColorScheme('system');
            setThemeReady(true);
        });
    }, [theme, themeReady]);

    const setTheme = async (newTheme: ThemeType) => {
        setThemeState(newTheme);
        syncNativeColorScheme(newTheme);
        await setPersistentItem(THEME_STORAGE_KEY, newTheme);
    };

    const resolvedTheme = resolveThemePreference(theme, systemTheme);
    const isDark = resolvedTheme === 'dark';
    const colors = isDark ? Colors.dark : Colors.light;

    // Block rendering until the saved theme is loaded to prevent
    // the white flash when the theme snaps from default to saved value
    if (!themeReady) {
        return null;
    }

    return (
        <ThemeContext.Provider value={{ theme, isDark, setTheme, colors, themeReady }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

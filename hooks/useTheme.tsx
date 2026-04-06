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
        background: '#F7F2EB',       // Subtle stone tint lifted from the widget, but lighter for app-wide use
        surface: '#FCF9F5',
        card: '#FFFDFC',
        text: '#2B2621',
        secondaryText: '#85786A',
        primary: '#E0B15B',          // Honey accent keeps the app warm without turning everything brown
        primarySoft: 'rgba(224, 177, 91, 0.18)',
        accent: '#B77845',           // Deeper clay reserved for higher-contrast emphasis
        border: '#EBE1D6',
        danger: '#FF3B30',
        success: '#34C759',
        gradient: ['#F2DEC0', '#E0B15B'],
        captureButtonBg: '#1C1C1E',
        tabBarBg: 'rgba(247,242,235,0.94)',
        captureCardText: '#1C1C1E',
        captureCardPlaceholder: 'rgba(28,28,30,0.48)',
        captureCardBorder: 'rgba(120, 101, 83, 0.16)',
        captureGlassFill: 'rgba(255,252,246,0.62)',
        captureGlassBorder: 'rgba(255,255,255,0.3)',
        captureGlassText: '#2B2621',
        captureGlassIcon: 'rgba(43,38,33,0.52)',
        captureGlassPlaceholder: 'rgba(43,38,33,0.34)',
        captureGlassColorScheme: 'light',
        captureCameraOverlay: 'rgba(28,28,30,0.48)',
        captureCameraOverlayBorder: 'rgba(255,255,255,0.16)',
        captureCameraOverlayText: '#FFFDFC',
        captureFlashOverlay: 'rgba(255,250,242,0.96)',
    },
    dark: {
        background: '#000000',       // Pure OLED black
        surface: '#121212',          // Slightly elevated surface
        card: '#1C1C1E',             // Standard elevated card
        text: '#FFFFFF',
        secondaryText: '#98989E',
        primary: '#FFC107',          // Keep the original brighter accent in dark mode
        primarySoft: 'rgba(255, 193, 7, 0.2)',
        accent: '#FF9F0A',
        border: '#2C2C2E',
        danger: '#FF453A',
        success: '#30D158',
        gradient: ['#FFC107', '#FF9F0A'],
        captureButtonBg: '#FFFFFF',
        tabBarBg: 'rgba(0,0,0,0.92)',
        captureCardText: '#1C1C1E',
        captureCardPlaceholder: 'rgba(28,28,30,0.5)',
        captureCardBorder: 'rgba(255,255,255,0.08)',
        captureGlassFill: 'rgba(28,28,30,0.28)',
        captureGlassBorder: 'rgba(255,255,255,0.16)',
        captureGlassText: '#FFF7E8',
        captureGlassIcon: 'rgba(255,247,232,0.78)',
        captureGlassPlaceholder: 'rgba(255,247,232,0.56)',
        captureGlassColorScheme: 'dark',
        captureCameraOverlay: 'rgba(18,18,18,0.68)',
        captureCameraOverlayBorder: 'rgba(255,255,255,0.14)',
        captureCameraOverlayText: '#FFF7E8',
        captureFlashOverlay: 'rgba(255,248,232,0.92)',
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

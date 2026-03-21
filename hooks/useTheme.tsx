import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance, AppState, Platform } from 'react-native';

export type ThemeType = 'light' | 'dark' | 'system';
type ResolvedColorScheme = 'light' | 'dark';
type NativeColorScheme = ReturnType<typeof Appearance.getColorScheme>;

type NativeAppearanceModule = {
    getColorScheme?: () => NativeColorScheme;
} | null;

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
        captureCardBorder: 'rgba(255,255,255,0.22)',
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

// Curated gradient palettes for text-note card backgrounds.
// Kept moody enough for white text, but aligned to the app's warmer stone palette.
export const CardGradients: [string, string][] = [
    ['#7A3C2F', '#D86B4E'],  // Sunset coral
    ['#7A4B23', '#D89A3D'],  // Marigold glow
    ['#245C4B', '#4EAE8C'],  // Jade pop
    ['#2F5E8B', '#76A8F0'],  // Sky blue
    ['#8A4A2B', '#E38852'],  // Tangerine clay
    ['#654A8A', '#A486E6'],  // Violet bloom
    ['#1F6070', '#56B3C5'],  // Pool teal
    ['#4A5F91', '#8BA1E8'],  // Periwinkle ink
    ['#58652D', '#A9C24B'],  // Olive lime
    ['#7A3E60', '#D07AA3'],  // Raspberry dusk
];

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'settings.theme';
const VALID_THEMES: ThemeType[] = ['light', 'dark', 'system'];
const nativeAppearance: NativeAppearanceModule =
    Platform.OS === 'ios'
        ? (require('react-native/Libraries/Utilities/NativeAppearance').default as NativeAppearanceModule)
        : null;

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
    const colorScheme =
        Platform.OS === 'ios'
            ? nativeAppearance?.getColorScheme?.() ?? Appearance.getColorScheme()
            : Appearance.getColorScheme();

    return normalizeSystemColorScheme(colorScheme, fallback);
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
    const [theme, setThemeState] = useState<ThemeType>('system');
    const [systemTheme, setSystemTheme] = useState<ResolvedColorScheme>(() =>
        readSystemColorScheme()
    );
    const [themeReady, setThemeReady] = useState(false);

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
        AsyncStorage.getItem(THEME_STORAGE_KEY).then((savedTheme) => {
            const nextTheme = normalizeTheme(savedTheme);
            setThemeState(nextTheme);
            syncNativeColorScheme(nextTheme);
            setThemeReady(true);
        }).catch(() => {
            syncNativeColorScheme('system');
            setThemeReady(true);
        });
    }, []);

    const setTheme = async (newTheme: ThemeType) => {
        setThemeState(newTheme);
        syncNativeColorScheme(newTheme);
        await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
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

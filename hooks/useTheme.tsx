import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

type ThemeType = 'light' | 'dark' | 'system';

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
}

interface ThemeContextType {
    theme: ThemeType;
    isDark: boolean;
    setTheme: (theme: ThemeType) => void;
    colors: ThemeColors;
}

export const Colors: { light: ThemeColors; dark: ThemeColors } = {
    light: {
        background: '#FAF9F6',       // Off-white/cream background for better contrast
        surface: '#FFFFFF',
        card: '#FFFFFF',
        text: '#1C1C1E',
        secondaryText: '#8E8E93',
        primary: '#FFC107',          // Vibrant gold/amber
        primarySoft: 'rgba(255, 193, 7, 0.15)',
        accent: '#FF9F0A',           // Amber accent
        border: '#E5E5EA',
        danger: '#FF3B30',
        success: '#34C759',
        gradient: ['#FFC107', '#FF9F0A'],
        captureButtonBg: '#1C1C1E',
        tabBarBg: 'rgba(250,249,246,0.92)',
    },
    dark: {
        background: '#000000',       // Pure OLED black
        surface: '#121212',          // Slightly elevated surface
        card: '#1C1C1E',             // Standard elevated card
        text: '#FFFFFF',
        secondaryText: '#98989E',
        primary: '#FFC107',          // Vibrant gold/amber
        primarySoft: 'rgba(255, 193, 7, 0.2)',
        accent: '#FF9F0A',
        border: '#2C2C2E',
        danger: '#FF453A',
        success: '#30D158',
        gradient: ['#FFC107', '#FF9F0A'],
        captureButtonBg: '#FFFFFF',
        tabBarBg: 'rgba(0,0,0,0.92)',
    },
};

// Curated gradient palettes for text-note card backgrounds
export const CardGradients = [
    ['#667eea', '#764ba2'],  // Purple dream
    ['#f093fb', '#f5576c'],  // Pink sunset
    ['#4facfe', '#00f2fe'],  // Ocean blue
    ['#43e97b', '#38f9d7'],  // Mint green
    ['#fa709a', '#fee140'],  // Warm peach
    ['#a18cd1', '#fbc2eb'],  // Lavender
    ['#fccb90', '#d57eeb'],  // Mango
    ['#ff9a9e', '#fecfef'],  // Rose
    ['#ff6e7f', '#bfe9ff'],  // Coral sky
    ['#6a11cb', '#2575fc'],  // Deep blue
];

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'settings.theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const systemColorScheme = useColorScheme();
    const [theme, setThemeState] = useState<ThemeType>('system');

    useEffect(() => {
        AsyncStorage.getItem(THEME_STORAGE_KEY).then((savedTheme) => {
            if (savedTheme) {
                setThemeState(savedTheme as ThemeType);
            }
        });
    }, []);

    const setTheme = async (newTheme: ThemeType) => {
        setThemeState(newTheme);
        await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
    };

    const isDark = theme === 'system' ? systemColorScheme === 'dark' : theme === 'dark';
    const colors = isDark ? Colors.dark : Colors.light;

    return (
        <ThemeContext.Provider value={{ theme, isDark, setTheme, colors }}>
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

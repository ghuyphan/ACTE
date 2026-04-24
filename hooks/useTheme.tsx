import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance, AppState, Platform } from 'react-native';
import { APP_THEME_VALUES, DEFAULT_APP_THEME, type AppThemeType } from '../constants/appThemes';
import { NOTE_CARD_GRADIENTS } from '../constants/noteColors';
import { getPersistentItem, getPersistentItemSync, setPersistentItem } from '../utils/appStorage';

export type ThemeType = 'light' | 'dark' | 'system';
export type { AppThemeType } from '../constants/appThemes';
type ResolvedColorScheme = 'light' | 'dark';
type NativeColorScheme = ReturnType<typeof Appearance.getColorScheme>;

export interface ThemeColors {
    background: string;
    surface: string;
    card: string;
    text: string;
    secondaryText: string;
    inverseText: string;
    primary: string;
    primarySoft: string;
    onPrimary: string;
    accent: string;
    border: string;
    danger: string;
    dangerSoft: string;
    onDanger: string;
    success: string;
    gradient: [string, string];
    captureGradient: [string, string];
    chromeSurface: string;
    chromeBorder: string;
    noticeSurface: string;
    noticeBorder: string;
    glassOverlaySurface: string;
    glassOverlayBorder: string;
    glassBackdrop: string;
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
    androidTabShellBackground: string;
    androidTabShellBorder: string;
    androidTabShellShadow: string;
    androidTabShellScrim: string;
    androidTabShellMutedBackground: string;
    androidTabShellMutedBorder: string;
    androidTabShellSelectedBackground: string;
    androidTabShellSelectedBorder: string;
    androidTabShellSelectedGradient: [string, string];
    androidTabShellActive: string;
    androidTabShellInactive: string;
}

interface ThemeContextType {
    theme: ThemeType;
    appTheme: AppThemeType;
    isDark: boolean;
    setTheme: (theme: ThemeType) => void;
    setAppTheme: (appTheme: AppThemeType) => void;
    colors: ThemeColors;
    themeReady: boolean;
}

type ThemePalette = { light: ThemeColors; dark: ThemeColors };

const pastelPalette: ThemePalette = {
    light: {
        background: '#FFF6F7',
        surface: '#FFFDFE',
        card: '#FFFFFF',
        text: '#5E5564',
        secondaryText: '#998EA0',
        inverseText: '#FFFFFF',
        primary: '#F3B6C6',
        primarySoft: 'rgba(243, 182, 198, 0.22)',
        onPrimary: '#5A4754',
        accent: '#C7BBF6',
        border: '#F1E1E8',
        danger: '#F28C95',
        dangerSoft: 'rgba(242,140,149,0.16)',
        onDanger: '#FFFFFF',
        success: '#8CC9B3',
        gradient: ['#F8D7E2', '#D4C9FA'],
        captureGradient: ['#F8D7E2', '#D4C9FA'],
        chromeSurface: 'rgba(132,111,130,0.08)',
        chromeBorder: 'rgba(132,111,130,0.14)',
        noticeSurface: 'rgba(255,255,255,0.82)',
        noticeBorder: 'rgba(132,111,130,0.08)',
        glassOverlaySurface: 'rgba(255,255,255,0.42)',
        glassOverlayBorder: 'rgba(255,255,255,0.54)',
        glassBackdrop: 'rgba(255,247,250,0.78)',
        captureButtonBg: '#5A4754',
        tabBarBg: 'rgba(255,246,247,0.94)',
        captureCardText: '#5A4754',
        captureCardPlaceholder: 'rgba(90,71,84,0.48)',
        captureCardBorder: 'rgba(137,118,130,0.16)',
        captureGlassFill: 'rgba(255,250,252,0.68)',
        captureGlassBorder: 'rgba(255,255,255,0.34)',
        captureGlassText: '#5E5564',
        captureGlassIcon: 'rgba(94,85,100,0.54)',
        captureGlassPlaceholder: 'rgba(94,85,100,0.34)',
        captureGlassColorScheme: 'light',
        captureCameraOverlay: 'rgba(90,71,84,0.44)',
        captureCameraOverlayBorder: 'rgba(255,255,255,0.18)',
        captureCameraOverlayText: '#FFF8FA',
        captureFlashOverlay: 'rgba(56,40,51,0.88)',
        androidTabShellBackground: 'rgba(255,250,252,0.9)',
        androidTabShellBorder: 'rgba(167,143,160,0.18)',
        androidTabShellShadow: 'rgba(182,147,165,0.12)',
        androidTabShellScrim: 'rgba(255,255,255,0.5)',
        androidTabShellMutedBackground: 'rgba(255,255,255,0.72)',
        androidTabShellMutedBorder: 'rgba(167,143,160,0.12)',
        androidTabShellSelectedBackground: 'rgba(255,255,255,0.92)',
        androidTabShellSelectedBorder: 'rgba(167,143,160,0.12)',
        androidTabShellSelectedGradient: ['rgba(255,255,255,0.96)', 'rgba(249,240,247,0.9)'],
        androidTabShellActive: '#7E6573',
        androidTabShellInactive: '#998EA0',
    },
    dark: {
        background: '#17131C',
        surface: '#221B28',
        card: '#2C2433',
        text: '#FFF4F7',
        secondaryText: '#C6B8C6',
        inverseText: '#FFFFFF',
        primary: '#F1B7C9',
        primarySoft: 'rgba(241,183,201,0.2)',
        onPrimary: '#4F3E49',
        accent: '#C6BCFF',
        border: '#43364A',
        danger: '#FF9EAB',
        dangerSoft: 'rgba(255,158,171,0.18)',
        onDanger: '#FFFFFF',
        success: '#93D2BB',
        gradient: ['#F1B7C9', '#C6BCFF'],
        captureGradient: ['#F1B7C9', '#C6BCFF'],
        chromeSurface: 'rgba(255,244,247,0.08)',
        chromeBorder: 'rgba(255,244,247,0.14)',
        noticeSurface: 'rgba(255,244,247,0.07)',
        noticeBorder: 'rgba(255,244,247,0.1)',
        glassOverlaySurface: 'rgba(36,29,43,0.5)',
        glassOverlayBorder: 'rgba(255,244,247,0.18)',
        glassBackdrop: 'rgba(12,8,16,0.56)',
        captureButtonBg: '#FFF4F7',
        tabBarBg: 'rgba(18,14,22,0.92)',
        captureCardText: '#2C2433',
        captureCardPlaceholder: 'rgba(44,36,51,0.48)',
        captureCardBorder: 'rgba(255,244,247,0.16)',
        captureGlassFill: 'rgba(44,36,51,0.3)',
        captureGlassBorder: 'rgba(255,244,247,0.18)',
        captureGlassText: '#FFF4F7',
        captureGlassIcon: 'rgba(255,244,247,0.78)',
        captureGlassPlaceholder: 'rgba(255,244,247,0.56)',
        captureGlassColorScheme: 'dark',
        captureCameraOverlay: 'rgba(20,14,26,0.7)',
        captureCameraOverlayBorder: 'rgba(255,244,247,0.16)',
        captureCameraOverlayText: '#FFF4F7',
        captureFlashOverlay: 'rgba(0,0,0,0.9)',
        androidTabShellBackground: 'rgba(39,31,46,0.72)',
        androidTabShellBorder: 'rgba(255,244,247,0.12)',
        androidTabShellShadow: 'rgba(0,0,0,0.28)',
        androidTabShellScrim: 'rgba(39,31,46,0.24)',
        androidTabShellMutedBackground: 'rgba(255,244,247,0.1)',
        androidTabShellMutedBorder: 'rgba(255,244,247,0.12)',
        androidTabShellSelectedBackground: 'rgba(255,244,247,0.22)',
        androidTabShellSelectedBorder: 'rgba(255,244,247,0.16)',
        androidTabShellSelectedGradient: ['rgba(255,244,247,0.26)', 'rgba(232,225,255,0.14)'],
        androidTabShellActive: '#FFF4F7',
        androidTabShellInactive: 'rgba(255,244,247,0.72)',
    },
};

const classicPalette: ThemePalette = {
    light: {
        background: '#F7F2EB',       // Subtle stone tint lifted from the widget, but lighter for app-wide use
        surface: '#FCF9F5',
        card: '#FFFDFC',
        text: '#2B2621',
        secondaryText: '#85786A',
        inverseText: '#FFFFFF',
        primary: '#E0B15B',          // Honey accent keeps the app warm without turning everything brown
        primarySoft: 'rgba(224, 177, 91, 0.18)',
        onPrimary: '#1C1C1E',
        accent: '#B77845',           // Deeper clay reserved for higher-contrast emphasis
        border: '#EBE1D6',
        danger: '#FF3B30',
        dangerSoft: 'rgba(255,59,48,0.1)',
        onDanger: '#FFFFFF',
        success: '#34C759',
        gradient: ['#F2DEC0', '#E0B15B'],
        captureGradient: ['#F6D365', '#FDA085'],
        chromeSurface: 'rgba(0,0,0,0.04)',
        chromeBorder: 'rgba(43,38,33,0.12)',
        noticeSurface: 'rgba(255,255,255,0.76)',
        noticeBorder: 'rgba(0,0,0,0.06)',
        glassOverlaySurface: 'rgba(255,255,255,0.36)',
        glassOverlayBorder: 'rgba(255,255,255,0.42)',
        glassBackdrop: 'rgba(255,255,255,0.75)',
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
        captureFlashOverlay: 'rgba(0,0,0,0.9)',
        androidTabShellBackground: 'rgba(255,251,246,0.88)',
        androidTabShellBorder: 'rgba(113,86,26,0.18)',
        androidTabShellShadow: 'rgba(107,79,14,0.1)',
        androidTabShellScrim: 'rgba(255,255,255,0.44)',
        androidTabShellMutedBackground: 'rgba(255,255,255,0.62)',
        androidTabShellMutedBorder: 'rgba(113,86,26,0.1)',
        androidTabShellSelectedBackground: 'rgba(255,255,255,0.88)',
        androidTabShellSelectedBorder: 'rgba(113,86,26,0.1)',
        androidTabShellSelectedGradient: ['rgba(255,255,255,0.94)', 'rgba(255,248,239,0.84)'],
        androidTabShellActive: '#6D530F',
        androidTabShellInactive: '#85786A',
    },
    dark: {
        background: '#000000',       // Pure OLED black
        surface: '#121212',          // Slightly elevated surface
        card: '#1C1C1E',             // Standard elevated card
        text: '#FFFFFF',
        secondaryText: '#98989E',
        inverseText: '#FFFFFF',
        primary: '#FFC107',          // Keep the original brighter accent in dark mode
        primarySoft: 'rgba(255, 193, 7, 0.2)',
        onPrimary: '#1C1C1E',
        accent: '#FF9F0A',
        border: '#2C2C2E',
        danger: '#FF453A',
        dangerSoft: 'rgba(255,69,58,0.16)',
        onDanger: '#FFFFFF',
        success: '#30D158',
        gradient: ['#FFC107', '#FF9F0A'],
        captureGradient: ['#F6D365', '#FDA085'],
        chromeSurface: 'rgba(255,255,255,0.08)',
        chromeBorder: 'rgba(255,255,255,0.14)',
        noticeSurface: 'rgba(255,255,255,0.06)',
        noticeBorder: 'rgba(255,255,255,0.08)',
        glassOverlaySurface: 'rgba(22,22,24,0.42)',
        glassOverlayBorder: 'rgba(255,255,255,0.16)',
        glassBackdrop: 'rgba(0,0,0,0.5)',
        captureButtonBg: '#FFFFFF',
        tabBarBg: 'rgba(0,0,0,0.92)',
        captureCardText: '#1C1C1E',
        captureCardPlaceholder: 'rgba(28,28,30,0.5)',
        captureCardBorder: 'rgba(255,247,232,0.16)',
        captureGlassFill: 'rgba(28,28,30,0.28)',
        captureGlassBorder: 'rgba(255,255,255,0.16)',
        captureGlassText: '#FFF7E8',
        captureGlassIcon: 'rgba(255,247,232,0.78)',
        captureGlassPlaceholder: 'rgba(255,247,232,0.56)',
        captureGlassColorScheme: 'dark',
        captureCameraOverlay: 'rgba(18,18,18,0.68)',
        captureCameraOverlayBorder: 'rgba(255,255,255,0.14)',
        captureCameraOverlayText: '#FFF7E8',
        captureFlashOverlay: 'rgba(0,0,0,0.9)',
        androidTabShellBackground: 'rgba(24,20,18,0.68)',
        androidTabShellBorder: 'rgba(255,255,255,0.12)',
        androidTabShellShadow: 'rgba(0,0,0,0.24)',
        androidTabShellScrim: 'rgba(24,24,28,0.24)',
        androidTabShellMutedBackground: 'rgba(255,247,232,0.1)',
        androidTabShellMutedBorder: 'rgba(255,255,255,0.12)',
        androidTabShellSelectedBackground: 'rgba(255,247,232,0.22)',
        androidTabShellSelectedBorder: 'rgba(255,255,255,0.16)',
        androidTabShellSelectedGradient: ['rgba(255,247,232,0.24)', 'rgba(255,247,232,0.12)'],
        androidTabShellActive: '#FFF7E8',
        androidTabShellInactive: 'rgba(255,247,232,0.68)',
    },
};

const peachPalette: ThemePalette = {
    light: {
        ...pastelPalette.light,
        background: '#FFF8F4',
        surface: '#FFFDFC',
        text: '#664E49',
        secondaryText: '#A28A83',
        primary: '#F4C4A4',
        primarySoft: 'rgba(244,196,164,0.22)',
        onPrimary: '#5F4742',
        accent: '#F0ADC2',
        border: '#F4E4DC',
        danger: '#F29A9A',
        dangerSoft: 'rgba(242,154,154,0.16)',
        success: '#9BC9B0',
        gradient: ['#FFD9C6', '#F6BCCB'],
        captureGradient: ['#FFD9C6', '#F6BCCB'],
        chromeSurface: 'rgba(143,114,105,0.08)',
        chromeBorder: 'rgba(143,114,105,0.14)',
        noticeBorder: 'rgba(143,114,105,0.08)',
        glassBackdrop: 'rgba(255,248,244,0.78)',
        captureButtonBg: '#664E49',
        tabBarBg: 'rgba(255,248,244,0.94)',
        captureCardText: '#664E49',
        captureCardPlaceholder: 'rgba(102,78,73,0.48)',
        captureCardBorder: 'rgba(160,129,120,0.16)',
        captureGlassFill: 'rgba(255,251,248,0.68)',
        captureGlassText: '#664E49',
        captureGlassIcon: 'rgba(102,78,73,0.54)',
        captureGlassPlaceholder: 'rgba(102,78,73,0.34)',
        captureCameraOverlay: 'rgba(102,78,73,0.44)',
        captureCameraOverlayText: '#FFF8F5',
        androidTabShellBackground: 'rgba(255,251,248,0.9)',
        androidTabShellBorder: 'rgba(177,145,135,0.18)',
        androidTabShellShadow: 'rgba(205,159,147,0.12)',
        androidTabShellMutedBorder: 'rgba(177,145,135,0.12)',
        androidTabShellSelectedBorder: 'rgba(177,145,135,0.12)',
        androidTabShellSelectedGradient: ['rgba(255,255,255,0.96)', 'rgba(252,242,239,0.9)'],
        androidTabShellActive: '#8A665F',
        androidTabShellInactive: '#A28A83',
    },
    dark: {
        ...pastelPalette.dark,
        background: '#1B1416',
        surface: '#261D20',
        card: '#302528',
        text: '#FFF4F1',
        secondaryText: '#D3C0BC',
        primary: '#F4C4A4',
        primarySoft: 'rgba(244,196,164,0.2)',
        onPrimary: '#503C37',
        accent: '#F0ADC2',
        border: '#4A3B3D',
        danger: '#FFB0B0',
        dangerSoft: 'rgba(255,176,176,0.18)',
        success: '#9ED1B7',
        gradient: ['#F4C4A4', '#F0ADC2'],
        captureGradient: ['#F4C4A4', '#F0ADC2'],
        chromeSurface: 'rgba(255,244,241,0.08)',
        chromeBorder: 'rgba(255,244,241,0.14)',
        noticeSurface: 'rgba(255,244,241,0.07)',
        noticeBorder: 'rgba(255,244,241,0.1)',
        glassOverlaySurface: 'rgba(48,37,40,0.54)',
        glassOverlayBorder: 'rgba(255,244,241,0.18)',
        glassBackdrop: 'rgba(27,20,22,0.64)',
        captureButtonBg: '#FFF4F1',
        tabBarBg: 'rgba(27,20,22,0.9)',
        captureCardText: '#302528',
        captureCardPlaceholder: 'rgba(48,37,40,0.48)',
        captureCardBorder: 'rgba(255,244,241,0.16)',
        captureGlassFill: 'rgba(48,37,40,0.34)',
        captureGlassText: '#FFF4F1',
        captureGlassIcon: 'rgba(255,244,241,0.78)',
        captureGlassPlaceholder: 'rgba(255,244,241,0.56)',
        captureCameraOverlay: 'rgba(27,20,22,0.7)',
        captureCameraOverlayBorder: 'rgba(255,244,241,0.16)',
        captureCameraOverlayText: '#FFF4F1',
        androidTabShellBackground: 'rgba(46,35,38,0.72)',
        androidTabShellBorder: 'rgba(255,244,241,0.12)',
        androidTabShellScrim: 'rgba(46,35,38,0.24)',
        androidTabShellMutedBackground: 'rgba(255,244,241,0.1)',
        androidTabShellMutedBorder: 'rgba(255,244,241,0.12)',
        androidTabShellSelectedBackground: 'rgba(255,244,241,0.22)',
        androidTabShellSelectedBorder: 'rgba(255,244,241,0.16)',
        androidTabShellSelectedGradient: ['rgba(255,244,241,0.26)', 'rgba(243,223,232,0.14)'],
        androidTabShellActive: '#FFF4F1',
        androidTabShellInactive: 'rgba(255,244,241,0.72)',
    },
};

const matchaPalette: ThemePalette = {
    light: {
        ...pastelPalette.light,
        background: '#F7FBF4',
        surface: '#FEFFFC',
        text: '#566053',
        secondaryText: '#8E9A8C',
        primary: '#BFD8A6',
        primarySoft: 'rgba(191,216,166,0.22)',
        onPrimary: '#4B5848',
        accent: '#A8D9C5',
        border: '#E4EEDC',
        danger: '#EEA0A0',
        dangerSoft: 'rgba(238,160,160,0.16)',
        success: '#83BEA6',
        gradient: ['#D8E9C1', '#BEE7D7'],
        captureGradient: ['#D8E9C1', '#BEE7D7'],
        chromeSurface: 'rgba(110,128,107,0.08)',
        chromeBorder: 'rgba(110,128,107,0.14)',
        noticeBorder: 'rgba(110,128,107,0.08)',
        glassBackdrop: 'rgba(247,252,244,0.78)',
        captureButtonBg: '#4B5848',
        tabBarBg: 'rgba(247,251,244,0.94)',
        captureCardText: '#4B5848',
        captureCardPlaceholder: 'rgba(75,88,72,0.48)',
        captureCardBorder: 'rgba(126,146,122,0.16)',
        captureGlassFill: 'rgba(251,255,248,0.68)',
        captureGlassText: '#566053',
        captureGlassIcon: 'rgba(86,96,83,0.54)',
        captureGlassPlaceholder: 'rgba(86,96,83,0.34)',
        captureCameraOverlay: 'rgba(75,88,72,0.44)',
        captureCameraOverlayText: '#F8FFF5',
        androidTabShellBackground: 'rgba(251,255,248,0.9)',
        androidTabShellBorder: 'rgba(126,150,121,0.18)',
        androidTabShellShadow: 'rgba(141,177,152,0.12)',
        androidTabShellMutedBorder: 'rgba(126,150,121,0.12)',
        androidTabShellSelectedBorder: 'rgba(126,150,121,0.12)',
        androidTabShellSelectedGradient: ['rgba(255,255,255,0.96)', 'rgba(243,250,244,0.9)'],
        androidTabShellActive: '#64805F',
        androidTabShellInactive: '#8E9A8C',
    },
    dark: {
        ...pastelPalette.dark,
        background: '#141916',
        surface: '#1E2520',
        card: '#273028',
        text: '#F4FAF0',
        secondaryText: '#C1D0C0',
        primary: '#BFD8A6',
        primarySoft: 'rgba(191,216,166,0.2)',
        onPrimary: '#465144',
        accent: '#A8D9C5',
        border: '#39463D',
        danger: '#F2B0B0',
        dangerSoft: 'rgba(242,176,176,0.18)',
        success: '#8DC8AF',
        gradient: ['#BFD8A6', '#A8D9C5'],
        captureGradient: ['#BFD8A6', '#A8D9C5'],
        chromeSurface: 'rgba(244,250,240,0.08)',
        chromeBorder: 'rgba(244,250,240,0.14)',
        noticeSurface: 'rgba(244,250,240,0.07)',
        noticeBorder: 'rgba(244,250,240,0.1)',
        glassOverlaySurface: 'rgba(39,48,40,0.54)',
        glassOverlayBorder: 'rgba(244,250,240,0.18)',
        glassBackdrop: 'rgba(20,25,22,0.64)',
        captureButtonBg: '#F4FAF0',
        tabBarBg: 'rgba(20,25,22,0.9)',
        captureCardText: '#273028',
        captureCardPlaceholder: 'rgba(39,48,40,0.48)',
        captureCardBorder: 'rgba(244,250,240,0.16)',
        captureGlassFill: 'rgba(39,48,40,0.34)',
        captureGlassText: '#F4FAF0',
        captureGlassIcon: 'rgba(244,250,240,0.78)',
        captureGlassPlaceholder: 'rgba(244,250,240,0.56)',
        captureCameraOverlay: 'rgba(20,25,22,0.7)',
        captureCameraOverlayBorder: 'rgba(244,250,240,0.16)',
        captureCameraOverlayText: '#F4FAF0',
        androidTabShellBackground: 'rgba(38,47,40,0.72)',
        androidTabShellBorder: 'rgba(244,250,240,0.12)',
        androidTabShellScrim: 'rgba(38,47,40,0.24)',
        androidTabShellMutedBackground: 'rgba(244,250,240,0.1)',
        androidTabShellMutedBorder: 'rgba(244,250,240,0.12)',
        androidTabShellSelectedBackground: 'rgba(244,250,240,0.22)',
        androidTabShellSelectedBorder: 'rgba(244,250,240,0.16)',
        androidTabShellSelectedGradient: ['rgba(244,250,240,0.26)', 'rgba(226,246,235,0.14)'],
        androidTabShellActive: '#F4FAF0',
        androidTabShellInactive: 'rgba(244,250,240,0.72)',
    },
};

const berryPalette: ThemePalette = {
    light: {
        ...pastelPalette.light,
        background: '#F7F6FF',
        surface: '#FEFDFF',
        text: '#5D5770',
        secondaryText: '#958FAA',
        primary: '#C9C2FF',
        primarySoft: 'rgba(201,194,255,0.22)',
        onPrimary: '#544F69',
        accent: '#F0C0E7',
        border: '#E8E4F7',
        danger: '#F1A0B6',
        dangerSoft: 'rgba(241,160,182,0.16)',
        success: '#8FBCE6',
        gradient: ['#D9D3FF', '#F3CBE9'],
        captureGradient: ['#D9D3FF', '#F3CBE9'],
        chromeSurface: 'rgba(118,112,148,0.08)',
        chromeBorder: 'rgba(118,112,148,0.14)',
        noticeBorder: 'rgba(118,112,148,0.08)',
        glassBackdrop: 'rgba(247,246,255,0.78)',
        captureButtonBg: '#544F69',
        tabBarBg: 'rgba(247,246,255,0.94)',
        captureCardText: '#544F69',
        captureCardPlaceholder: 'rgba(84,79,105,0.48)',
        captureCardBorder: 'rgba(137,130,168,0.16)',
        captureGlassFill: 'rgba(252,251,255,0.68)',
        captureGlassText: '#5D5770',
        captureGlassIcon: 'rgba(93,87,112,0.54)',
        captureGlassPlaceholder: 'rgba(93,87,112,0.34)',
        captureCameraOverlay: 'rgba(84,79,105,0.44)',
        captureCameraOverlayText: '#FBF9FF',
        androidTabShellBackground: 'rgba(252,251,255,0.9)',
        androidTabShellBorder: 'rgba(146,138,185,0.18)',
        androidTabShellShadow: 'rgba(162,153,214,0.12)',
        androidTabShellMutedBorder: 'rgba(146,138,185,0.12)',
        androidTabShellSelectedBorder: 'rgba(146,138,185,0.12)',
        androidTabShellSelectedGradient: ['rgba(255,255,255,0.96)', 'rgba(246,242,255,0.9)'],
        androidTabShellActive: '#706792',
        androidTabShellInactive: '#958FAA',
    },
    dark: {
        ...pastelPalette.dark,
        background: '#151521',
        surface: '#1F2030',
        card: '#292A3C',
        text: '#F7F4FF',
        secondaryText: '#C9C3E0',
        primary: '#C9C2FF',
        primarySoft: 'rgba(201,194,255,0.2)',
        onPrimary: '#4B4761',
        accent: '#F0C0E7',
        border: '#393A51',
        danger: '#FFB0C5',
        dangerSoft: 'rgba(255,176,197,0.18)',
        success: '#9BC8F0',
        gradient: ['#C9C2FF', '#F0C0E7'],
        captureGradient: ['#C9C2FF', '#F0C0E7'],
        chromeSurface: 'rgba(247,244,255,0.08)',
        chromeBorder: 'rgba(247,244,255,0.14)',
        noticeSurface: 'rgba(247,244,255,0.07)',
        noticeBorder: 'rgba(247,244,255,0.1)',
        glassOverlaySurface: 'rgba(41,42,60,0.54)',
        glassOverlayBorder: 'rgba(247,244,255,0.18)',
        glassBackdrop: 'rgba(21,21,33,0.64)',
        captureButtonBg: '#F7F4FF',
        tabBarBg: 'rgba(21,21,33,0.9)',
        captureCardText: '#292A3C',
        captureCardPlaceholder: 'rgba(41,42,60,0.48)',
        captureCardBorder: 'rgba(247,244,255,0.16)',
        captureGlassFill: 'rgba(41,42,60,0.34)',
        captureGlassText: '#F7F4FF',
        captureGlassIcon: 'rgba(247,244,255,0.78)',
        captureGlassPlaceholder: 'rgba(247,244,255,0.56)',
        captureCameraOverlay: 'rgba(21,21,33,0.7)',
        captureCameraOverlayBorder: 'rgba(247,244,255,0.16)',
        captureCameraOverlayText: '#F7F4FF',
        androidTabShellBackground: 'rgba(41,42,60,0.72)',
        androidTabShellBorder: 'rgba(247,244,255,0.12)',
        androidTabShellScrim: 'rgba(41,42,60,0.24)',
        androidTabShellMutedBackground: 'rgba(247,244,255,0.1)',
        androidTabShellMutedBorder: 'rgba(247,244,255,0.12)',
        androidTabShellSelectedBackground: 'rgba(247,244,255,0.22)',
        androidTabShellSelectedBorder: 'rgba(247,244,255,0.16)',
        androidTabShellSelectedGradient: ['rgba(247,244,255,0.26)', 'rgba(240,224,250,0.14)'],
        androidTabShellActive: '#F7F4FF',
        androidTabShellInactive: 'rgba(247,244,255,0.72)',
    },
};

export const ThemePalettes: Record<AppThemeType, ThemePalette> = {
    default: classicPalette,
    peach: peachPalette,
    matcha: matchaPalette,
    berry: berryPalette,
    'cotton-candy': pastelPalette,
};

// Compatibility export for existing callers that still expect light/dark tokens.
export const Colors = ThemePalettes[DEFAULT_APP_THEME];

// Compatibility export for existing callers that still read note gradients from the theme module.
export const CardGradients: [string, string][] = NOTE_CARD_GRADIENTS;

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'settings.theme';
const APP_THEME_STORAGE_KEY = 'settings.appTheme';
const VALID_THEMES: ThemeType[] = ['light', 'dark', 'system'];
const VALID_APP_THEMES: AppThemeType[] = APP_THEME_VALUES;

export function normalizeTheme(value: string | null): ThemeType {
    if (value && VALID_THEMES.includes(value as ThemeType)) {
        return value as ThemeType;
    }
    return 'system';
}

export function normalizeAppTheme(value: string | null): AppThemeType {
    if (value === 'pastel') {
        return 'cotton-candy';
    }

    if (value === 'classic') {
        return DEFAULT_APP_THEME;
    }

    if (value && VALID_APP_THEMES.includes(value as AppThemeType)) {
        return value as AppThemeType;
    }
    return DEFAULT_APP_THEME;
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

export function getThemePalette(appTheme: AppThemeType): ThemePalette {
    return ThemePalettes[appTheme] ?? ThemePalettes[DEFAULT_APP_THEME];
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
    const initialSavedAppTheme = getPersistentItemSync(APP_THEME_STORAGE_KEY);
    const [theme, setThemeState] = useState<ThemeType>(() => normalizeTheme(initialSavedTheme ?? null));
    const [appTheme, setAppThemeState] = useState<AppThemeType>(() =>
        normalizeAppTheme(initialSavedAppTheme ?? null)
    );
    const [systemTheme, setSystemTheme] = useState<ResolvedColorScheme>(() =>
        readSystemColorScheme()
    );
    const [themeReady, setThemeReady] = useState(
        () => initialSavedTheme !== undefined && initialSavedAppTheme !== undefined
    );

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

        let cancelled = false;

        Promise.all([
            getPersistentItem(THEME_STORAGE_KEY),
            getPersistentItem(APP_THEME_STORAGE_KEY),
        ]).then(([savedTheme, savedAppTheme]) => {
            if (cancelled) {
                return;
            }

            const nextTheme = normalizeTheme(savedTheme);
            const nextAppTheme = normalizeAppTheme(savedAppTheme);
            setThemeState(nextTheme);
            setAppThemeState(nextAppTheme);
            syncNativeColorScheme(nextTheme);
            setThemeReady(true);
        }).catch(() => {
            if (cancelled) {
                return;
            }

            syncNativeColorScheme('system');
            setThemeReady(true);
        });

        return () => {
            cancelled = true;
        };
    }, [theme, themeReady]);

    const setTheme = async (newTheme: ThemeType) => {
        setThemeState(newTheme);
        syncNativeColorScheme(newTheme);
        await setPersistentItem(THEME_STORAGE_KEY, newTheme);
    };

    const setAppTheme = async (nextAppTheme: AppThemeType) => {
        setAppThemeState(nextAppTheme);
        await setPersistentItem(APP_THEME_STORAGE_KEY, nextAppTheme);
    };

    const resolvedTheme = resolveThemePreference(theme, systemTheme);
    const isDark = resolvedTheme === 'dark';
    const palette = getThemePalette(appTheme);
    const colors = isDark ? palette.dark : palette.light;

    return (
        <ThemeContext.Provider value={{ theme, appTheme, isDark, setTheme, setAppTheme, colors, themeReady }}>
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

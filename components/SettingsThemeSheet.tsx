import { Ionicons } from '@expo/vector-icons';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export default function SettingsThemeSheet({ onClose }: { onClose: () => void }) {
    const { t } = useTranslation();
    const { theme, setTheme, colors, isDark } = useTheme();

    return (
        <View style={styles.container}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {t('settings.theme', 'Theme')}
            </Text>
            <View style={[styles.section, { backgroundColor: colors.card, marginHorizontal: 0 }]}>
                <SettingRow
                    icon="phone-portrait-outline"
                    iconColor={colors.primary}
                    label={t('settings.system', 'System')}
                    value={theme === 'system' ? '✓' : ''}
                    onPress={() => { setTheme('system'); onClose(); }}
                />
                <SettingRow
                    icon="sunny-outline"
                    iconColor={colors.primary}
                    label={t('settings.light', 'Light')}
                    value={theme === 'light' ? '✓' : ''}
                    onPress={() => { setTheme('light'); onClose(); }}
                />
                <SettingRow
                    icon="moon-outline"
                    iconColor={colors.primary}
                    label={t('settings.dark', 'Dark')}
                    value={theme === 'dark' ? '✓' : ''}
                    onPress={() => { setTheme('dark'); onClose(); }}
                    isLast
                />
            </View>
        </View>
    );
}

interface SettingRowProps {
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    label: string;
    value?: string;
    onPress: () => void;
    danger?: boolean;
    isLast?: boolean;
}

function SettingRow({ icon, iconColor, label, value, onPress, danger, isLast }: SettingRowProps) {
    const { colors } = useTheme();
    return (
        <Pressable
            style={[styles.row, !isLast && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
            onPress={onPress}
        >
            <View style={[styles.iconContainer, { backgroundColor: iconColor + '18' }]}>
                <Ionicons name={icon} size={18} color={iconColor} />
            </View>
            <Text style={[styles.rowLabel, { color: danger ? colors.danger : colors.text }]}>
                {label}
            </Text>
            {value ? (
                <Text style={[styles.rowValue, { color: colors.primary }]}>{value}</Text>
            ) : (
                <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} />
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'transparent',
        padding: 24,
        paddingBottom: 40,
    },
    sheetTitle: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 20,
        fontFamily: 'System',
    },
    section: {
        marginHorizontal: 16,
        borderRadius: 14,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 13,
        paddingHorizontal: 14,
    },
    iconContainer: {
        width: 30,
        height: 30,
        borderRadius: 7,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    rowLabel: {
        fontSize: 16,
        flex: 1,
        fontFamily: 'System',
    },
    rowValue: {
        fontSize: 15,
        fontWeight: '600',
        fontFamily: 'System',
    },
});

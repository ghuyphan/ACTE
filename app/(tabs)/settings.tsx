import { BottomSheet, Group, Host, RNHostView } from '@expo/ui/swift-ui';
import { environment, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import SettingsClearSheet from '../../components/SettingsClearSheet';
import SettingsLanguageSheet from '../../components/SettingsLanguageSheet';
import SettingsThemeSheet from '../../components/SettingsThemeSheet';
import { useNotes } from '../../hooks/useNotes';
import { useTheme } from '../../hooks/useTheme';

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


export default function SettingsScreen() {
    const { t, i18n } = useTranslation();
    const { theme, colors, isDark } = useTheme();
    const { notes } = useNotes();
    const router = useRouter();

    const [showTheme, setShowTheme] = useState(false);
    const [showLanguage, setShowLanguage] = useState(false);
    const [showClear, setShowClear] = useState(false);

    const themeLabel =
        theme === 'system'
            ? t('settings.system', 'System')
            : theme === 'dark'
                ? t('settings.dark', 'Dark')
                : t('settings.light', 'Light');

    return (
        <Host style={styles.container} colorScheme={isDark ? 'dark' : 'light'}>
            <ScrollView
                style={[styles.container, { backgroundColor: colors.background }]}
                contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}
            >
                <Text style={[styles.title, { color: colors.text }]}>
                    {t('settings.title', 'Settings')}
                </Text>

                {/* Preferences */}
                <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>
                    {t('settings.preferences', 'PREFERENCES')}
                </Text>
                <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <SettingRow
                        icon="language-outline"
                        iconColor={colors.primary}
                        label={t('settings.language', 'Language')}
                        value={i18n.language === 'en' ? 'English' : 'Tiếng Việt'}
                        onPress={() => setShowLanguage(true)}
                    />
                    <SettingRow
                        icon={isDark ? 'moon-outline' : 'sunny-outline'}
                        iconColor={colors.primary}
                        label={t('settings.theme', 'Theme')}
                        value={themeLabel}
                        onPress={() => setShowTheme(true)}
                        isLast
                    />
                </View>

                {/* Data */}
                <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>
                    {t('settings.data', 'DATA')}
                </Text>
                <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <SettingRow
                        icon="document-text-outline"
                        iconColor={colors.primary}
                        label={t('settings.noteCount', 'Saved Notes')}
                        value={`${notes.length}`}
                        onPress={() => { }}
                    />
                    <SettingRow
                        icon="trash-outline"
                        iconColor={colors.danger}
                        label={t('settings.clearAll', 'Clear All Notes')}
                        onPress={() => setShowClear(true)}
                        danger
                        isLast
                    />
                </View>

                {/* Account */}
                <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>
                    {t('settings.account', 'ACCOUNT')}
                </Text>
                <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <SettingRow
                        icon="person-outline"
                        iconColor={colors.secondaryText}
                        label={t('settings.login', 'Sign In')}
                        value={t('settings.notSignedIn', 'Not signed in')}
                        onPress={() => router.push('/auth')}
                        isLast
                    />
                </View>

                {/* About */}
                <View style={styles.aboutSection}>
                    <Text style={[styles.aboutText, { color: colors.secondaryText }]}>
                        ACTE v1.0.0
                    </Text>
                    <Text style={[styles.aboutText, { color: colors.secondaryText }]}>
                        {t('settings.about', 'So you never forget what she likes 💛')}
                    </Text>
                </View>
            </ScrollView>

            <BottomSheet isPresented={showTheme} onIsPresentedChange={setShowTheme} fitToContents>
                <Group modifiers={[presentationDragIndicator('visible'), environment('colorScheme', isDark ? 'dark' : 'light')]}>
                    <RNHostView matchContents>
                        <SettingsThemeSheet onClose={() => setShowTheme(false)} />
                    </RNHostView>
                </Group>
            </BottomSheet>

            <BottomSheet isPresented={showLanguage} onIsPresentedChange={setShowLanguage} fitToContents>
                <Group modifiers={[presentationDragIndicator('visible'), environment('colorScheme', isDark ? 'dark' : 'light')]}>
                    <RNHostView matchContents>
                        <SettingsLanguageSheet onClose={() => setShowLanguage(false)} />
                    </RNHostView>
                </Group>
            </BottomSheet>

            <BottomSheet isPresented={showClear} onIsPresentedChange={setShowClear} fitToContents>
                <Group modifiers={[presentationDragIndicator('visible'), environment('colorScheme', isDark ? 'dark' : 'light')]}>
                    <RNHostView matchContents>
                        <SettingsClearSheet onClose={() => setShowClear(false)} />
                    </RNHostView>
                </Group>
            </BottomSheet>
        </Host>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        paddingHorizontal: 20,
        marginBottom: 20,
        fontFamily: 'System',
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '500',
        letterSpacing: 0.3,
        paddingHorizontal: 20,
        marginBottom: 6,
        marginTop: 24,
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
    aboutSection: {
        alignItems: 'center',
        paddingVertical: 36,
        gap: 4,
    },
    aboutText: {
        fontSize: 13,
    },
});

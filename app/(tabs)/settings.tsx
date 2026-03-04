import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SettingsBottomSheet from '../../components/SettingsBottomSheet';
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

type BottomSheetType = 'language' | 'theme' | 'clear';

export default function SettingsScreen() {
    const { t, i18n } = useTranslation();
    const { theme, setTheme, colors, isDark } = useTheme();
    const { deleteAllNotes, notes } = useNotes();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const [sheetType, setSheetType] = useState<BottomSheetType>('language');

    const openSheet = (type: BottomSheetType) => {
        setSheetType(type);
        bottomSheetRef.current?.present();
    };

    const themeLabel =
        theme === 'system'
            ? t('settings.system', 'System')
            : theme === 'dark'
                ? t('settings.dark', 'Dark')
                : t('settings.light', 'Light');

    const renderSheetContent = () => {
        if (sheetType === 'language') {
            return (
                <View>
                    <Text style={[styles.sheetTitle, { color: colors.text }]}>
                        {t('settings.language', 'Language')}
                    </Text>
                    <View style={[styles.section, { backgroundColor: colors.card, marginHorizontal: 0 }]}>
                        <SettingRow
                            icon="language-outline"
                            iconColor={colors.primary}
                            label="English"
                            value={i18n.language === 'en' ? '✓' : ''}
                            onPress={() => { i18n.changeLanguage('en'); bottomSheetRef.current?.dismiss(); }}
                        />
                        <SettingRow
                            icon="language-outline"
                            iconColor={colors.primary}
                            label="Tiếng Việt"
                            value={i18n.language === 'vi' ? '✓' : ''}
                            onPress={() => { i18n.changeLanguage('vi'); bottomSheetRef.current?.dismiss(); }}
                            isLast
                        />
                    </View>
                </View>
            );
        }
        if (sheetType === 'theme') {
            return (
                <View>
                    <Text style={[styles.sheetTitle, { color: colors.text }]}>
                        {t('settings.theme', 'Theme')}
                    </Text>
                    <View style={[styles.section, { backgroundColor: colors.card, marginHorizontal: 0 }]}>
                        <SettingRow
                            icon="phone-portrait-outline"
                            iconColor={colors.primary}
                            label={t('settings.system', 'System')}
                            value={theme === 'system' ? '✓' : ''}
                            onPress={() => { setTheme('system'); bottomSheetRef.current?.dismiss(); }}
                        />
                        <SettingRow
                            icon="sunny-outline"
                            iconColor={colors.primary}
                            label={t('settings.light', 'Light')}
                            value={theme === 'light' ? '✓' : ''}
                            onPress={() => { setTheme('light'); bottomSheetRef.current?.dismiss(); }}
                        />
                        <SettingRow
                            icon="moon-outline"
                            iconColor={colors.primary}
                            label={t('settings.dark', 'Dark')}
                            value={theme === 'dark' ? '✓' : ''}
                            onPress={() => { setTheme('dark'); bottomSheetRef.current?.dismiss(); }}
                            isLast
                        />
                    </View>
                </View>
            );
        }
        if (sheetType === 'clear') {
            return (
                <View>
                    <Text style={[styles.sheetTitle, { color: colors.danger }]}>
                        {t('settings.clearAllTitle', 'Clear All Notes')}
                    </Text>
                    <Text style={{ fontSize: 16, marginBottom: 24, color: colors.secondaryText, lineHeight: 24 }}>
                        {t('settings.clearAllMsg', 'All your notes will be permanently deleted.')}
                    </Text>
                    <Pressable
                        style={[{ backgroundColor: colors.danger }, styles.primaryButton]}
                        onPress={() => { deleteAllNotes(); bottomSheetRef.current?.dismiss(); }}
                    >
                        <Text style={styles.primaryButtonText}>
                            {t('common.delete', 'Delete All')}
                        </Text>
                    </Pressable>
                    <Pressable
                        style={[{ backgroundColor: colors.border }, styles.secondaryButton]}
                        onPress={() => bottomSheetRef.current?.dismiss()}
                    >
                        <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                            {t('common.cancel', 'Cancel')}
                        </Text>
                    </Pressable>
                </View>
            );
        }
        return null;
    };

    return (
        <View style={styles.container}>
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
                        onPress={() => openSheet('language')}
                    />
                    <SettingRow
                        icon={isDark ? 'moon-outline' : 'sunny-outline'}
                        iconColor={colors.primary}
                        label={t('settings.theme', 'Theme')}
                        value={themeLabel}
                        onPress={() => openSheet('theme')}
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
                        onPress={() => openSheet('clear')}
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

            <SettingsBottomSheet ref={bottomSheetRef}>
                {renderSheetContent()}
            </SettingsBottomSheet>
        </View>
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
    sheetTitle: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 20,
        fontFamily: 'System',
    },
    primaryButton: {
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 12,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
        fontFamily: 'System',
    },
    secondaryButton: {
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    secondaryButtonText: {
        fontSize: 17,
        fontWeight: '600',
        fontFamily: 'System',
    },
});

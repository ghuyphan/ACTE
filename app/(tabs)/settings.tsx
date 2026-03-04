import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
    const { theme, setTheme, colors, isDark } = useTheme();
    const { deleteAllNotes, notes } = useNotes();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const toggleLanguage = () => {
        const nextLang = i18n.language === 'en' ? 'vi' : 'en';
        i18n.changeLanguage(nextLang);
    };

    const cycleTheme = () => {
        if (theme === 'system') setTheme('light');
        else if (theme === 'light') setTheme('dark');
        else setTheme('system');
    };

    const themeLabel =
        theme === 'system'
            ? t('settings.system', 'System')
            : theme === 'dark'
                ? t('settings.dark', 'Dark')
                : t('settings.light', 'Light');

    const handleClearAll = () => {
        Alert.alert(
            t('settings.clearAllTitle', 'Clear All Notes'),
            t('settings.clearAllMsg', 'All your notes will be permanently deleted.'),
            [
                { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                {
                    text: t('common.delete', 'Delete All'),
                    style: 'destructive',
                    onPress: () => deleteAllNotes(),
                },
            ]
        );
    };

    return (
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
                    onPress={toggleLanguage}
                />
                <SettingRow
                    icon={isDark ? 'moon-outline' : 'sunny-outline'}
                    iconColor={colors.primary}
                    label={t('settings.theme', 'Theme')}
                    value={themeLabel}
                    onPress={cycleTheme}
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
                    onPress={handleClearAll}
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
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '500',
        letterSpacing: 0.3,
        paddingHorizontal: 20,
        marginBottom: 6,
        marginTop: 24,
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
    },
    rowValue: {
        fontSize: 15,
        fontWeight: '600',
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

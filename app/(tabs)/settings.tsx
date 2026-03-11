import { BottomSheet, Button, Group, Host, HStack, List, Section, Spacer, Image as SwiftUIImage, Text as SwiftUIText, VStack } from '@expo/ui/swift-ui';
import { backgroundOverlay, cornerRadius, environment, font, foregroundStyle, frame, multilineTextAlignment, padding, presentationDragIndicator, scrollContentBackground } from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppSheetAlert from '../../components/AppSheetAlert';
import SettingsLanguageSheet from '../../components/SettingsLanguageSheet';
import SettingsThemeSheet from '../../components/SettingsThemeSheet';
import PrimaryButton from '../../components/ui/PrimaryButton';
import { Layout, Typography } from '../../constants/theme';
import { useAppSheetAlert } from '../../hooks/useAppSheetAlert';
import { useAuth } from '../../hooks/useAuth';
import { useNotes } from '../../hooks/useNotes';
import { useTheme } from '../../hooks/useTheme';

function AndroidSection({ title, children }: { title: string; children: React.ReactNode }) {
    const { colors } = useTheme();
    return (
        <View style={styles.androidSection}>
            <Text style={[styles.androidSectionTitle, { color: colors.secondaryText }]}>{title}</Text>
            <View style={[styles.androidSectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {children}
            </View>
        </View>
    );
}

function AndroidRow({
    label,
    value,
    onPress,
    destructive = false,
}: {
    label: string;
    value?: string;
    onPress?: () => void;
    destructive?: boolean;
}) {
    const { colors } = useTheme();

    return (
        <Pressable
            style={({ pressed }) => [
                styles.androidRow,
                pressed && onPress ? { opacity: 0.75 } : null,
            ]}
            onPress={onPress}
            disabled={!onPress}
        >
            <Text style={[styles.androidRowLabel, { color: destructive ? colors.danger : colors.text }]}>
                {label}
            </Text>
            {value ? (
                <Text style={[styles.androidRowValue, { color: destructive ? colors.danger : colors.primary }]}>
                    {value}
                </Text>
            ) : null}
        </Pressable>
    );
}

export default function SettingsScreen() {
    const { t, i18n } = useTranslation();
    const { theme, setTheme, colors, isDark } = useTheme();
    const { notes, deleteAllNotes } = useNotes();
    const { user, isAvailable } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { alertProps, showAlert } = useAppSheetAlert();

    const [showTheme, setShowTheme] = useState(false);
    const [showLanguage, setShowLanguage] = useState(false);
    const openAuthScreen = () => {
        router.push('/auth');
    };

    const themeLabel =
        theme === 'system'
            ? t('settings.system', 'System')
            : theme === 'dark'
                ? t('settings.dark', 'Dark')
                : t('settings.light', 'Light');

    const accountValue = useMemo(() => {
        if (!isAvailable) {
            return t('settings.localMode', 'Local mode');
        }
        if (user) {
            return user.displayName || user.email || t('settings.signedIn', 'Signed in');
        }
        return t('settings.notSignedIn', 'Not signed in');
    }, [isAvailable, t, user]);

    const promptClearAll = () => {
        showAlert({
            variant: 'error',
            title: t('settings.clearAllTitle', 'Clear All Notes'),
            message: t(
                'settings.clearAllMsg',
                'All your food notes will be permanently deleted. This action cannot be undone.'
            ),
            primaryAction: {
                label: t('common.delete', 'Delete'),
                variant: 'destructive',
                onPress: async () => {
                    await deleteAllNotes();
                },
            },
            secondaryAction: {
                label: t('common.cancel', 'Cancel'),
                variant: 'secondary',
            },
        });
    };

    if (Platform.OS !== 'ios') {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <ScrollView
                    contentContainerStyle={[
                        styles.androidContent,
                        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
                    ]}
                >
                    <Text style={[styles.title, { color: colors.text }]}>{t('settings.title', 'Settings')}</Text>

                    <AndroidSection title={t('settings.preferences', 'PREFERENCES')}>
                        <AndroidRow
                            label={t('settings.language', 'Language')}
                            value={i18n.language === 'en' ? 'English' : 'Tiếng Việt'}
                        />
                        <View style={styles.optionRow}>
                            <PrimaryButton
                                label="English"
                                variant={i18n.language === 'en' ? 'neutral' : 'secondary'}
                                onPress={() => {
                                    void i18n.changeLanguage('en');
                                }}
                                style={styles.optionButton}
                            />
                            <PrimaryButton
                                label="Tiếng Việt"
                                variant={i18n.language === 'vi' ? 'neutral' : 'secondary'}
                                onPress={() => {
                                    void i18n.changeLanguage('vi');
                                }}
                                style={styles.optionButton}
                            />
                        </View>

                        <AndroidRow label={t('settings.theme', 'Theme')} value={themeLabel} />
                        <View style={styles.optionRow}>
                            <PrimaryButton
                                label={t('settings.system', 'System')}
                                variant={theme === 'system' ? 'neutral' : 'secondary'}
                                onPress={() => {
                                    void setTheme('system');
                                }}
                                style={styles.optionButton}
                            />
                            <PrimaryButton
                                label={t('settings.light', 'Light')}
                                variant={theme === 'light' ? 'neutral' : 'secondary'}
                                onPress={() => {
                                    void setTheme('light');
                                }}
                                style={styles.optionButton}
                            />
                            <PrimaryButton
                                label={t('settings.dark', 'Dark')}
                                variant={theme === 'dark' ? 'neutral' : 'secondary'}
                                onPress={() => {
                                    void setTheme('dark');
                                }}
                                style={styles.optionButton}
                            />
                        </View>
                    </AndroidSection>

                    <AndroidSection title={t('settings.data', 'DATA')}>
                        <AndroidRow label={t('settings.noteCount', 'Saved Notes')} value={`${notes.length}`} />
                        <AndroidRow
                            label={t('settings.clearAll', 'Clear All Notes')}
                            onPress={promptClearAll}
                            destructive
                        />
                    </AndroidSection>

                    <AndroidSection title={t('settings.account', 'ACCOUNT')}>
                        {isAvailable ? (
                            <>
                                <AndroidRow
                                    label={user ? t('auth.signedInAs', 'Signed in as') : t('settings.login', 'Sign In')}
                                    value={accountValue}
                                    onPress={openAuthScreen}
                                />
                                <PrimaryButton
                                    label={
                                        user
                                            ? t('settings.manageAccount', 'Manage account')
                                            : t('settings.login', 'Sign In')
                                    }
                                    variant={user ? 'secondary' : 'neutral'}
                                    onPress={openAuthScreen}
                                />
                            </>
                        ) : (
                            <View style={styles.localModeCard}>
                                <Text style={[styles.localModeTitle, { color: colors.text }]}>
                                    {t('settings.localMode', 'Local mode')}
                                </Text>
                                <Text style={[styles.localModeText, { color: colors.secondaryText }]}>
                                    {t(
                                        'settings.localModeDetail',
                                        'This build is ready to use offline. Optional sync can be added later without changing your local notes.'
                                    )}
                                </Text>
                            </View>
                        )}
                    </AndroidSection>
                </ScrollView>
                <AppSheetAlert {...alertProps} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={{ paddingTop: insets.top + 16 }}>
                <Text style={[styles.title, { color: colors.text }]}>
                    {t('settings.title', 'Settings')}
                </Text>
            </View>
            <Host style={styles.container} colorScheme={isDark ? 'dark' : 'light'}>
                <List modifiers={[scrollContentBackground('hidden')]}>
                    <Section title={t('settings.preferences', 'PREFERENCES')}>
                        <Button onPress={() => setShowLanguage(true)}>
                            <HStack>
                                <HStack modifiers={[frame({ width: Layout.iconBadge, height: Layout.iconBadge, alignment: 'center' }), backgroundOverlay({ color: colors.primary + '18' }), cornerRadius(7), padding({ trailing: 12 })]}>
                                    <SwiftUIImage systemName="globe" color={colors.primary} size={18} />
                                </HStack>
                                <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>{t('settings.language', 'Language')}</SwiftUIText>
                                <Spacer />
                                <SwiftUIText modifiers={[foregroundStyle(colors.primary)]}>{i18n.language === 'en' ? 'English' : 'Tiếng Việt'}</SwiftUIText>
                            </HStack>
                        </Button>
                        <Button onPress={() => setShowTheme(true)}>
                            <HStack>
                                <HStack modifiers={[frame({ width: Layout.iconBadge, height: Layout.iconBadge, alignment: 'center' }), backgroundOverlay({ color: colors.primary + '18' }), cornerRadius(7), padding({ trailing: 12 })]}>
                                    <SwiftUIImage systemName={isDark ? 'moon' : 'sun.max'} color={colors.primary} size={18} />
                                </HStack>
                                <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>{t('settings.theme', 'Theme')}</SwiftUIText>
                                <Spacer />
                                <SwiftUIText modifiers={[foregroundStyle(colors.primary)]}>{themeLabel}</SwiftUIText>
                            </HStack>
                        </Button>
                    </Section>

                    <Section title={t('settings.data', 'DATA')}>
                        <HStack>
                            <HStack modifiers={[frame({ width: Layout.iconBadge, height: Layout.iconBadge, alignment: 'center' }), backgroundOverlay({ color: colors.primary + '18' }), cornerRadius(7), padding({ trailing: 12 })]}>
                                <SwiftUIImage systemName="doc.text" color={colors.primary} size={18} />
                            </HStack>
                            <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>{t('settings.noteCount', 'Saved Notes')}</SwiftUIText>
                            <Spacer />
                            <SwiftUIText modifiers={[foregroundStyle(colors.primary)]}>{`${notes.length}`}</SwiftUIText>
                        </HStack>
                        <Button onPress={promptClearAll}>
                            <HStack>
                                <HStack modifiers={[frame({ width: Layout.iconBadge, height: Layout.iconBadge, alignment: 'center' }), backgroundOverlay({ color: colors.danger + '18' }), cornerRadius(7), padding({ trailing: 12 })]}>
                                    <SwiftUIImage systemName="trash" color={colors.danger} size={18} />
                                </HStack>
                                <SwiftUIText modifiers={[foregroundStyle(colors.danger)]}>{t('settings.clearAll', 'Clear All Notes')}</SwiftUIText>
                            </HStack>
                        </Button>
                    </Section>

                    <Section
                        title={t('settings.account', 'ACCOUNT')}
                        footer={
                            <HStack>
                                <Spacer />
                                <VStack modifiers={[padding({ top: 36, bottom: 40 })]}>
                                    <SwiftUIText modifiers={[foregroundStyle(colors.secondaryText), font({ size: 13 }), multilineTextAlignment('center')]}>Charmly v1.0.0</SwiftUIText>
                                    <SwiftUIText modifiers={[foregroundStyle(colors.secondaryText), font({ size: 13 }), multilineTextAlignment('center'), padding({ top: 4 })]}>{t('settings.about', 'So you never forget what she likes 💛')}</SwiftUIText>
                                </VStack>
                                <Spacer />
                            </HStack>
                        }
                    >
                        {isAvailable ? (
                            <Button onPress={openAuthScreen}>
                                <HStack>
                                    <HStack modifiers={[frame({ width: Layout.iconBadge, height: Layout.iconBadge, alignment: 'center' }), backgroundOverlay({ color: colors.secondaryText + '18' }), cornerRadius(7), padding({ trailing: 12 })]}>
                                        <SwiftUIImage systemName="person" color={colors.secondaryText} size={18} />
                                    </HStack>
                                    <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>
                                        {user ? t('settings.manageAccount', 'Manage account') : t('settings.login', 'Sign In')}
                                    </SwiftUIText>
                                    <Spacer />
                                    <SwiftUIText modifiers={[foregroundStyle(colors.primary)]}>{accountValue}</SwiftUIText>
                                </HStack>
                            </Button>
                        ) : (
                            <HStack>
                                <HStack modifiers={[frame({ width: Layout.iconBadge, height: Layout.iconBadge, alignment: 'center' }), backgroundOverlay({ color: colors.primary + '18' }), cornerRadius(7), padding({ trailing: 12 })]}>
                                    <SwiftUIImage systemName="iphone.gen3" color={colors.primary} size={18} />
                                </HStack>
                                <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>{t('settings.localMode', 'Local mode')}</SwiftUIText>
                                <Spacer />
                                <SwiftUIText modifiers={[foregroundStyle(colors.primary)]}>{t('settings.localModeShort', 'Offline ready')}</SwiftUIText>
                            </HStack>
                        )}
                    </Section>
                </List>

                <BottomSheet isPresented={showTheme} onIsPresentedChange={setShowTheme} fitToContents>
                    <Group modifiers={[presentationDragIndicator('visible'), environment('colorScheme', isDark ? 'dark' : 'light')]}>
                        <SettingsThemeSheet onClose={() => setShowTheme(false)} />
                    </Group>
                </BottomSheet>

                <BottomSheet isPresented={showLanguage} onIsPresentedChange={setShowLanguage} fitToContents>
                    <Group modifiers={[presentationDragIndicator('visible'), environment('colorScheme', isDark ? 'dark' : 'light')]}>
                        <SettingsLanguageSheet onClose={() => setShowLanguage(false)} />
                    </Group>
                </BottomSheet>
            </Host>
            <AppSheetAlert {...alertProps} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    title: {
        ...Typography.screenTitle,
        paddingHorizontal: Layout.screenPadding,
        marginBottom: 20,
    },
    androidContent: {
        paddingHorizontal: Layout.screenPadding,
    },
    androidSection: {
        marginBottom: 24,
    },
    androidSectionTitle: {
        ...Typography.pill,
        marginBottom: 10,
    },
    androidSectionCard: {
        borderRadius: 24,
        borderWidth: 1,
        padding: 16,
        gap: 12,
    },
    androidRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 44,
    },
    androidRowLabel: {
        ...Typography.body,
        flex: 1,
    },
    androidRowValue: {
        ...Typography.pill,
        marginLeft: 12,
        textAlign: 'right',
    },
    optionRow: {
        flexDirection: 'row',
        gap: 8,
    },
    optionButton: {
        flex: 1,
        minHeight: 48,
    },
    localModeCard: {
        gap: 8,
    },
    localModeTitle: {
        ...Typography.button,
    },
    localModeText: {
        ...Typography.body,
    },
});

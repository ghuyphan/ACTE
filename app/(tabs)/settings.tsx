import { BottomSheet, Button, Group, Host, HStack, List, RNHostView, Section, Spacer, Image as SwiftUIImage, Text as SwiftUIText, VStack } from '@expo/ui/swift-ui';
import { backgroundOverlay, cornerRadius, environment, font, foregroundStyle, frame, multilineTextAlignment, padding, presentationDragIndicator, scrollContentBackground } from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SettingsClearSheet from '../../components/SettingsClearSheet';
import SettingsLanguageSheet from '../../components/SettingsLanguageSheet';
import SettingsThemeSheet from '../../components/SettingsThemeSheet';
import { useNotes } from '../../hooks/useNotes';
import { useTheme } from '../../hooks/useTheme';
import { isOlderIOS } from '../../utils/platform';

export default function SettingsScreen() {
    const { t, i18n } = useTranslation();
    const { theme, colors, isDark } = useTheme();
    const { notes } = useNotes();
    const router = useRouter();
    const insets = useSafeAreaInsets();

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
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={{ paddingTop: insets.top + 16 }}>
                <Text style={[styles.title, { color: colors.text }]}>
                    {t('settings.title', 'Settings')}
                </Text>
            </View>
            <Host style={styles.container} colorScheme={isDark ? 'dark' : 'light'}>
                <List modifiers={[scrollContentBackground('hidden')]}>
                    {/* Preferences */}
                    <Section title={t('settings.preferences', 'PREFERENCES')}>
                        <Button onPress={() => setShowLanguage(true)}>
                            <HStack>
                                <HStack modifiers={[frame({ width: 30, height: 30, alignment: 'center' }), backgroundOverlay({ color: colors.primary + '18' }), cornerRadius(7), padding({ trailing: 12 })]}>
                                    <SwiftUIImage systemName="globe" color={colors.primary} size={18} />
                                </HStack>
                                <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>{t('settings.language', 'Language')}</SwiftUIText>
                                <Spacer />
                                <SwiftUIText modifiers={[foregroundStyle(colors.primary)]}>{i18n.language === 'en' ? 'English' : 'Tiếng Việt'}</SwiftUIText>
                            </HStack>
                        </Button>
                        <Button onPress={() => setShowTheme(true)}>
                            <HStack>
                                <HStack modifiers={[frame({ width: 30, height: 30, alignment: 'center' }), backgroundOverlay({ color: colors.primary + '18' }), cornerRadius(7), padding({ trailing: 12 })]}>
                                    <SwiftUIImage systemName={isDark ? 'moon' : 'sun.max'} color={colors.primary} size={18} />
                                </HStack>
                                <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>{t('settings.theme', 'Theme')}</SwiftUIText>
                                <Spacer />
                                <SwiftUIText modifiers={[foregroundStyle(colors.primary)]}>{themeLabel}</SwiftUIText>
                            </HStack>
                        </Button>
                    </Section>

                    {/* Data */}
                    <Section title={t('settings.data', 'DATA')}>
                        <HStack>
                            <HStack modifiers={[frame({ width: 30, height: 30, alignment: 'center' }), backgroundOverlay({ color: colors.primary + '18' }), cornerRadius(7), padding({ trailing: 12 })]}>
                                <SwiftUIImage systemName="doc.text" color={colors.primary} size={18} />
                            </HStack>
                            <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>{t('settings.noteCount', 'Saved Notes')}</SwiftUIText>
                            <Spacer />
                            <SwiftUIText modifiers={[foregroundStyle(colors.primary)]}>{`${notes.length}`}</SwiftUIText>
                        </HStack>
                        <Button onPress={() => setShowClear(true)}>
                            <HStack>
                                <HStack modifiers={[frame({ width: 30, height: 30, alignment: 'center' }), backgroundOverlay({ color: colors.danger + '18' }), cornerRadius(7), padding({ trailing: 12 })]}>
                                    <SwiftUIImage systemName="trash" color={colors.danger} size={18} />
                                </HStack>
                                <SwiftUIText modifiers={[foregroundStyle(colors.danger)]}>{t('settings.clearAll', 'Clear All Notes')}</SwiftUIText>
                            </HStack>
                        </Button>
                    </Section>

                    {/* Account */}
                    <Section
                        title={t('settings.account', 'ACCOUNT')}
                        footer={
                            <HStack>
                                <Spacer />
                                <VStack modifiers={[padding({ top: 36, bottom: 40 })]}>
                                    <SwiftUIText modifiers={[foregroundStyle(colors.secondaryText), font({ size: 13 }), multilineTextAlignment('center')]}>ACTE v1.0.0</SwiftUIText>
                                    <SwiftUIText modifiers={[foregroundStyle(colors.secondaryText), font({ size: 13 }), multilineTextAlignment('center'), padding({ top: 4 })]}>{t('settings.about', 'So you never forget what she likes 💛')}</SwiftUIText>
                                </VStack>
                                <Spacer />
                            </HStack>
                        }
                    >
                        <Button onPress={() => router.push('/auth')}>
                            <HStack>
                                <HStack modifiers={[frame({ width: 30, height: 30, alignment: 'center' }), backgroundOverlay({ color: colors.secondaryText + '18' }), cornerRadius(7), padding({ trailing: 12 })]}>
                                    <SwiftUIImage systemName="person" color={colors.secondaryText} size={18} />
                                </HStack>
                                <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>{t('settings.login', 'Sign In')}</SwiftUIText>
                                <Spacer />
                                <SwiftUIText modifiers={[foregroundStyle(colors.primary)]}>{t('settings.notSignedIn', 'Not signed in')}</SwiftUIText>
                            </HStack>
                        </Button>
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

                <BottomSheet isPresented={showClear} onIsPresentedChange={setShowClear} fitToContents>
                    <Group modifiers={[presentationDragIndicator('visible'), environment('colorScheme', isDark ? 'dark' : 'light')]}>
                        <RNHostView matchContents>
                            <View style={isOlderIOS && { backgroundColor: colors.card, borderTopLeftRadius: 10, borderTopRightRadius: 10 }}>
                                <SettingsClearSheet onClose={() => setShowClear(false)} />
                            </View>
                        </RNHostView>
                    </Group>
                </BottomSheet>
            </Host>
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
});

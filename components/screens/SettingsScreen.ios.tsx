import {
  BottomSheet,
  Button,
  Group,
  Host,
  HStack,
  Image as SwiftUIImage,
  List,
  Section,
  Spacer,
  Text as SwiftUIText,
  VStack,
} from '@expo/ui/swift-ui';
import {
  backgroundOverlay,
  cornerRadius,
  environment,
  font,
  foregroundStyle,
  frame,
  multilineTextAlignment,
  padding,
  presentationDragIndicator,
  scrollContentBackground,
} from '@expo/ui/swift-ui/modifiers';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AppSheetAlert from '../AppSheetAlert';
import SettingsLanguageSheet from '../SettingsLanguageSheet';
import SettingsSyncSheet from '../SettingsSyncSheet';
import SettingsThemeSheet from '../SettingsThemeSheet';
import { Layout, Typography } from '../../constants/theme';
import { useSettingsScreenModel } from './useSettingsScreenModel';

export default function SettingsScreenIOS() {
  const {
    accountHint,
    accountValue,
    alertProps,
    colors,
    i18n,
    insets,
    isAuthAvailable,
    isDark,
    isPurchaseAvailable,
    notes,
    openAccountScreen,
    openPlusScreen,
    plusHint,
    plusValue,
    promptClearAll,
    setShowLanguage,
    setShowSync,
    setShowTheme,
    showLanguage,
    showSync,
    showTheme,
    syncValue,
    t,
    themeLabel,
  } = useSettingsScreenModel();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: insets.top + 16 }}>
        <Text style={[styles.title, { color: colors.text }]}>{t('settings.title', 'Settings')}</Text>
      </View>
      <Host style={styles.container} colorScheme={isDark ? 'dark' : 'light'}>
        <List modifiers={[scrollContentBackground('hidden')]}>
          <Section title={t('settings.preferences', 'Style & Language')}>
            <Button onPress={() => setShowLanguage(true)}>
              <HStack>
                <HStack
                  modifiers={[
                    frame({ width: Layout.iconBadge, height: Layout.iconBadge, alignment: 'center' }),
                    backgroundOverlay({ color: colors.primary + '18' }),
                    cornerRadius(7),
                    padding({ trailing: 12 }),
                  ]}
                >
                  <SwiftUIImage systemName="globe" color={colors.primary} size={18} />
                </HStack>
                <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>
                  {t('settings.language', 'Language')}
                </SwiftUIText>
                <Spacer />
                <SwiftUIText modifiers={[foregroundStyle(colors.primary)]}>
                  {i18n.language === 'en' ? 'English' : 'Tiếng Việt'}
                </SwiftUIText>
              </HStack>
            </Button>
            <Button onPress={() => setShowTheme(true)}>
              <HStack>
                <HStack
                  modifiers={[
                    frame({ width: Layout.iconBadge, height: Layout.iconBadge, alignment: 'center' }),
                    backgroundOverlay({ color: colors.primary + '18' }),
                    cornerRadius(7),
                    padding({ trailing: 12 }),
                  ]}
                >
                  <SwiftUIImage
                    systemName={isDark ? 'moon' : 'sun.max'}
                    color={colors.primary}
                    size={18}
                  />
                </HStack>
                <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>
                  {t('settings.theme', 'Theme')}
                </SwiftUIText>
                <Spacer />
                <SwiftUIText modifiers={[foregroundStyle(colors.primary)]}>{themeLabel}</SwiftUIText>
              </HStack>
            </Button>
          </Section>

          <Section title={t('settings.data', 'Memory Data')}>
            <HStack>
              <HStack
                modifiers={[
                  frame({ width: Layout.iconBadge, height: Layout.iconBadge, alignment: 'center' }),
                  backgroundOverlay({ color: colors.primary + '18' }),
                  cornerRadius(7),
                  padding({ trailing: 12 }),
                ]}
              >
                <SwiftUIImage systemName="doc.text" color={colors.primary} size={18} />
              </HStack>
              <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>
                {t('settings.noteCount', 'Saved Notes')}
              </SwiftUIText>
              <Spacer />
              <SwiftUIText modifiers={[foregroundStyle(colors.primary)]}>{`${notes.length}`}</SwiftUIText>
            </HStack>
            <Button onPress={promptClearAll}>
              <HStack>
                <HStack
                  modifiers={[
                    frame({ width: Layout.iconBadge, height: Layout.iconBadge, alignment: 'center' }),
                    backgroundOverlay({ color: colors.danger + '18' }),
                    cornerRadius(7),
                    padding({ trailing: 12 }),
                  ]}
                >
                  <SwiftUIImage systemName="trash" color={colors.danger} size={18} />
                </HStack>
                <SwiftUIText modifiers={[foregroundStyle(colors.danger)]}>
                  {t('settings.clearAll', 'Clear All Notes')}
                </SwiftUIText>
              </HStack>
            </Button>
          </Section>

          <Section
            title={t('settings.plusTitle', 'Noto Plus')}
            footer={
              <SwiftUIText
                modifiers={[
                  foregroundStyle(colors.secondaryText),
                  font({ size: 13 }),
                  multilineTextAlignment('leading'),
                  padding({ top: 8 }),
                ]}
              >
                {plusHint} {!isPurchaseAvailable && `\n${t('settings.plusUnavailable', 'Plus is coming soon.')}`}
              </SwiftUIText>
            }
          >
            <Button onPress={openPlusScreen}>
              <HStack>
                <HStack
                  modifiers={[
                    frame({ width: Layout.iconBadge, height: Layout.iconBadge, alignment: 'center' }),
                    backgroundOverlay({ color: colors.primary + '18' }),
                    cornerRadius(7),
                    padding({ trailing: 12 }),
                  ]}
                >
                  <SwiftUIImage systemName="sparkles" color={colors.primary} size={18} />
                </HStack>
                <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>
                  {t('settings.plusPlan', 'Edition')}
                </SwiftUIText>
                <Spacer />
                <SwiftUIText modifiers={[foregroundStyle(colors.primary), padding({ trailing: 4 })]}>
                  {plusValue}
                </SwiftUIText>
                <SwiftUIImage systemName="chevron.right" color={colors.secondaryText} size={14} />
              </HStack>
            </Button>
          </Section>

          <Section
            title={t('settings.account', 'Backup & Sync')}
            footer={
              <HStack>
                <Spacer />
                <VStack alignment="center" modifiers={[padding({ top: 44, bottom: 44 })]}>
                  <SwiftUIText
                    modifiers={[
                      foregroundStyle(colors.text),
                      font({ size: 14, weight: 'medium' }),
                      multilineTextAlignment('center'),
                      padding({ bottom: 10 }),
                    ]}
                  >
                    {t('settings.about', 'So you never forget what she likes 💛')}
                  </SwiftUIText>
                  <HStack modifiers={[padding({ top: 4 })]}>
                    <SwiftUIText
                      modifiers={[
                        foregroundStyle(colors.secondaryText + '99'),
                        font({ size: 11, weight: 'semibold' }),
                        multilineTextAlignment('center'),
                      ]}
                    >
                      Noto v1.0.0 · ノート
                    </SwiftUIText>
                  </HStack>
                  {accountHint ? (
                    <SwiftUIText
                      modifiers={[
                        foregroundStyle(colors.secondaryText + '88'),
                        font({ size: 11 }),
                        multilineTextAlignment('center'),
                        padding({ top: 12 }),
                      ]}
                    >
                      {accountHint}
                    </SwiftUIText>
                  ) : null}
                </VStack>
                <Spacer />
              </HStack>
            }
          >
            {isAuthAvailable ? (
              <>
                <Button onPress={openAccountScreen}>
                  <HStack>
                    <HStack
                      modifiers={[
                        frame({ width: Layout.iconBadge, height: Layout.iconBadge, alignment: 'center' }),
                        backgroundOverlay({ color: colors.primary + '18' }),
                        cornerRadius(7),
                        padding({ trailing: 12 }),
                      ]}
                    >
                      <SwiftUIImage systemName="person" color={colors.primary} size={18} />
                    </HStack>
                    <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>
                      {t('settings.accountEntry', 'Account')}
                    </SwiftUIText>
                    <Spacer />
                    <SwiftUIText modifiers={[foregroundStyle(colors.primary)]}>{accountValue}</SwiftUIText>
                  </HStack>
                </Button>
                <Button onPress={() => setShowSync(true)}>
                  <HStack>
                    <HStack
                      modifiers={[
                        frame({ width: Layout.iconBadge, height: Layout.iconBadge, alignment: 'center' }),
                        backgroundOverlay({ color: colors.primary + '18' }),
                        cornerRadius(7),
                        padding({ trailing: 12 }),
                      ]}
                    >
                      <SwiftUIImage
                        systemName="arrow.triangle.2.circlepath"
                        color={colors.primary}
                        size={18}
                      />
                    </HStack>
                    <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>
                      {t('settings.autoSync', 'Auto sync')}
                    </SwiftUIText>
                    <Spacer />
                    <SwiftUIText modifiers={[foregroundStyle(colors.primary)]}>{syncValue}</SwiftUIText>
                  </HStack>
                </Button>
              </>
            ) : (
              <HStack>
                <HStack
                  modifiers={[
                    frame({ width: Layout.iconBadge, height: Layout.iconBadge, alignment: 'center' }),
                    backgroundOverlay({ color: colors.primary + '18' }),
                    cornerRadius(7),
                    padding({ trailing: 12 }),
                  ]}
                >
                  <SwiftUIImage
                    systemName="person.crop.circle.badge.exclamationmark"
                    color={colors.primary}
                    size={18}
                  />
                </HStack>
                <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>
                  {t('settings.accountEntry', 'Account')}
                </SwiftUIText>
                <Spacer />
                <SwiftUIText modifiers={[foregroundStyle(colors.primary)]}>{accountValue}</SwiftUIText>
              </HStack>
            )}
          </Section>
        </List>

        <BottomSheet isPresented={showTheme} onIsPresentedChange={setShowTheme} fitToContents>
          <Group
            modifiers={[
              presentationDragIndicator('visible'),
              environment('colorScheme', isDark ? 'dark' : 'light'),
            ]}
          >
            <SettingsThemeSheet onClose={() => setShowTheme(false)} />
          </Group>
        </BottomSheet>

        <BottomSheet isPresented={showLanguage} onIsPresentedChange={setShowLanguage} fitToContents>
          <Group
            modifiers={[
              presentationDragIndicator('visible'),
              environment('colorScheme', isDark ? 'dark' : 'light'),
            ]}
          >
            <SettingsLanguageSheet onClose={() => setShowLanguage(false)} />
          </Group>
        </BottomSheet>

        <BottomSheet isPresented={showSync} onIsPresentedChange={setShowSync} fitToContents>
          <Group
            modifiers={[
              presentationDragIndicator('visible'),
              environment('colorScheme', isDark ? 'dark' : 'light'),
            ]}
          >
            <SettingsSyncSheet accountHint={accountHint} />
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
});

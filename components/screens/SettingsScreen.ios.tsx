import {
  Button,
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
  font,
  foregroundStyle,
  frame,
  multilineTextAlignment,
  padding,
  scrollContentBackground,
} from '@expo/ui/swift-ui/modifiers';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import AppSheet from '../AppSheet';
import AppSheetAlert from '../AppSheetAlert';
import SettingsLanguageSheet from '../SettingsLanguageSheet';
import SettingsSyncSheet from '../SettingsSyncSheet';
import SettingsThemeSheet from '../SettingsThemeSheet';
import { Layout } from '../../constants/theme';
import { useSettingsScreenModel } from './useSettingsScreenModel';

export default function SettingsScreenIOS() {
  const {
    accountHint,
    accountValue,
    appVersion,
    alertProps,
    colors,
    i18n,
    isAuthAvailable,
    isDark,
    isPurchaseAvailable,
    notes,
    openAccountScreen,
    openAccountDeletionHelpLink,
    openPlusScreen,
    openPrivacyPolicyLink,
    openSyncScreen,
    openSupportLink,
    plusValue,
    promptClearAll,
    setShowLanguage,
    setShowSync,
    setShowTheme,
    showAccountDeletionLink,
    showLanguage,
    showPrivacyPolicyLink,
    showSyncEntry,
    showSupportLink,
    showSync,
    showTheme,
    tier,
    syncValue,
    t,
    themeLabel,
  } = useSettingsScreenModel();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Host style={styles.container} colorScheme={isDark ? 'dark' : 'light'}>
        <List modifiers={[scrollContentBackground('hidden')]}>
          <Section title={t('settings.account', 'Backup & Sync')}>
            {isAuthAvailable ? (
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
            {showSyncEntry ? (
              <Button onPress={openSyncScreen}>
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
            ) : null}
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
                  {t('settings.plusTitle', 'Noto Plus')}
                </SwiftUIText>
                <Spacer />
                <SwiftUIText modifiers={[foregroundStyle(colors.primary), padding({ trailing: 4 })]}>
                  {tier === 'plus' ? t('settings.plusActive', 'Plus') : plusValue}
                </SwiftUIText>
                <SwiftUIImage systemName="chevron.right" color={colors.secondaryText} size={14} />
              </HStack>
            </Button>
          </Section>

          <Section title={t('settings.appearance', 'Appearance')}>
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

          <Section title={t('settings.notes', 'Notes')}>
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

          {(showPrivacyPolicyLink || showSupportLink || showAccountDeletionLink) ? (
            <Section title={t('settings.supportTitle', 'Support')}>
              {showPrivacyPolicyLink ? (
                <Button onPress={openPrivacyPolicyLink}>
                  <HStack>
                    <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>
                      {t('settings.privacyPolicy', 'Privacy Policy')}
                    </SwiftUIText>
                    <Spacer />
                    <SwiftUIImage systemName="arrow.up.right" color={colors.secondaryText} size={14} />
                  </HStack>
                </Button>
              ) : null}
              {showSupportLink ? (
                <Button onPress={openSupportLink}>
                  <HStack>
                    <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>
                      {t('settings.support', 'Support')}
                    </SwiftUIText>
                    <Spacer />
                    <SwiftUIImage systemName="arrow.up.right" color={colors.secondaryText} size={14} />
                  </HStack>
                </Button>
              ) : null}
              {showAccountDeletionLink ? (
                <Button onPress={openAccountDeletionHelpLink}>
                  <HStack>
                    <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>
                      {t('settings.accountDeletion', 'Account deletion help')}
                    </SwiftUIText>
                    <Spacer />
                    <SwiftUIImage systemName="arrow.up.right" color={colors.secondaryText} size={14} />
                  </HStack>
                </Button>
              ) : null}
            </Section>
          ) : null}

          <Section
            title={t('settings.aboutTitle', 'About')}
            footer={
              <HStack>
                <Spacer />
                <VStack alignment="center" modifiers={[padding({ top: 20, bottom: 20 })]}>
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
                </VStack>
                <Spacer />
              </HStack>
            }
          >
            <HStack>
              <HStack
                modifiers={[
                  frame({ width: Layout.iconBadge, height: Layout.iconBadge, alignment: 'center' }),
                  backgroundOverlay({ color: colors.primary + '18' }),
                  cornerRadius(7),
                  padding({ trailing: 12 }),
                ]}
              >
                <SwiftUIImage systemName="app.badge" color={colors.primary} size={18} />
              </HStack>
              <SwiftUIText modifiers={[foregroundStyle(colors.text)]}>
                {t('settings.version', 'Version')}
              </SwiftUIText>
              <Spacer />
              <SwiftUIText modifiers={[foregroundStyle(colors.primary)]}>{appVersion}</SwiftUIText>
            </HStack>
            {!isPurchaseAvailable ? (
              <HStack>
                <HStack
                  modifiers={[
                    frame({ width: Layout.iconBadge, height: Layout.iconBadge, alignment: 'center' }),
                    backgroundOverlay({ color: colors.secondaryText + '14' }),
                    cornerRadius(7),
                    padding({ trailing: 12 }),
                  ]}
                >
                  <SwiftUIImage
                    systemName="sparkles"
                    color={colors.secondaryText}
                    size={18}
                  />
                </HStack>
                <SwiftUIText modifiers={[foregroundStyle(colors.secondaryText)]}>
                  {t('settings.plusUnavailable', 'Plus is coming soon to this build.')}
                </SwiftUIText>
              </HStack>
            ) : null}
          </Section>
        </List>

        <AppSheet
          visible={showTheme}
          onClose={() => setShowTheme(false)}
          iosContentType="swift-ui"
        >
          <SettingsThemeSheet onClose={() => setShowTheme(false)} />
        </AppSheet>

        <AppSheet
          visible={showLanguage}
          onClose={() => setShowLanguage(false)}
          iosContentType="swift-ui"
        >
          <SettingsLanguageSheet onClose={() => setShowLanguage(false)} />
        </AppSheet>

        <AppSheet
          visible={showSync}
          onClose={() => setShowSync(false)}
          iosContentType="swift-ui"
        >
          <SettingsSyncSheet accountHint={accountHint} />
        </AppSheet>
      </Host>
      <AppSheetAlert {...alertProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

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
import { Layout } from '../../../constants/theme';
import AppSheet from '../../sheets/AppSheet';
import AppSheetAlert from '../../sheets/AppSheetAlert';
import SettingsHapticsSheet from '../../settings/SettingsHapticsSheet';
import SettingsLanguageSheet from '../../settings/SettingsLanguageSheet';
import SettingsSyncSheet from '../../settings/SettingsSyncSheet';
import SettingsThemeSheet from '../../settings/SettingsThemeSheet';
import { buildSettingsSections, type SettingsIconKey, type SettingsRowModel } from './settingsScreenSections';
import { useSettingsScreenModel } from './useSettingsScreenModel';

function getIOSSymbolName(icon: SettingsIconKey, isDark: boolean) {
  switch (icon) {
    case 'account':
      return 'person';
    case 'sync':
      return 'arrow.triangle.2.circlepath';
    case 'plus':
      return 'sparkles';
    case 'language':
      return 'globe';
    case 'theme':
      return isDark ? 'moon' : 'sun.max';
    case 'haptics':
      return 'iphone.radiowaves.left.and.right';
    case 'notes':
      return 'doc.text';
    case 'trash':
      return 'trash';
    case 'privacy':
      return 'shield';
    case 'support':
      return 'questionmark.circle';
    case 'accountDeletion':
      return 'person.crop.circle.badge.minus';
    case 'version':
      return 'app.badge';
    case 'plusUnavailable':
      return 'sparkles';
  }
}

function SettingsRowIOS({
  colors,
  isDark,
  row,
}: {
  colors: ReturnType<typeof useSettingsScreenModel>['colors'];
  isDark: boolean;
  row: SettingsRowModel;
}) {
  const iconColor = row.destructive ? colors.danger : row.icon === 'plusUnavailable' ? colors.secondaryText : colors.primary;
  const iconBackgroundColor = row.destructive
    ? `${colors.danger}18`
    : row.icon === 'plusUnavailable'
      ? `${colors.secondaryText}14`
      : `${colors.primary}18`;
  const content = (
    <HStack>
      <HStack
        modifiers={[
          frame({ width: Layout.iconBadge, height: Layout.iconBadge, alignment: 'center' }),
          backgroundOverlay({ color: iconBackgroundColor }),
          cornerRadius(7),
          padding({ trailing: 12 }),
        ]}
      >
        <SwiftUIImage systemName={getIOSSymbolName(row.icon, isDark)} color={iconColor} size={18} />
      </HStack>
      <SwiftUIText
        modifiers={[foregroundStyle(row.destructive ? colors.danger : row.icon === 'plusUnavailable' ? colors.secondaryText : colors.text)]}
      >
        {row.title}
      </SwiftUIText>
      <Spacer />
      {row.value ? (
        <SwiftUIText
          modifiers={[
            foregroundStyle(row.destructive ? colors.danger : row.icon === 'plusUnavailable' ? colors.secondaryText : colors.primary),
            ...(row.onPress || row.external ? [padding({ trailing: 4 })] : []),
          ]}
        >
          {row.value}
        </SwiftUIText>
      ) : null}
      {row.external ? (
        <SwiftUIImage systemName="arrow.up.right" color={colors.secondaryText} size={14} />
      ) : row.onPress && row.showChevron !== false ? (
        <SwiftUIImage systemName="chevron.right" color={colors.secondaryText} size={14} />
      ) : null}
    </HStack>
  );

  if (!row.onPress) {
    return content;
  }

  return <Button onPress={row.onPress}>{content}</Button>;
}

export default function SettingsScreenIOS() {
  const model = useSettingsScreenModel();
  const { about, sections } = buildSettingsSections(model);

  return (
    <View style={[styles.container, { backgroundColor: model.colors.background }]}>
      <Host style={styles.container} colorScheme={model.isDark ? 'dark' : 'light'}>
        <List modifiers={[scrollContentBackground('hidden')]}>
          {sections.map((section) => (
            <Section key={section.key} title={section.title}>
              {section.items.map((row) => (
                <SettingsRowIOS
                  key={row.key}
                  colors={model.colors}
                  isDark={model.isDark}
                  row={row}
                />
              ))}
            </Section>
          ))}

          <Section
            title={model.t('settings.aboutTitle', 'About')}
            footer={
              <HStack>
                <Spacer />
                <VStack alignment="center" modifiers={[padding({ top: 20, bottom: 20 })]}>
                  <SwiftUIText
                    modifiers={[
                      foregroundStyle(model.colors.text),
                      font({ size: 14, weight: 'medium' }),
                      multilineTextAlignment('center'),
                      padding({ bottom: 10 }),
                    ]}
                  >
                    {about.brandName}
                  </SwiftUIText>
                  <SwiftUIText
                    modifiers={[
                      foregroundStyle(model.colors.text),
                      font({ size: 14, weight: 'medium' }),
                      multilineTextAlignment('center'),
                      padding({ bottom: 10 }),
                    ]}
                  >
                    {about.tagline}
                  </SwiftUIText>
                </VStack>
                <Spacer />
              </HStack>
            }
          >
            <SettingsRowIOS
              colors={model.colors}
              isDark={model.isDark}
              row={{
                key: 'version',
                icon: 'version',
                title: about.versionLabel,
                value: about.versionValue,
              }}
            />
            {about.plusUnavailableMessage ? (
              <SettingsRowIOS
                colors={model.colors}
                isDark={model.isDark}
                row={{
                  key: 'plus-unavailable',
                  icon: 'plusUnavailable',
                  title: about.plusUnavailableMessage,
                }}
              />
            ) : null}
          </Section>
        </List>

        <AppSheet
          visible={model.showTheme}
          onClose={() => model.setShowTheme(false)}
          iosContentType="swift-ui"
        >
          <SettingsThemeSheet />
        </AppSheet>

        <AppSheet
          visible={model.showHaptics}
          onClose={() => model.setShowHaptics(false)}
          iosContentType="swift-ui"
        >
          <SettingsHapticsSheet />
        </AppSheet>

        <AppSheet
          visible={model.showLanguage}
          onClose={() => model.setShowLanguage(false)}
          iosContentType="swift-ui"
        >
          <SettingsLanguageSheet />
        </AppSheet>

        <AppSheet
          visible={model.showSync}
          onClose={() => model.setShowSync(false)}
          iosContentType="swift-ui"
        >
          <SettingsSyncSheet accountHint={model.accountHint} />
        </AppSheet>
      </Host>
      <AppSheetAlert {...model.alertProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

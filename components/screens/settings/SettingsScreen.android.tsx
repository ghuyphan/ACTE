import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Layout } from '../../../constants/theme';
import { useAndroidBottomTabOverlayInset } from '../../../hooks/useAndroidBottomTabOverlayInset';
import type { ThemeColors } from '../../../hooks/useTheme';
import AppSheet from '../../sheets/AppSheet';
import AppSheetAlert from '../../sheets/AppSheetAlert';
import SettingsHapticsSheetAndroid from '../../settings/SettingsHapticsSheet.android';
import SettingsLanguageSheetAndroid from '../../settings/SettingsLanguageSheet.android';
import SettingsSyncSheetAndroid from '../../settings/SettingsSyncSheet.android';
import SettingsThemeSheetAndroid from '../../settings/SettingsThemeSheet.android';
import {
  buildSettingsSections,
  type SettingsIconKey,
  type SettingsRowModel,
} from './settingsScreenSections';
import { useSettingsScreenModel } from './useSettingsScreenModel';

type SheetKey = 'language' | 'theme' | 'haptics' | 'sync' | null;

function getAndroidIconName(icon: SettingsIconKey): React.ComponentProps<typeof Ionicons>['name'] {
  switch (icon) {
    case 'account':
      return 'person-circle-outline';
    case 'sync':
      return 'sync-outline';
    case 'plus':
      return 'sparkles-outline';
    case 'language':
      return 'language-outline';
    case 'theme':
      return 'contrast-outline';
    case 'haptics':
      return 'phone-portrait-outline';
    case 'notes':
      return 'documents-outline';
    case 'trash':
      return 'trash-outline';
    case 'privacy':
      return 'shield-checkmark-outline';
    case 'support':
      return 'help-circle-outline';
    case 'accountDeletion':
      return 'person-remove-outline';
    case 'version':
      return 'apps-outline';
    case 'plusUnavailable':
      return 'sparkles-outline';
  }
}

function SectionTitle({
  colors,
  title,
}: {
  colors: ThemeColors;
  title: string;
}) {
  return <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>{title}</Text>;
}

function SettingsCard({
  children,
  colors,
}: {
  children: React.ReactNode;
  colors: ThemeColors;
}) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      {children}
    </View>
  );
}

function SettingRow({
  colors,
  row,
}: {
  colors: ThemeColors;
  row: SettingsRowModel;
}) {
  const iconColor = row.destructive ? colors.danger : row.icon === 'plusUnavailable' ? colors.secondaryText : colors.primary;
  const showChevron = row.external ? false : row.showChevron ?? Boolean(row.onPress);
  const content = (
    <>
      <View
        style={[
          styles.rowIcon,
          {
            backgroundColor:
              row.destructive
                ? `${colors.danger}12`
                : row.icon === 'plusUnavailable'
                  ? `${colors.secondaryText}12`
                  : colors.primarySoft,
          },
        ]}
      >
        <Ionicons name={getAndroidIconName(row.icon)} size={18} color={iconColor} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: row.destructive ? colors.danger : colors.text }]}>
          {row.title}
        </Text>
        {row.subtitle ? (
          <Text style={[styles.rowSubtitle, { color: colors.secondaryText }]}>{row.subtitle}</Text>
        ) : null}
      </View>
      <View style={styles.rowTrailing}>
        {row.value ? <Text style={[styles.rowValue, { color: colors.secondaryText }]}>{row.value}</Text> : null}
        {row.external ? <Ionicons name="open-outline" size={18} color={colors.secondaryText} /> : null}
        {showChevron ? <Ionicons name="chevron-forward" size={18} color={colors.secondaryText} /> : null}
      </View>
    </>
  );

  if (!row.onPress) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      android_ripple={{ color: `${colors.text}10` }}
      onPress={row.onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
    >
      {content}
    </Pressable>
  );
}

function CardDivider({ colors }: { colors: ThemeColors }) {
  return <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />;
}

export default function SettingsScreenAndroid() {
  const model = useSettingsScreenModel();
  const { about, sections } = buildSettingsSections(model);
  const bottomTabOverlayInset = useAndroidBottomTabOverlayInset();

  let sheetContent: React.ReactNode = null;
  const sheet: SheetKey = model.showTheme
    ? 'theme'
    : model.showLanguage
      ? 'language'
      : model.showHaptics
        ? 'haptics'
        : model.showSync
          ? 'sync'
          : null;

  if (sheet === 'theme') {
    sheetContent = <SettingsThemeSheetAndroid onClose={() => model.setShowTheme(false)} />;
  } else if (sheet === 'language') {
    sheetContent = <SettingsLanguageSheetAndroid onClose={() => model.setShowLanguage(false)} />;
  } else if (sheet === 'haptics') {
    sheetContent = <SettingsHapticsSheetAndroid onClose={() => model.setShowHaptics(false)} />;
  } else if (sheet === 'sync') {
    sheetContent = <SettingsSyncSheetAndroid accountHint={model.accountHint} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: model.colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: false,
          headerShadowVisible: false,
          title: model.t('settings.title', 'Settings'),
          headerTintColor: model.colors.text,
          headerTitleAlign: 'left',
          headerStyle: {
            backgroundColor: model.colors.background,
          },
          headerTitleStyle: [
            styles.stackHeaderTitle,
            {
              color: model.colors.text,
            },
          ],
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: 16, paddingBottom: model.insets.bottom + 32 + bottomTabOverlayInset },
        ]}
      >
        {sections.map((section) => (
          <View key={section.key} style={styles.section}>
            <SectionTitle colors={model.colors} title={section.title} />
            <SettingsCard colors={model.colors}>
              {section.items.map((row, index) => (
                <React.Fragment key={row.key}>
                  {index > 0 ? <CardDivider colors={model.colors} /> : null}
                  <SettingRow colors={model.colors} row={row} />
                </React.Fragment>
              ))}
            </SettingsCard>
          </View>
        ))}

        <View style={styles.footerInfo}>
          <View style={[styles.footerDivider, { backgroundColor: model.colors.border }]} />
          <Text style={[styles.footerAppName, { color: model.colors.text }]}>{about.brandName}</Text>
          <Text style={[styles.footerTagline, { color: model.colors.secondaryText }]}>{about.tagline}</Text>
          <Text style={[styles.footerVersion, { color: model.colors.secondaryText }]}>
            {about.versionLabel} {about.versionValue}
          </Text>
          {about.plusUnavailableMessage ? (
            <Text style={[styles.footerVersion, { color: model.colors.secondaryText }]}>
              {about.plusUnavailableMessage}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <AppSheet
        visible={sheet !== null}
        onClose={() => {
          model.setShowTheme(false);
          model.setShowHaptics(false);
          model.setShowLanguage(false);
          model.setShowSync(false);
        }}
        androidPresentation="edge"
      >
        {sheetContent}
      </AppSheet>

      <AppSheetAlert {...model.alertProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Layout.screenPadding,
  },
  stackHeaderTitle: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Noto Sans',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 10,
    marginLeft: 2,
    fontFamily: 'Noto Sans',
  },
  card: {
    borderWidth: 1,
    borderRadius: 22,
    overflow: 'hidden',
  },
  row: {
    minHeight: 64,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowPressed: {
    opacity: 0.92,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
  },
  rowTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginLeft: 12,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Noto Sans',
  },
  rowSubtitle: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Noto Sans',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '500',
    maxWidth: 140,
    textAlign: 'right',
    fontFamily: 'Noto Sans',
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 18,
  },
  footerInfo: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 8,
  },
  footerDivider: {
    width: 56,
    height: 4,
    borderRadius: 999,
    marginBottom: 18,
  },
  footerAppName: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Noto Sans',
  },
  footerTagline: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    textAlign: 'center',
    fontFamily: 'Noto Sans',
  },
  footerVersion: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    opacity: 0.72,
    fontFamily: 'Noto Sans',
    textAlign: 'center',
  },
});

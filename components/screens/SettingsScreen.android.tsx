import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppSheet from '../AppSheet';
import AppSheetAlert from '../AppSheetAlert';
import SettingsLanguageSheetAndroid from '../SettingsLanguageSheet.android';
import SettingsSyncSheetAndroid from '../SettingsSyncSheet.android';
import SettingsThemeSheetAndroid from '../SettingsThemeSheet.android';
import type { ThemeColors } from '../../hooks/useTheme';
import { Layout } from '../../constants/theme';
import { useSettingsScreenModel } from './useSettingsScreenModel';

type SheetKey = 'language' | 'theme' | 'sync' | null;

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
  icon,
  title,
  value,
  onPress,
  destructive = false,
}: {
  colors: ThemeColors;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string | null;
  value?: string | null;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const iconColor = destructive ? colors.danger : colors.primary;
  const content = (
    <>
      <View style={[styles.rowIcon, { backgroundColor: destructive ? `${colors.danger}12` : colors.primarySoft }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: destructive ? colors.danger : colors.text }]}>{title}</Text>
      </View>
      <View style={styles.rowTrailing}>
        {value ? <Text style={[styles.rowValue, { color: colors.secondaryText }]}>{value}</Text> : null}
        {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.secondaryText} /> : null}
      </View>
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      android_ripple={{ color: `${colors.text}10` }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed ? styles.rowPressed : null,
      ]}
    >
      {content}
    </Pressable>
  );
}

function CardDivider({ colors }: { colors: ThemeColors }) {
  return <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />;
}

export default function SettingsScreenAndroid() {
  const {
    accountHint,
    accountValue,
    appVersion,
    alertProps,
    colors,
    i18n,
    insets,
    isAuthAvailable,
    isPurchaseAvailable,
    notes,
    openAccountScreen,
    openAccountDeletionHelpLink,
    openPlusScreen,
    openPrivacyPolicyLink,
    openSyncScreen,
    openSupportLink,
    plusHint,
    plusValue,
    promptClearAll,
    showAccountDeletionLink,
    showPrivacyPolicyLink,
    showSyncEntry,
    showSupportLink,
    syncValue,
    t,
    themeLabel,
    user,
  } = useSettingsScreenModel();
  const [sheet, setSheet] = React.useState<SheetKey>(null);
  const languageCode = i18n.resolvedLanguage?.startsWith('vi') ? 'vi' : 'en';
  const languageLabel = languageCode === 'vi' ? 'Tiếng Việt' : 'English';
  const contentTopInset = 16;
  const accountSubtitle = !isAuthAvailable
    ? t(
        'settings.accountUnavailableMsg',
        'Account sign-in is unavailable right now. Your notes stay safely on this device.'
      )
    : !user
      ? t(
          'settings.accountSignedOutMsg',
          'Sign in to back up your notes and keep them synced across your devices.'
        )
      : null;
  const plusSubtitle = isPurchaseAvailable
    ? plusHint
    : t('settings.plusUnavailable', 'Plus is coming soon to this build.');
  const plusEntryValue = isPurchaseAvailable
    ? plusValue
    : t('settings.unavailableShort', 'Unavailable');

  let sheetContent: React.ReactNode = null;
  const sheetPresentation = 'edge';

  if (sheet === 'theme') {
    sheetContent = (
      <SettingsThemeSheetAndroid onClose={() => setSheet(null)} />
    );
  } else if (sheet === 'language') {
    sheetContent = (
      <SettingsLanguageSheetAndroid onClose={() => setSheet(null)} />
    );
  } else if (sheet === 'sync') {
    sheetContent = (
      <SettingsSyncSheetAndroid
        accountHint={accountHint}
        onClose={() => setSheet(null)}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: false,
          headerShadowVisible: false,
          title: t('settings.title', 'Settings'),
          headerTintColor: colors.text,
          headerTitleAlign: 'left',
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTitleStyle: [
            styles.stackHeaderTitle,
            {
              color: colors.text,
            },
          ],
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: contentTopInset, paddingBottom: insets.bottom + 32 },
        ]}
      >
        <View style={styles.section}>
          <SectionTitle colors={colors} title={t('settings.account', 'Account')} />
          <SettingsCard colors={colors}>
            <SettingRow
              colors={colors}
              icon="person-circle-outline"
              title={t('settings.accountEntry', 'Account')}
              subtitle={accountSubtitle}
              value={accountValue}
              onPress={isAuthAvailable ? openAccountScreen : undefined}
            />
            {showSyncEntry ? (
              <>
                <CardDivider colors={colors} />
                <SettingRow
                  colors={colors}
                  icon="sync-outline"
                  title={t('settings.autoSync', 'Auto sync')}
                  subtitle={accountHint ?? t('settings.autoSyncOnDetail', 'Your notes sync automatically while you are signed in.')}
                  value={syncValue}
                  onPress={openSyncScreen}
                />
                <CardDivider colors={colors} />
              </>
            ) : (
              <CardDivider colors={colors} />
            )}
            <SettingRow
              colors={colors}
              icon="sparkles-outline"
              title={t('settings.plusTitle', 'Noto Plus')}
              subtitle={plusSubtitle}
              value={plusEntryValue}
              onPress={isPurchaseAvailable ? openPlusScreen : undefined}
            />
          </SettingsCard>
        </View>

        <View style={styles.section}>
          <SectionTitle colors={colors} title={t('settings.appearance', 'Appearance')} />
          <SettingsCard colors={colors}>
            <SettingRow
              colors={colors}
              icon="language-outline"
              title={t('settings.language', 'Language')}
              value={languageLabel}
              onPress={() => setSheet('language')}
            />
            <CardDivider colors={colors} />
            <SettingRow
              colors={colors}
              icon="contrast-outline"
              title={t('settings.theme', 'Theme')}
              value={themeLabel}
              onPress={() => setSheet('theme')}
            />
          </SettingsCard>
        </View>

        <View style={styles.section}>
          <SectionTitle colors={colors} title={t('settings.notes', 'Notes')} />
          <SettingsCard colors={colors}>
            <SettingRow
              colors={colors}
              icon="documents-outline"
              title={t('settings.noteCount', 'Saved Notes')}
              value={`${notes.length}`}
            />
            <CardDivider colors={colors} />
            <SettingRow
              colors={colors}
              icon="trash-outline"
              title={t('settings.clearAll', 'Clear All Notes')}
              subtitle={t(
                'settings.clearAllMsg',
                'All your food notes will be permanently deleted. This action cannot be undone.'
              )}
              onPress={promptClearAll}
              destructive
            />
          </SettingsCard>
        </View>

        {(showPrivacyPolicyLink || showSupportLink || showAccountDeletionLink) ? (
          <View style={styles.section}>
            <SectionTitle colors={colors} title={t('settings.legal', 'Legal & Support')} />
            <SettingsCard colors={colors}>
              {showPrivacyPolicyLink ? (
                <SettingRow
                  colors={colors}
                  icon="shield-checkmark-outline"
                  title={t('settings.privacyPolicy', 'Privacy Policy')}
                  subtitle={t('settings.privacyPolicyHint', 'Review how Noto handles your data and permissions.')}
                  onPress={openPrivacyPolicyLink}
                />
              ) : null}
              {showPrivacyPolicyLink && (showSupportLink || showAccountDeletionLink) ? (
                <CardDivider colors={colors} />
              ) : null}
              {showSupportLink ? (
                <SettingRow
                  colors={colors}
                  icon="help-circle-outline"
                  title={t('settings.support', 'Support')}
                  subtitle={t('settings.supportHint', 'Contact support if sign-in, sync, or account issues need a hand.')}
                  onPress={openSupportLink}
                />
              ) : null}
              {showSupportLink && showAccountDeletionLink ? <CardDivider colors={colors} /> : null}
              {showAccountDeletionLink ? (
                <SettingRow
                  colors={colors}
                  icon="person-remove-outline"
                  title={t('settings.accountDeletion', 'Account deletion help')}
                  subtitle={t('settings.accountDeletionHint', 'Open the external deletion page or support contact for your store listing.')}
                  onPress={openAccountDeletionHelpLink}
                />
              ) : null}
            </SettingsCard>
          </View>
        ) : null}

        <View style={styles.footerInfo}>
          <View style={[styles.footerDivider, { backgroundColor: colors.border }]} />
          <Text style={[styles.footerAppName, { color: colors.text }]}>Noto</Text>
          <Text style={[styles.footerTagline, { color: colors.secondaryText }]}>
            {t('settings.about', 'So you never forget what she likes 💛')}
          </Text>
          <Text style={[styles.footerVersion, { color: colors.secondaryText }]}>
            {t('settings.version', 'Version')} {appVersion}
          </Text>
        </View>
      </ScrollView>

      <AppSheet
        visible={sheet !== null}
        onClose={() => setSheet(null)}
        androidPresentation={sheetPresentation}
      >
        {sheetContent}
      </AppSheet>

      <AppSheetAlert {...alertProps} />
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
    fontFamily: 'System',
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
    fontFamily: 'System',
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
    fontFamily: 'System',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '500',
    maxWidth: 140,
    textAlign: 'right',
    fontFamily: 'System',
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
    fontFamily: 'System',
  },
  footerTagline: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    textAlign: 'center',
    fontFamily: 'System',
  },
  footerVersion: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    opacity: 0.72,
    fontFamily: 'System',
  },
});

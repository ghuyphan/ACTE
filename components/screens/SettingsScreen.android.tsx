import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppSheet from '../AppSheet';
import AppSheetAlert from '../AppSheetAlert';
import SettingsLanguageSheetAndroid from '../SettingsLanguageSheet.android';
import SettingsSyncSheetAndroid from '../SettingsSyncSheet.android';
import SettingsThemeSheetAndroid from '../SettingsThemeSheet.android';
import PrimaryButton from '../ui/PrimaryButton';
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
  title,
  subtitle,
  value,
  onPress,
  destructive = false,
}: {
  colors: ThemeColors;
  title: string;
  subtitle?: string | null;
  value?: string | null;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const content = (
    <>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: destructive ? colors.danger : colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.rowSubtitle, { color: colors.secondaryText }]}>{subtitle}</Text>
        ) : null}
      </View>
      {value ? <Text style={[styles.rowValue, { color: colors.primary }]}>{value}</Text> : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <Pressable
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
  const contentTopInset = insets.top + 72;

  let sheetContent: React.ReactNode = null;
  const sheetPresentation = sheet === 'theme' || sheet === 'language' ? 'floating' : 'edge';

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
      <ScrollView
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
              title={t('settings.accountEntry', 'Account')}
              value={accountValue}
              onPress={isAuthAvailable ? openAccountScreen : undefined}
            />
            {showSyncEntry ? (
              <>
                <CardDivider colors={colors} />
                <SettingRow
                  colors={colors}
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
              title={t('settings.plusTitle', 'Noto Plus')}
              subtitle={plusHint}
              value={plusValue}
              onPress={openPlusScreen}
            />
            {isAuthAvailable ? (
              <View style={styles.cardAction}>
                <PrimaryButton
                  label={user ? t('settings.manageAccount', 'Manage account') : t('settings.login', 'Sign In')}
                  variant={user ? 'secondary' : 'primary'}
                  onPress={openAccountScreen}
                  style={styles.fullWidthButton}
                />
              </View>
            ) : null}
          </SettingsCard>
        </View>

        <View style={styles.section}>
          <SectionTitle colors={colors} title={t('settings.appearance', 'Appearance')} />
          <SettingsCard colors={colors}>
            <SettingRow
              colors={colors}
              title={t('settings.language', 'Language')}
              value={languageLabel}
              onPress={() => setSheet('language')}
            />
            <CardDivider colors={colors} />
            <SettingRow
              colors={colors}
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
              title={t('settings.noteCount', 'Saved Notes')}
              value={`${notes.length}`}
            />
            <CardDivider colors={colors} />
            <SettingRow
              colors={colors}
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
            <SectionTitle colors={colors} title={t('settings.supportTitle', 'Support')} />
            <SettingsCard colors={colors}>
              {showPrivacyPolicyLink ? (
                <SettingRow
                  colors={colors}
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
                  title={t('settings.support', 'Support')}
                  subtitle={t('settings.supportHint', 'Contact support if sign-in, sync, or account issues need a hand.')}
                  onPress={openSupportLink}
                />
              ) : null}
              {showSupportLink && showAccountDeletionLink ? <CardDivider colors={colors} /> : null}
              {showAccountDeletionLink ? (
                <SettingRow
                  colors={colors}
                  title={t('settings.accountDeletion', 'Account deletion help')}
                  subtitle={t('settings.accountDeletionHint', 'Open the external deletion page or support contact for your store listing.')}
                  onPress={openAccountDeletionHelpLink}
                />
              ) : null}
            </SettingsCard>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionTitle colors={colors} title={t('settings.aboutTitle', 'About')} />
          <SettingsCard colors={colors}>
            <SettingRow
              colors={colors}
              title={t('settings.version', 'Version')}
              value={appVersion}
            />
            <CardDivider colors={colors} />
            <SettingRow
              colors={colors}
              title="Noto"
              subtitle={t('settings.about', 'So you never forget what she likes 💛')}
              value={null}
            />
            {!isPurchaseAvailable ? (
              <>
                <CardDivider colors={colors} />
                <SettingRow
                  colors={colors}
                  title={t('settings.plusTitle', 'Noto Plus')}
                  subtitle={t('settings.plusUnavailable', 'Plus is coming soon to this build.')}
                  value={null}
                />
              </>
            ) : null}
          </SettingsCard>
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
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 10,
    marginLeft: 4,
    fontFamily: 'System',
  },
  card: {
    borderWidth: 1,
    borderRadius: 28,
    overflow: 'hidden',
  },
  row: {
    minHeight: 60,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  rowPressed: {
    opacity: 0.84,
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: 'System',
  },
  rowSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
    fontFamily: 'System',
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '700',
    maxWidth: 116,
    textAlign: 'right',
    fontFamily: 'System',
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
  },
  cardAction: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  fullWidthButton: {
    width: '100%',
  },
  cardFootnote: {
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 20,
    paddingBottom: 20,
    fontFamily: 'System',
  },
});

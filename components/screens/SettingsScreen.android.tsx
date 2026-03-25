import React, { Fragment } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppBottomSheet from '../AppBottomSheet';
import AppSheetAlert from '../AppSheetAlert';
import SettingsSyncSheetAndroid from '../SettingsSyncSheet.android';
import PrimaryButton from '../ui/PrimaryButton';
import type { ThemeColors } from '../../hooks/useTheme';
import { Layout, Typography } from '../../constants/theme';
import { useSettingsScreenModel } from './useSettingsScreenModel';
import { setAppLanguage } from '../../constants/i18n';

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

function SelectionSheet({
  colors,
  onSelect,
  options,
  selectedKey,
  selectedLabel,
  title,
}: {
  colors: ThemeColors;
  onSelect: (key: string) => void;
  options: { key: string; label: string }[];
  selectedKey: string;
  selectedLabel: string;
  title: string;
}) {
  return (
    <View style={styles.selectionSheet}>
      <Text style={[styles.selectionTitle, { color: colors.text }]}>{title}</Text>
      <View style={[styles.selectionCard, { backgroundColor: colors.surface }]}>
        {options.map((option, index) => {
          const selected = selectedKey === option.key;

          return (
            <Fragment key={option.key}>
              <Pressable
                onPress={() => onSelect(option.key)}
                style={({ pressed }) => [
                  styles.selectionRow,
                  pressed ? { opacity: 0.8 } : null,
                ]}
              >
                <Text style={[styles.selectionLabel, { color: colors.text }]}>{option.label}</Text>
                {selected ? (
                  <Text style={[styles.selectionValue, { color: colors.primary }]}>{selectedLabel}</Text>
                ) : null}
              </Pressable>
              {index < options.length - 1 ? (
                <View style={[styles.selectionDivider, { backgroundColor: colors.border }]} />
              ) : null}
            </Fragment>
          );
        })}
      </View>
    </View>
  );
}

function CardDivider({ colors }: { colors: ThemeColors }) {
  return <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />;
}

export default function SettingsScreenAndroid() {
  const {
    accountHint,
    accountValue,
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
    openSupportLink,
    plusHint,
    plusValue,
    promptClearAll,
    setTheme,
    showAccountDeletionLink,
    showPrivacyPolicyLink,
    showSupportLink,
    syncValue,
    t,
    theme,
    themeLabel,
    tier,
    user,
  } = useSettingsScreenModel();
  const [sheet, setSheet] = React.useState<SheetKey>(null);
  const languageCode = i18n.resolvedLanguage?.startsWith('vi') ? 'vi' : 'en';
  const languageLabel = languageCode === 'vi' ? 'Tiếng Việt' : 'English';

  let sheetContent: React.ReactNode = null;

  if (sheet === 'theme') {
    sheetContent = (
      <SelectionSheet
        colors={colors}
        onSelect={(value) => {
          void setTheme(value as 'system' | 'light' | 'dark');
          setSheet(null);
        }}
        options={[
          { key: 'system', label: t('settings.system', 'System') },
          { key: 'light', label: t('settings.light', 'Light') },
          { key: 'dark', label: t('settings.dark', 'Dark') },
        ]}
        selectedKey={theme}
        selectedLabel={t('common.done', 'Done')}
        title={t('settings.theme', 'Theme')}
      />
    );
  } else if (sheet === 'language') {
    sheetContent = (
      <SelectionSheet
        colors={colors}
        onSelect={(value) => {
          void setAppLanguage(value);
          setSheet(null);
        }}
        options={[
          { key: 'en', label: 'English' },
          { key: 'vi', label: 'Tiếng Việt' },
        ]}
        selectedKey={languageCode}
        selectedLabel={t('common.done', 'Done')}
        title={t('settings.language', 'Language')}
      />
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
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 },
        ]}
      >
        <Text style={[styles.title, { color: colors.text }]}>{t('settings.title', 'Settings')}</Text>

        <View style={styles.section}>
          <SectionTitle colors={colors} title={t('settings.preferences', 'Preferences')} />
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
          <SectionTitle colors={colors} title={t('settings.data', 'Data')} />
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

        <View style={styles.section}>
          <SectionTitle colors={colors} title={t('settings.plusTitle', 'Noto Plus')} />
          <SettingsCard colors={colors}>
            <SettingRow
              colors={colors}
              title={t('settings.plusPlan', 'Plan')}
              subtitle={plusHint}
              value={plusValue}
              onPress={openPlusScreen}
            />
            <View style={styles.cardAction}>
              <PrimaryButton
                label={tier === 'plus' ? t('settings.plusTitle', 'Noto Plus') : t('plus.cta', 'Upgrade to Plus')}
                variant={tier === 'plus' ? 'secondary' : 'primary'}
                onPress={openPlusScreen}
                style={styles.fullWidthButton}
              />
            </View>
            {!isPurchaseAvailable ? (
              <Text style={[styles.cardFootnote, { color: colors.secondaryText }]}>
                {t('settings.plusUnavailable', 'Plus is coming soon to this build.')}
              </Text>
            ) : null}
          </SettingsCard>
        </View>

        {(showPrivacyPolicyLink || showSupportLink || showAccountDeletionLink) ? (
          <View style={styles.section}>
            <SectionTitle colors={colors} title={t('settings.legal', 'Legal & Support')} />
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
          <SectionTitle colors={colors} title={t('settings.account', 'Account')} />
          <SettingsCard colors={colors}>
            <SettingRow
              colors={colors}
              title={t('settings.accountEntry', 'Account')}
              subtitle={accountHint ?? accountValue}
              value={accountValue}
              onPress={isAuthAvailable ? openAccountScreen : undefined}
            />
            <CardDivider colors={colors} />
            <SettingRow
              colors={colors}
              title={t('settings.autoSync', 'Auto sync')}
              subtitle={accountHint ?? t('settings.autoSyncOnDetail', 'Your notes sync automatically while you are signed in.')}
              value={syncValue}
              onPress={() => setSheet('sync')}
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
      </ScrollView>

      <AppBottomSheet visible={sheet !== null} onClose={() => setSheet(null)}>
        {sheetContent}
      </AppBottomSheet>

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
  title: {
    ...Typography.screenTitle,
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
  selectionCard: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  selectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
  },
  selectionLabel: {
    fontSize: 17,
    fontWeight: '500',
    fontFamily: 'System',
  },
  selectionRow: {
    minHeight: 56,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectionSheet: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  selectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    fontFamily: 'System',
  },
  selectionValue: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'System',
  },
});

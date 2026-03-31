import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Sheet } from '../constants/theme';
import { useSyncSheetDetails } from '../hooks/useSyncSheetDetails';
import { useTheme } from '../hooks/useTheme';
import AppSheetScaffold from './AppSheetScaffold';

export default function SettingsSyncSheetAndroid({
  accountHint,
  onClose,
}: {
  accountHint: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const {
    accountHintText,
    blockedCount,
    canManageSync,
    description,
    failedCount,
    isEnabled,
    pendingCount,
    queueSummary,
    setSyncEnabled,
    statusLabel,
  } = useSyncSheetDetails(accountHint);

  return (
    <AppSheetScaffold
      headerVariant="standard"
      title={t('settings.autoSync', 'Auto sync')}
      subtitle={description}
      contentContainerStyle={styles.content}
      useHorizontalPadding={false}
    >
      <View>
        <View style={styles.row}>
          <View style={styles.copy}>
            <Text style={[styles.label, { color: colors.text }]}>{t('settings.autoSync', 'Auto sync')}</Text>
            <Text style={[styles.hint, { color: colors.secondaryText }]}>{statusLabel}</Text>
          </View>
          {canManageSync ? (
            <Switch
              value={isEnabled}
              onValueChange={setSyncEnabled}
              trackColor={{ false: `${colors.border}`, true: `${colors.primary}66` }}
              thumbColor={isEnabled ? colors.primary : '#f4f3f4'}
            />
          ) : null}
        </View>
      </View>

      {canManageSync && accountHintText ? (
        <Text style={[styles.footnote, { color: colors.secondaryText }]}>{accountHintText}</Text>
      ) : null}

      {(pendingCount > 0 || failedCount > 0 || blockedCount > 0) ? (
        <Text style={[styles.footnote, { color: colors.secondaryText }]}>{queueSummary}</Text>
      ) : null}
    </AppSheetScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: Sheet.android.bottomPadding + 12,
  },
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: Sheet.android.horizontalPadding,
  },
  copy: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    fontFamily: 'System',
  },
  footnote: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 16,
    paddingHorizontal: Sheet.android.horizontalPadding,
    fontFamily: 'System',
  },
});

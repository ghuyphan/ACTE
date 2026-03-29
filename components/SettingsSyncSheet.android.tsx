import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
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
    canManageSync,
    description,
    isEnabled,
    queueSummary,
    setSyncEnabled,
    statusLabel,
  } = useSyncSheetDetails(accountHint);

  return (
    <AppSheetScaffold
      headerVariant="standard"
      title={t('settings.autoSync', 'Auto sync')}
      subtitle={description}
      footer={(
        <Pressable
          onPress={onClose}
          style={[styles.doneButton, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.doneButtonText, { color: colors.text }]}>{t('common.done', 'Done')}</Text>
        </Pressable>
      )}
    >
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={[styles.label, { color: colors.text }]}>{t('settings.autoSync', 'Auto sync')}</Text>
          <Text style={[styles.hint, { color: colors.secondaryText }]}>{statusLabel}</Text>
        </View>
        {canManageSync ? <Switch value={isEnabled} onValueChange={setSyncEnabled} /> : null}
      </View>

      {canManageSync && accountHintText ? (
        <Text style={[styles.footnote, { color: colors.secondaryText }]}>{accountHintText}</Text>
      ) : null}

      <Text style={[styles.footnote, { color: colors.secondaryText }]}>{queueSummary}</Text>
    </AppSheetScaffold>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 4,
  },
  copy: {
    flex: 1,
  },
  label: {
    fontSize: 17,
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
    paddingHorizontal: 4,
    fontFamily: 'System',
  },
  doneButton: {
    minHeight: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'System',
  },
});

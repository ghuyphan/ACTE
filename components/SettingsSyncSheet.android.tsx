import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useTheme } from '../hooks/useTheme';

export default function SettingsSyncSheetAndroid({
  accountHint,
  onClose,
}: {
  accountHint: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { isEnabled, setSyncEnabled } = useSyncStatus();

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>{t('settings.autoSync', 'Auto sync')}</Text>
      <Text style={[styles.description, { color: colors.secondaryText }]}>
        {t('settings.autoSyncOnDetail', 'Your notes sync automatically while you are signed in.')}
      </Text>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.row}>
          <View style={styles.copy}>
            <Text style={[styles.label, { color: colors.text }]}>{t('settings.autoSync', 'Auto sync')}</Text>
            <Text style={[styles.hint, { color: colors.secondaryText }]}>
              {isEnabled
                ? t('settings.autoSyncOnShort', 'On')
                : t('settings.autoSyncOff', 'Off')}
            </Text>
          </View>
          <Switch value={isEnabled} onValueChange={setSyncEnabled} />
        </View>
      </View>

      {accountHint ? (
        <Text style={[styles.footnote, { color: colors.secondaryText }]}>{accountHint}</Text>
      ) : null}

      <Pressable
        onPress={onClose}
        style={[styles.doneButton, { backgroundColor: colors.primary }]}
      >
        <Text style={[styles.doneButtonText, { color: colors.text }]}>{t('common.done', 'Done')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 10,
    fontFamily: 'System',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
    fontFamily: 'System',
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
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

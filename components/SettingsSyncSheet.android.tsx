import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useTheme } from '../hooks/useTheme';

export default function SettingsSyncSheetAndroid({
  accountHint,
}: {
  accountHint: string | null;
}) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { isEnabled, setSyncEnabled } = useSyncStatus();

  return (
    <View>
      <Text style={[styles.title, { color: colors.text }]}>{t('settings.autoSync', 'Auto sync')}</Text>
      <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
        {t('settings.autoSyncOnDetail', 'Your notes sync automatically while you are signed in.')}
      </Text>

      <View style={[styles.toggleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.toggleCopy}>
          <Text style={[styles.toggleTitle, { color: colors.text }]}>
            {t('settings.autoSync', 'Auto sync')}
          </Text>
          <Text style={[styles.toggleHint, { color: colors.secondaryText }]}>
            {isEnabled ? t('settings.autoSyncOnShort', 'On') : t('settings.autoSyncOff', 'Off')}
          </Text>
        </View>
        <Switch
          value={isEnabled}
          onValueChange={setSyncEnabled}
          thumbColor={isDark ? '#FFFFFF' : undefined}
          trackColor={{ false: colors.border, true: colors.primary }}
        />
      </View>

      {accountHint ? (
        <Text style={[styles.accountHint, { color: colors.secondaryText }]}>{accountHint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    fontFamily: 'System',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
    fontFamily: 'System',
  },
  toggleCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleCopy: {
    flex: 1,
    paddingRight: 12,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    fontFamily: 'System',
  },
  toggleHint: {
    fontSize: 13,
    fontFamily: 'System',
  },
  accountHint: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 14,
    fontFamily: 'System',
  },
});

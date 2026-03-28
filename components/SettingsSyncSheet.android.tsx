import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useSyncStatus } from '../hooks/useSyncStatus';
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
  const { user, isAuthAvailable } = useAuth();
  const { blockedCount, failedCount, isEnabled, pendingCount, setSyncEnabled } = useSyncStatus();
  const canManageSync = Boolean(user && isAuthAvailable);
  const description =
    canManageSync
      ? t('settings.autoSyncOnDetail', 'Your notes sync automatically while you are signed in.')
      : accountHint ??
        (isAuthAvailable
          ? t('settings.accountSignedOutMsg', 'Sign in to back up your notes and keep them synced across your devices.')
          : t('settings.accountUnavailableMsg', 'Account sign-in is unavailable right now. Your notes stay safely on this device.'));

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
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.row}>
          <View style={styles.copy}>
            <Text style={[styles.label, { color: colors.text }]}>{t('settings.autoSync', 'Auto sync')}</Text>
            <Text style={[styles.hint, { color: colors.secondaryText }]}>
              {canManageSync
                ? (isEnabled
                  ? t('settings.autoSyncOnShort', 'On')
                  : t('settings.autoSyncOff', 'Off'))
                : isAuthAvailable
                  ? t('settings.notSignedIn', 'Not signed in')
                  : t('settings.unavailableShort', 'Unavailable')}
            </Text>
          </View>
          {canManageSync ? <Switch value={isEnabled} onValueChange={setSyncEnabled} /> : null}
        </View>
      </View>

      {canManageSync && accountHint ? (
        <Text style={[styles.footnote, { color: colors.secondaryText }]}>{accountHint}</Text>
      ) : null}

      <Text style={[styles.footnote, { color: colors.secondaryText }]}>
        {t('settings.syncQueueSummary', 'Pending: {{pending}} · Retry: {{failed}} · Blocked: {{blocked}}', {
          pending: pendingCount,
          failed: failedCount,
          blocked: blockedCount,
        })}
      </Text>
    </AppSheetScaffold>
  );
}

const styles = StyleSheet.create({
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

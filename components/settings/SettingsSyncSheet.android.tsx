import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Sheet } from '../../constants/theme';
import { useSyncSheetDetails } from '../../hooks/useSyncSheetDetails';
import { useTheme } from '../../hooks/useTheme';
import AppSheetScaffold from '../sheets/AppSheetScaffold';
import { getSyncItemStatusLabel, getSyncOperationLabel } from './settingsSyncLabels';

export default function SettingsSyncSheetAndroid({
  accountHint,
}: {
  accountHint: string | null;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const {
    canManageSync,
    canRequestSync,
    description,
    diagnosticsMessage,
    isEnabled,
    queueSummary,
    recentQueueItems,
    requestSync,
    setSyncEnabled,
    showDiagnostics,
    status,
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

        <View style={[styles.section, styles.sectionCompact]}>
          <Pressable
            accessibilityRole="button"
            android_ripple={{ color: `${colors.primary}14` }}
            disabled={!canRequestSync}
            onPress={requestSync}
            style={({ pressed }) => [
              styles.syncButton,
              {
                backgroundColor: canRequestSync ? colors.primary : colors.border,
                opacity: canRequestSync ? (pressed ? 0.88 : 1) : 0.55,
              },
            ]}
          >
            <Text style={[styles.syncButtonLabel, { color: canRequestSync ? colors.background : colors.secondaryText }]}>
              {status === 'syncing'
                ? t('settings.syncing', 'Syncing...')
                : t('settings.syncNow', 'Sync with server')}
            </Text>
          </Pressable>
        </View>

        {showDiagnostics ? (
          <View style={styles.section}>
            {queueSummary ? (
              <Text style={[styles.hint, { color: colors.secondaryText }]}>{queueSummary}</Text>
            ) : null}
            {diagnosticsMessage ? (
              <Text style={[styles.hint, { color: colors.secondaryText }]}>{diagnosticsMessage}</Text>
            ) : null}

            <View style={styles.queueList}>
              {recentQueueItems.map((item) => (
                <View key={`${item.id}-${item.createdAt}`} style={[styles.queueItem, { borderColor: colors.border }]}>
                  <View style={styles.queueItemHeader}>
                    <Text style={[styles.queueItemTitle, { color: colors.text }]}>
                      {getSyncOperationLabel(t, item.operation)}
                      {item.entityId ? ` · ${item.entityId}` : ''}
                    </Text>
                    <Text style={[styles.queueItemStatus, { color: colors.secondaryText }]}>
                      {getSyncItemStatusLabel(t, item.status)}
                    </Text>
                  </View>
                  <Text style={[styles.queueItemMeta, { color: colors.secondaryText }]}>
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                  {item.blockedReason || item.lastError ? (
                    <Text style={[styles.queueItemHint, { color: item.blockedReason ? colors.danger : colors.secondaryText }]}>
                      {item.blockedReason ?? item.lastError}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </AppSheetScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: Sheet.android.bottomPadding + Sheet.android.comfortBottomPadding,
  },
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: Sheet.android.horizontalPadding,
  },
  section: {
    marginTop: 12,
    paddingTop: 16,
    paddingHorizontal: Sheet.android.horizontalPadding,
    gap: 12,
  },
  sectionCompact: {
    gap: 0,
  },
  copy: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Noto Sans',
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    fontFamily: 'Noto Sans',
  },
  syncButton: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  syncButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
  },
  queueList: {
    gap: 10,
  },
  queueItem: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  queueItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  queueItemTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Noto Sans',
  },
  queueItemStatus: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Noto Sans',
  },
  queueItemMeta: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Noto Sans',
  },
  queueItemHint: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Noto Sans',
  },
});

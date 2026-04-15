import { Button, Group, HStack, Text as SwiftUIText, Toggle, VStack } from '@expo/ui/swift-ui';
import { backgroundOverlay, cornerRadius, font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSyncSheetDetails } from '../../hooks/useSyncSheetDetails';
import { useTheme } from '../../hooks/useTheme';
import { isOlderIOS } from '../../utils/platform';
import { getSyncItemStatusLabel, getSyncOperationLabel } from './settingsSyncLabels';

export default function SettingsSyncSheet({
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

  const containerModifiers = [
    padding({ top: 24, leading: 24, trailing: 24, bottom: 40 }),
    ...(isOlderIOS ? [backgroundOverlay({ color: colors.card }), cornerRadius(10)] : []),
  ];

  return (
    <Group>
      <VStack modifiers={containerModifiers}>
        <HStack modifiers={[padding({ bottom: 8 })]}>
          <SwiftUIText modifiers={[font({ size: 22, weight: 'bold' }), foregroundStyle(colors.text)]}>
            {t('settings.autoSync', 'Auto sync')}
          </SwiftUIText>
        </HStack>

        <SwiftUIText
          modifiers={[
            foregroundStyle(colors.secondaryText),
            font({ size: 15 }),
            padding({ bottom: 24 }),
          ]}
        >
          {description}
        </SwiftUIText>

        <VStack
          modifiers={[
            backgroundOverlay({ color: canManageSync && isEnabled ? colors.primary + '10' : colors.card }),
            cornerRadius(16),
            padding({ all: 16 }),
          ]}
        >
          {canManageSync ? (
            <Toggle isOn={isEnabled} onIsOnChange={setSyncEnabled} label={t('settings.autoSync', 'Auto sync')} />
          ) : (
            <SwiftUIText modifiers={[foregroundStyle(colors.text), font({ size: 17, weight: 'semibold' })]}>
              {t('settings.autoSync', 'Auto sync')}
            </SwiftUIText>
          )}
          <SwiftUIText
            modifiers={[
              foregroundStyle(colors.secondaryText),
              font({ size: 13, weight: 'medium' }),
              padding({ top: 8 }),
            ]}
          >
            {statusLabel}
          </SwiftUIText>
        </VStack>

        <VStack
          modifiers={[
            backgroundOverlay({ color: colors.card }),
            cornerRadius(16),
            padding({ top: 14, leading: 16, trailing: 16, bottom: 14 }),
          ]}
        >
          <Button onPress={canRequestSync ? requestSync : undefined}>
            <HStack
              modifiers={[
                backgroundOverlay({ color: canRequestSync ? colors.primary : colors.border }),
                cornerRadius(12),
                padding({ top: 12, bottom: 12, leading: 14, trailing: 14 }),
              ]}
            >
              <SwiftUIText modifiers={[foregroundStyle(canRequestSync ? colors.background : colors.secondaryText), font({ size: 15, weight: 'bold' })]}>
                {status === 'syncing'
                  ? t('settings.syncing', 'Syncing...')
                  : t('settings.syncNow', 'Sync with server')}
              </SwiftUIText>
            </HStack>
          </Button>
        </VStack>

        {showDiagnostics ? (
          <VStack
            modifiers={[
              backgroundOverlay({ color: colors.card }),
              cornerRadius(16),
              padding({ top: 14, leading: 16, trailing: 16, bottom: 14 }),
            ]}
          >
            {queueSummary ? (
              <SwiftUIText modifiers={[foregroundStyle(colors.secondaryText), font({ size: 13 }), padding({ bottom: diagnosticsMessage || recentQueueItems.length > 0 ? 4 : 0 })]}>
                {queueSummary}
              </SwiftUIText>
            ) : null}
            {diagnosticsMessage ? (
              <SwiftUIText modifiers={[foregroundStyle(colors.secondaryText), font({ size: 13 }), padding({ bottom: recentQueueItems.length > 0 ? 10 : 0 })]}>
                {diagnosticsMessage}
              </SwiftUIText>
            ) : null}

            <VStack>
              {recentQueueItems.map((item) => (
                <VStack
                  key={`${item.id}-${item.createdAt}`}
                  modifiers={[
                    backgroundOverlay({ color: colors.background }),
                    cornerRadius(12),
                    padding({ top: 10, bottom: 10, leading: 12, trailing: 12 }),
                  ]}
                >
                  <HStack modifiers={[padding({ bottom: 2 })]}>
                    <SwiftUIText modifiers={[foregroundStyle(colors.text), font({ size: 13, weight: 'semibold' })]}>
                      {getSyncOperationLabel(t, item.operation)}
                      {item.entityId ? ` · ${item.entityId}` : ''}
                    </SwiftUIText>
                  </HStack>
                  <SwiftUIText modifiers={[foregroundStyle(colors.secondaryText), font({ size: 12 })]}>
                    {getSyncItemStatusLabel(t, item.status)} · {new Date(item.createdAt).toLocaleString()}
                  </SwiftUIText>
                  {item.blockedReason || item.lastError ? (
                    <SwiftUIText modifiers={[foregroundStyle(item.blockedReason ? colors.danger : colors.secondaryText), font({ size: 12 }), padding({ top: 2 })]}>
                      {item.blockedReason ?? item.lastError}
                    </SwiftUIText>
                  ) : null}
                </VStack>
              ))}
            </VStack>
          </VStack>
        ) : null}
      </VStack>
    </Group>
  );
}

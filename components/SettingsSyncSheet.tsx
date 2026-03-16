import { Group, HStack, Spacer, Text as SwiftUIText, Toggle, VStack } from '@expo/ui/swift-ui';
import { backgroundOverlay, cornerRadius, font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useTheme } from '../hooks/useTheme';
import { isOlderIOS } from '../utils/platform';

export default function SettingsSyncSheet({
  accountHint,
  onClose,
}: {
  accountHint: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { isEnabled, setSyncEnabled } = useSyncStatus();

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
          {t('settings.autoSyncOnDetail', 'Your notes sync automatically while you are signed in.')}
        </SwiftUIText>

        <VStack
          modifiers={[
            backgroundOverlay({ color: colors.primary + '10' }),
            cornerRadius(16),
            padding({ all: 16 }),
          ]}
        >
          <Toggle isOn={isEnabled} onIsOnChange={setSyncEnabled} label={t('settings.autoSync', 'Auto sync')} />
        </VStack>

        {accountHint && (
          <SwiftUIText
            modifiers={[
              foregroundStyle(colors.secondaryText + '99'),
              font({ size: 13 }),
              padding({ top: 16, leading: 4, trailing: 4 }),
            ]}
          >
            {accountHint}
          </SwiftUIText>
        )}
      </VStack>
    </Group>
  );
}

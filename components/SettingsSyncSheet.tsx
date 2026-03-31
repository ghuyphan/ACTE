import { Group, HStack, Text as SwiftUIText, Toggle, VStack } from '@expo/ui/swift-ui';
import { backgroundOverlay, cornerRadius, font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSyncSheetDetails } from '../hooks/useSyncSheetDetails';
import { useTheme } from '../hooks/useTheme';
import { isOlderIOS } from '../utils/platform';

export default function SettingsSyncSheet({
  accountHint,
}: {
  accountHint: string | null;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const {
    canManageSync,
    description,
    isEnabled,
    setSyncEnabled,
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
        </VStack>
      </VStack>
    </Group>
  );
}

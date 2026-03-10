import { Group, HStack, Picker, Text as SwiftUIText, VStack } from '@expo/ui/swift-ui';
import { backgroundOverlay, cornerRadius, font, foregroundStyle, padding, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { isOlderIOS } from '../utils/platform';

export default function SettingsThemeSheet({ onClose }: { onClose: () => void }) {
    const { t } = useTranslation();
    const { theme, setTheme, colors } = useTheme();
    const containerModifiers = [
        padding({ top: 24, leading: 24, trailing: 24, bottom: 40 }),
        ...(isOlderIOS ? [backgroundOverlay({ color: colors.card }), cornerRadius(10)] : []),
    ];

    return (
        <Group>
            <VStack modifiers={containerModifiers}>
                <HStack modifiers={[padding({ bottom: 16 })]}>
                    <SwiftUIText modifiers={[font({ size: 22, weight: 'bold' }), foregroundStyle(colors.text)]}>
                        {t('settings.theme', 'Theme')}
                    </SwiftUIText>
                </HStack>

                <Picker
                    selection={theme}
                    onSelectionChange={(selection) => { setTheme(selection as 'system' | 'light' | 'dark'); }}
                    modifiers={[pickerStyle('segmented'), padding({ bottom: 24 })]}
                >
                    <SwiftUIText modifiers={[tag('system')]}>{t('settings.system', 'System')}</SwiftUIText>
                    <SwiftUIText modifiers={[tag('light')]}>{t('settings.light', 'Light')}</SwiftUIText>
                    <SwiftUIText modifiers={[tag('dark')]}>{t('settings.dark', 'Dark')}</SwiftUIText>
                </Picker>
            </VStack>
        </Group>
    );
}

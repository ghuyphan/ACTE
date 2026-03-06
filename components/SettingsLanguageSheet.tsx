import { Group, HStack, Picker, Text as SwiftUIText, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, padding, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';

export default function SettingsLanguageSheet({ onClose }: { onClose: () => void }) {
    const { t, i18n } = useTranslation();
    const { colors } = useTheme();

    return (
        <Group>
            <VStack modifiers={[padding({ top: 24, leading: 24, trailing: 24, bottom: 40 })]}>
                <HStack modifiers={[padding({ bottom: 16 })]}>
                    <SwiftUIText modifiers={[font({ size: 22, weight: 'bold' }), foregroundStyle(colors.text)]}>
                        {t('settings.language', 'Language')}
                    </SwiftUIText>
                </HStack>

                <Picker
                    selection={i18n.language}
                    onSelectionChange={(selection) => { i18n.changeLanguage(selection as string); }}
                    modifiers={[pickerStyle('wheel'), frame({ height: 160 })]}
                >
                    <SwiftUIText modifiers={[tag('en')]}>English</SwiftUIText>
                    <SwiftUIText modifiers={[tag('vi')]}>Tiếng Việt</SwiftUIText>
                </Picker>
            </VStack>
        </Group>
    );
}

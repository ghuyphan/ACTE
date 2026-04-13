import { Group, HStack, Picker, Text as SwiftUIText, VStack } from '@expo/ui/swift-ui';
import {
  backgroundOverlay,
  cornerRadius,
  frame,
  font,
  foregroundStyle,
  padding,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { isOlderIOS } from '../../utils/platform';
import type { SettingsOption } from './settingsSelectionOptions';

type PickerStyleValue = 'wheel' | 'segmented';

export default function SettingsSelectionSheetIOS<Key extends string>({
  title,
  options,
  selectedKey,
  onSelect,
  pickerVariant,
  pickerHeight,
}: {
  title: string;
  options: SettingsOption<Key>[];
  selectedKey: Key;
  onSelect: (key: Key) => void;
  pickerVariant: PickerStyleValue;
  pickerHeight?: number;
}) {
  const { colors } = useTheme();
  const containerModifiers = [
    padding({ top: 24, leading: 24, trailing: 24, bottom: 40 }),
    ...(isOlderIOS ? [backgroundOverlay({ color: colors.card }), cornerRadius(10)] : []),
  ];
  const pickerModifiers = [
    pickerStyle(pickerVariant),
    ...(pickerVariant === 'segmented' ? [padding({ bottom: 24 })] : []),
    ...(typeof pickerHeight === 'number' ? [frame({ height: pickerHeight })] : []),
  ];

  return (
    <Group>
      <VStack modifiers={containerModifiers}>
        <HStack modifiers={[padding({ bottom: 16 })]}>
          <SwiftUIText modifiers={[font({ size: 22, weight: 'bold' }), foregroundStyle(colors.text)]}>
            {title}
          </SwiftUIText>
        </HStack>

        <Picker
          selection={selectedKey}
          onSelectionChange={(selection) => {
            onSelect(selection as Key);
          }}
          modifiers={pickerModifiers}
        >
          {options.map((option) => (
            <SwiftUIText key={option.key} modifiers={[tag(option.key)]}>
              {option.label}
            </SwiftUIText>
          ))}
        </Picker>
      </VStack>
    </Group>
  );
}

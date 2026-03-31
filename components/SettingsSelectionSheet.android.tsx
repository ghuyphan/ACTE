import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sheet } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import AppSheetScaffold from './AppSheetScaffold';

type SettingsSelectionOption = {
  key: string;
  label: string;
};

export default function SettingsSelectionSheetAndroid({
  title,
  options,
  selectedKey,
  onSelect,
  onClose,
}: {
  title: string;
  options: SettingsSelectionOption[];
  selectedKey: string;
  onSelect: (key: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const { colors } = useTheme();

  return (
    <AppSheetScaffold
      headerVariant="standard"
      title={title}
      contentContainerStyle={styles.content}
      useHorizontalPadding={false}
    >
      <View>
        {options.map((option) => {
          const selected = selectedKey === option.key;
          return (
            <View key={option.key}>
              <Pressable
                accessibilityRole="button"
                android_ripple={{ color: `${colors.text}10` }}
                style={({ pressed }) => [
                  styles.option,
                  selected ? { backgroundColor: `${colors.primary}12` } : null,
                  pressed ? styles.optionPressed : null,
                ]}
                onPress={() => {
                  void onSelect(option.key);
                  onClose();
                }}
              >
                <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off-outline'}
                  size={20}
                  color={selected ? colors.primary : colors.secondaryText}
                />
              </Pressable>
              {option.key !== options[options.length - 1]?.key ? (
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
              ) : null}
            </View>
          );
        })}
      </View>
    </AppSheetScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: Sheet.android.bottomPadding + 12,
  },
  option: {
    minHeight: 60,
    paddingHorizontal: Sheet.android.horizontalPadding,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionPressed: {
    opacity: 0.84,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Sheet.android.horizontalPadding,
  },
});

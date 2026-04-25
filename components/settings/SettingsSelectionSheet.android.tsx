import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sheet } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import AppSheetScaffold from '../sheets/AppSheetScaffold';

type SettingsSelectionOption = {
  key: string;
  label: string;
  swatchColors?: readonly [string, string];
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
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ selected }}
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
                <View style={styles.optionCopy}>
                  {option.swatchColors ? (
                    <View style={[styles.swatchWrap, { borderColor: colors.border }]}>
                      <View style={[styles.swatchHalf, { backgroundColor: option.swatchColors[0] }]} />
                      <View style={[styles.swatchHalf, { backgroundColor: option.swatchColors[1] }]} />
                    </View>
                  ) : null}
                  <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
                </View>
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
    paddingBottom: Sheet.android.bottomPadding + Sheet.android.comfortBottomPadding,
  },
  option: {
    minHeight: 60,
    paddingHorizontal: Sheet.android.horizontalPadding,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  optionPressed: {
    opacity: 0.84,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Noto Sans',
    flexShrink: 1,
  },
  optionCopy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  swatchWrap: {
    width: 34,
    height: 22,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  swatchHalf: {
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Sheet.android.horizontalPadding,
  },
});

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <AppSheetScaffold
      headerVariant="standard"
      title={title}
    >
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {options.map((option) => {
          const selected = selectedKey === option.key;
          return (
            <Pressable
              key={option.key}
              style={[
                styles.option,
                selected ? { backgroundColor: colors.primarySoft } : null,
              ]}
              onPress={() => {
                void onSelect(option.key);
                onClose();
              }}
            >
              <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
              <Text
                style={[
                  styles.optionValue,
                  { color: selected ? colors.primary : colors.secondaryText },
                ]}
              >
                {selected ? t('common.done', 'Done') : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </AppSheetScaffold>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  option: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  optionValue: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'System',
  },
});

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

const OPTIONS: Array<{ key: 'system' | 'light' | 'dark'; labelKey: string; fallback: string }> = [
  { key: 'system', labelKey: 'settings.system', fallback: 'System' },
  { key: 'light', labelKey: 'settings.light', fallback: 'Light' },
  { key: 'dark', labelKey: 'settings.dark', fallback: 'Dark' },
];

export default function SettingsThemeSheetAndroid({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { theme, setTheme, colors } = useTheme();

  return (
    <View>
      <Text style={[styles.title, { color: colors.text }]}>{t('settings.theme', 'Theme')}</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {OPTIONS.map((option) => {
          const selected = theme === option.key;
          return (
            <Pressable
              key={option.key}
              style={[
                styles.option,
                selected ? { backgroundColor: colors.primarySoft } : null,
              ]}
              onPress={() => {
                void setTheme(option.key);
                onClose();
              }}
            >
              <Text style={[styles.optionLabel, { color: colors.text }]}>
                {t(option.labelKey, option.fallback)}
              </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
    fontFamily: 'System',
  },
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

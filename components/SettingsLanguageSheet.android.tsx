import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export default function SettingsLanguageSheetAndroid({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();

  return (
    <View>
      <Text style={[styles.title, { color: colors.text }]}>{t('settings.language', 'Language')}</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {[
          { code: 'en', label: 'English' },
          { code: 'vi', label: 'Tiếng Việt' },
        ].map((option) => {
          const selected = i18n.language === option.code;
          return (
            <Pressable
              key={option.code}
              style={[
                styles.option,
                selected ? { backgroundColor: colors.primarySoft } : null,
              ]}
              onPress={() => {
                void i18n.changeLanguage(option.code);
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

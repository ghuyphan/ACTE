import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { setAppLanguage } from '../constants/i18n';
import { useTheme } from '../hooks/useTheme';
import AppSheetScaffold from './AppSheetScaffold';

export default function SettingsLanguageSheetAndroid({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();

  return (
    <AppSheetScaffold
      headerVariant="standard"
      title={t('settings.language', 'Language')}
    >
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
                void setAppLanguage(option.code);
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

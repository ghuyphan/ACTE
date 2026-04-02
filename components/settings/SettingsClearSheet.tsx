import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useNotes } from '../../hooks/useNotes';
import { useTheme } from '../../hooks/useTheme';
import SheetFooterButton from '../sheets/SheetFooterButton';

export default function SettingsClearSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { deleteAllNotes } = useNotes();

  return (
    <View style={styles.container}>
      <Text style={[styles.sheetTitle, { color: colors.danger }]}>
        {t('settings.clearAllTitle', 'Clear All Notes')}
      </Text>
      <Text style={{ fontSize: 16, marginBottom: 24, color: colors.secondaryText, lineHeight: 24 }}>
        {t('settings.clearAllMsg', 'All your notes will be permanently deleted.')}
      </Text>
      <SheetFooterButton
        label={t('common.delete', 'Delete All')}
        variant="destructive"
        onPress={() => {
          deleteAllNotes();
          onClose();
        }}
      />
      <SheetFooterButton
        label={t('common.cancel', 'Cancel')}
        style={styles.secondaryButton}
        onPress={onClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    padding: 24,
    paddingBottom: 40,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 20,
    fontFamily: 'Noto Sans',
  },
  secondaryButton: {
    marginTop: 12,
  },
});


import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNotes } from '../hooks/useNotes';
import { useTheme } from '../hooks/useTheme';

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
            <Pressable
                style={[{ backgroundColor: colors.danger }, styles.primaryButton]}
                onPress={() => { deleteAllNotes(); onClose(); }}
            >
                <Text style={styles.primaryButtonText}>
                    {t('common.delete', 'Delete All')}
                </Text>
            </Pressable>
            <Pressable
                style={[{ backgroundColor: colors.border }, styles.secondaryButton]}
                onPress={onClose}
            >
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                    {t('common.cancel', 'Cancel')}
                </Text>
            </Pressable>
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
        fontFamily: 'System',
    },
    primaryButton: {
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 12,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
        fontFamily: 'System',
    },
    secondaryButton: {
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    secondaryButtonText: {
        fontSize: 17,
        fontWeight: '600',
        fontFamily: 'System',
    },
});

import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React, { useRef } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import AppSheet from '../../sheets/AppSheet';
import AppSheetScaffold from '../../sheets/AppSheetScaffold';
import PrimaryButton from '../../ui/PrimaryButton';
import { Typography } from '../../../constants/theme';
import { useAndroidKeyboardBlurOnHide } from '../../../hooks/ui/useAndroidKeyboardBlurOnHide';
import { useTheme } from '../../../hooks/useTheme';

const SheetTextInput = Platform.OS === 'android' ? BottomSheetTextInput : TextInput;

interface UsernameEditSheetProps {
  visible: boolean;
  value: string;
  errorMessage: string | null;
  helperText: string;
  isSaving: boolean;
  onChangeValue: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  title: string;
  subtitle: string;
  saveLabel: string;
}

export default function UsernameEditSheet({
  visible,
  value,
  errorMessage,
  helperText,
  isSaving,
  onChangeValue,
  onClose,
  onSave,
  title,
  subtitle,
  saveLabel,
}: UsernameEditSheetProps) {
  const { colors } = useTheme();
  const inputRef = useRef<{ blur: () => void; isFocused?: () => boolean } | null>(null);

  useAndroidKeyboardBlurOnHide({
    enabled: visible,
    refs: [inputRef],
  });

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      androidKeyboardInputMode="adjustPan"
    >
      <AppSheetScaffold
        headerVariant="standard"
        title={title}
        subtitle={subtitle}
        footer={
          <View style={styles.footer}>
            <PrimaryButton
              label={saveLabel}
              onPress={onSave}
              loading={isSaving}
              testID="profile-username-save-button"
            />
          </View>
        }
      >
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.secondaryText }]}>@</Text>
          <SheetTextInput
            ref={(node) => {
              inputRef.current = node ?? null;
            }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            autoFocus
            value={value}
            onChangeText={onChangeValue}
            onSubmitEditing={onSave}
            returnKeyType="done"
            placeholder="noto.id"
            placeholderTextColor={colors.secondaryText}
            style={[
              styles.fieldInput,
              {
                backgroundColor: colors.surface,
                borderColor: errorMessage ? colors.danger : colors.border,
                color: colors.text,
              },
            ]}
            testID="profile-username-input"
          />
        </View>
        <Text
          style={[
            styles.helperText,
            {
              color: errorMessage ? colors.danger : colors.secondaryText,
            },
          ]}
        >
          {errorMessage ?? helperText}
        </Text>
      </AppSheetScaffold>
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fieldLabel: {
    ...Typography.body,
    fontSize: 22,
    fontWeight: '700',
  },
  fieldInput: {
    flex: 1,
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    ...Typography.body,
  },
  helperText: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  footer: {
    width: '100%',
  },
});

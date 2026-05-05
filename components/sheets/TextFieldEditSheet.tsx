import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React, { useRef } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Typography } from '../../constants/theme';
import { useAndroidKeyboardBlurOnHide } from '../../hooks/ui/useAndroidKeyboardBlurOnHide';
import { useTheme } from '../../hooks/useTheme';
import AppSheet from './AppSheet';
import AppSheetScaffold from './AppSheetScaffold';
import PrimaryButton from '../ui/PrimaryButton';

const SheetTextInput = Platform.OS === 'android' ? BottomSheetTextInput : TextInput;

interface TextFieldEditSheetProps {
  visible: boolean;
  value: string;
  errorMessage: string | null;
  helperText: string;
  isSaving: boolean;
  onChangeValue: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  title: string;
  subtitle?: string;
  saveLabel: string;
  leadingLabel?: string;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: React.ComponentProps<typeof TextInput>['autoComplete'];
  testIDPrefix?: string;
}

export default function TextFieldEditSheet({
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
  leadingLabel,
  placeholder,
  autoCapitalize = 'sentences',
  autoComplete,
  testIDPrefix = 'text-field-edit',
}: TextFieldEditSheetProps) {
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
              testID={`${testIDPrefix}-save-button`}
            />
          </View>
        }
      >
        <View style={styles.fieldGroup}>
          {leadingLabel ? (
            <Text style={[styles.fieldLabel, { color: colors.secondaryText }]}>
              {leadingLabel}
            </Text>
          ) : null}
          <SheetTextInput
            ref={(node) => {
              inputRef.current = node ?? null;
            }}
            autoCapitalize={autoCapitalize}
            autoCorrect={autoCapitalize !== 'none'}
            autoComplete={autoComplete}
            autoFocus
            value={value}
            onChangeText={onChangeValue}
            onSubmitEditing={onSave}
            returnKeyType="done"
            placeholder={placeholder}
            placeholderTextColor={colors.secondaryText}
            style={[
              styles.fieldInput,
              {
                backgroundColor: colors.surface,
                borderColor: errorMessage ? colors.danger : colors.border,
                color: colors.text,
              },
            ]}
            testID={`${testIDPrefix}-input`}
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

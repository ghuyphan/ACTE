import React from 'react';
import TextFieldEditSheet from '../../sheets/TextFieldEditSheet';

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

export default function UsernameEditSheet(props: UsernameEditSheetProps) {
  return (
    <TextFieldEditSheet
      {...props}
      leadingLabel="@"
      placeholder="noto.id"
      autoCapitalize="none"
      autoComplete="username"
      testIDPrefix="profile-username"
    />
  );
}

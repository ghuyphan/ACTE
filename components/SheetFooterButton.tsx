import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

type SheetFooterButtonVariant = 'primary' | 'secondary' | 'destructive';

interface SheetFooterButtonProps {
  label: string;
  onPress: () => void;
  variant?: SheetFooterButtonVariant;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export default function SheetFooterButton({
  label,
  onPress,
  variant = 'secondary',
  disabled = false,
  testID,
  style,
}: SheetFooterButtonProps) {
  const { colors } = useTheme();

  const backgroundColor =
    variant === 'destructive'
      ? colors.danger
      : variant === 'primary'
        ? colors.primary
        : colors.card;
  const borderColor = variant === 'secondary' ? colors.border : 'transparent';
  const labelColor =
    variant === 'destructive'
      ? '#FFFFFF'
      : variant === 'primary'
        ? '#1C1C1E'
        : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor,
          opacity: disabled ? 0.55 : pressed ? 0.86 : 1,
        },
        style,
      ]}
      testID={testID}
    >
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  label: {
    ...Typography.button,
  },
});

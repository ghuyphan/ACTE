import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';
import { Layout, Shadows, Typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

type ButtonVariant = 'primary' | 'secondary' | 'neutral' | 'destructive';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export default function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  style,
  textStyle,
}: PrimaryButtonProps) {
  const { colors } = useTheme();

  const backgroundColor =
    variant === 'primary'
      ? colors.primary
      : variant === 'secondary'
        ? colors.card
        : variant === 'destructive'
          ? colors.danger
          : colors.text;

  const borderColor =
    variant === 'secondary' ? colors.border : 'transparent';

  const labelColor =
    variant === 'destructive'
      ? '#FFFFFF'
      : variant === 'primary'
        ? '#1C1C1E'
        : variant === 'secondary'
          ? colors.text
          : colors.background;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor,
          opacity: disabled ? 0.55 : 1,
        },
        pressed && !disabled && styles.buttonPressed,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <Text style={[styles.label, { color: labelColor }, textStyle]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: Layout.buttonHeight,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    ...Shadows.button,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
  label: {
    ...Typography.button,
  },
});

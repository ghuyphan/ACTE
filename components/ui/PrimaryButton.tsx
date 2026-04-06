import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { Layout, Shadows, Typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

const BUTTON_HIT_SLOP = { top: 6, right: 6, bottom: 6, left: 6 } as const;
const BUTTON_PRESS_RETENTION_OFFSET = { top: 12, right: 12, bottom: 12, left: 12 } as const;

type ButtonVariant = 'primary' | 'secondary' | 'neutral' | 'destructive';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  leadingIcon?: ReactNode;
  testID?: string;
}

export default function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  style,
  textStyle,
  leadingIcon,
  testID,
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
      accessibilityRole="button"
      hitSlop={BUTTON_HIT_SLOP}
      pressRetentionOffset={BUTTON_PRESS_RETENTION_OFFSET}
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
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <View style={styles.content}>
          {leadingIcon ? <View style={styles.leadingIcon}>{leadingIcon}</View> : null}
          <Text style={[styles.label, { color: labelColor }, textStyle]}>{label}</Text>
        </View>
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
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadingIcon: {
    marginRight: 10,
  },
});

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Shadows } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

type AppIconButtonProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  accessibilityLabel?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  disabled?: boolean;
};

export default function AppIconButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 20,
  style,
  testID,
  disabled = false,
}: AppIconButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed && !disabled ? 0.97 : 1 }],
        },
        style,
      ]}
      testID={testID}
    >
      <Ionicons name={icon} size={size} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.floating,
  },
});

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

export default function AppBackButton({
  onPress,
  size = 20,
  style,
  testID,
}: {
  onPress: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.82 : 1,
        },
        style,
      ]}
      testID={testID}
    >
      <Ionicons
        name="chevron-back"
        size={size}
        color={colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

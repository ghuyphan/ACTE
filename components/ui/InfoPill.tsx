import { Ionicons } from '@expo/vector-icons';
import { GlassView } from './GlassView';
import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { Layout, Typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { isOlderIOS } from '../../utils/platform';

interface InfoPillProps {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export default function InfoPill({
  icon,
  iconColor,
  children,
  style,
  textStyle,
}: InfoPillProps) {
  const { colors, isDark } = useTheme();
  const fallbackColor = colors.glassBackdrop;

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: colors.chromeBorder,
        },
        style,
      ]}
    >
      {isOlderIOS ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: fallbackColor,
            },
          ]}
        />
      ) : null}
      <GlassView
        style={StyleSheet.absoluteFill}
        colorScheme={isDark ? 'dark' : 'light'}
        fallbackColor={fallbackColor}
      />
      {icon ? <Ionicons name={icon} size={16} color={iconColor ?? colors.primary} /> : null}
      {typeof children === 'string' ? (
        <Text style={[styles.text, { color: colors.text }, textStyle]} numberOfLines={1}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Layout.pillRadius,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  text: {
    ...Typography.pill,
    flexShrink: 1,
  },
});

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

  return (
    <View style={[styles.container, style]}>
      {isOlderIOS ? (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.75)',
            },
          ]}
        />
      ) : null}
      <GlassView style={StyleSheet.absoluteFillObject} colorScheme={isDark ? 'dark' : 'light'} />
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
    overflow: 'hidden',
  },
  text: {
    ...Typography.pill,
    flexShrink: 1,
  },
});

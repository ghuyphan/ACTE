import { Ionicons } from '@expo/vector-icons';
import { GlassView } from 'expo-glass-effect';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { LinearTransition, SlideInDown, SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { Layout, Typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { isOlderIOS } from '../../utils/platform';

interface TransientStatusChipProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  style?: StyleProp<ViewStyle>;
}

export default function TransientStatusChip({ icon, label, style }: TransientStatusChipProps) {
  const { colors, isDark } = useTheme();
  const reduceMotionEnabled = useReducedMotion();

  return (
    <Animated.View
      entering={reduceMotionEnabled ? SlideInUp.duration(120) : SlideInDown.springify().damping(18).mass(0.7)}
      exiting={SlideOutUp.duration(reduceMotionEnabled ? 100 : 160)}
      layout={reduceMotionEnabled ? LinearTransition.duration(100) : LinearTransition.springify().damping(18)}
      style={style}
      pointerEvents="none"
    >
      <GlassView
        style={styles.chip}
        glassEffectStyle="regular"
        colorScheme={isDark ? 'dark' : 'light'}
      >
        {isOlderIOS ? (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: isDark ? 'rgba(0,0,0,0.58)' : 'rgba(255,255,255,0.84)',
              },
            ]}
          />
        ) : null}
        <Ionicons name={icon} size={15} color={colors.primary} />
        <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
          {label}
        </Text>
      </GlassView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Layout.pillRadius,
    overflow: 'hidden',
  },
  label: {
    ...Typography.pill,
    fontWeight: '700',
    flexShrink: 1,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { GlassView } from './GlassView';
import { useEffect } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
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
  const entryProgress = useSharedValue(0);

  useEffect(() => {
    entryProgress.value = 0;
    entryProgress.value = withTiming(1, {
      duration: reduceMotionEnabled ? 90 : 150,
      easing: Easing.out(Easing.cubic),
    });
  }, [entryProgress, reduceMotionEnabled, icon, label]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (1 - entryProgress.value) * 10 },
      { scale: 0.98 + entryProgress.value * 0.02 },
    ],
  }));

  return (
    <Animated.View
      style={[style, animatedStyle]}
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
    maxWidth: '100%',
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

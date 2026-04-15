import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Reanimated, {
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTheme } from '../../hooks/useTheme';

interface PlacePulseStripProps {
  label: string;
  onPress?: () => void;
}

function PlacePulseStrip({ label, onPress }: PlacePulseStripProps) {
  const { colors } = useTheme();
  const reduceMotionEnabled = useReducedMotion();
  const pressScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <Reanimated.View
      entering={reduceMotionEnabled ? undefined : FadeInDown.duration(200)}
      exiting={reduceMotionEnabled ? undefined : FadeOutUp.duration(120)}
      style={styles.container}
    >
      <Reanimated.View style={[styles.buttonShell, animatedButtonStyle]}>
        <Pressable
          accessibilityRole={onPress ? 'button' : undefined}
          disabled={!onPress}
          onPress={onPress}
          onPressIn={() => {
            pressScale.value = withSpring(0.95, {
              damping: 20,
              stiffness: 320,
              mass: 0.5,
            });
          }}
          onPressOut={() => {
            pressScale.value = withSpring(1, {
              damping: 20,
              stiffness: 320,
              mass: 0.5,
            });
          }}
          style={styles.button}
        >
          <Ionicons
            name="chevron-down"
            size={14}
            color={colors.captureGlassPlaceholder}
          />

          <Text
            numberOfLines={1}
            style={[styles.label, { color: colors.captureGlassPlaceholder }]}
          >
            {label}
          </Text>
        </Pressable>
      </Reanimated.View>
    </Reanimated.View>
  );
}

export default memo(PlacePulseStrip);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 22,
  },
  buttonShell: {
    maxWidth: '88%',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
    fontFamily: 'Noto Sans',
    textAlign: 'center',
  },
});

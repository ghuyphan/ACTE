import { Ionicons } from '@expo/vector-icons';
import React, { memo, useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTheme } from '../../hooks/useTheme';

type NotoLoaderVariant = 'note' | 'map' | 'photo' | 'skeleton' | 'inline';
type NotoLoaderSize = 'small' | 'large' | number;

type NotoLoaderProps = {
  animating?: boolean;
  variant?: NotoLoaderVariant;
  size?: NotoLoaderSize;
  color?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function getSize(size: NotoLoaderSize | undefined, variant: NotoLoaderVariant) {
  if (typeof size === 'number') {
    return size;
  }
  if (size === 'small') {
    return variant === 'inline' ? 22 : 34;
  }
  return variant === 'inline' ? 28 : 56;
}

function NotoLoader({
  animating = true,
  variant = 'note',
  size = 'large',
  color,
  style,
  testID,
}: NotoLoaderProps) {
  const { colors, isDark } = useTheme();
  const reduceMotionEnabled = useReducedMotion();
  const loaderColor = color ?? colors.primary;
  const visualSize = getSize(size, variant);
  const pulse = useSharedValue(0);
  const bob = useSharedValue(0);
  const dotOne = useSharedValue(0.38);
  const dotTwo = useSharedValue(0.38);
  const dotThree = useSharedValue(0.38);

  useEffect(() => {
    if (!animating) {
      cancelAnimation(pulse);
      cancelAnimation(bob);
      cancelAnimation(dotOne);
      cancelAnimation(dotTwo);
      cancelAnimation(dotThree);
      pulse.value = 0;
      bob.value = 0;
      dotOne.value = 0.76;
      dotTwo.value = 0.76;
      dotThree.value = 0.76;
      return;
    }

    if (reduceMotionEnabled) {
      pulse.value = 0.55;
      bob.value = 0;
      dotOne.value = 0.76;
      dotTwo.value = 0.76;
      dotThree.value = 0.76;
      return;
    }

    pulse.value = withRepeat(
      withTiming(1, { duration: 1050, easing: Easing.out(Easing.cubic) }),
      -1,
      false
    );
    bob.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 520, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 520, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
    dotOne.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 360, easing: Easing.out(Easing.quad) }),
        withTiming(0.34, { duration: 360, easing: Easing.in(Easing.quad) })
      ),
      -1,
      true
    );
    dotTwo.value = withDelay(
      130,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 360, easing: Easing.out(Easing.quad) }),
          withTiming(0.34, { duration: 360, easing: Easing.in(Easing.quad) })
        ),
        -1,
        true
      )
    );
    dotThree.value = withDelay(
      260,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 360, easing: Easing.out(Easing.quad) }),
          withTiming(0.34, { duration: 360, easing: Easing.in(Easing.quad) })
        ),
        -1,
        true
      )
    );

    return () => {
      cancelAnimation(pulse);
      cancelAnimation(bob);
      cancelAnimation(dotOne);
      cancelAnimation(dotTwo);
      cancelAnimation(dotThree);
    };
  }, [animating, bob, dotOne, dotThree, dotTwo, pulse, reduceMotionEnabled]);

  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.42 * (1 - pulse.value),
    transform: [{ scale: 0.74 + pulse.value * 0.54 }],
  }));
  const skeletonPulseStyle = useAnimatedStyle(() => ({
    opacity: 0.34 + pulse.value * 0.3,
  }));
  const dotOneStyle = useAnimatedStyle(() => ({ opacity: dotOne.value }));
  const dotTwoStyle = useAnimatedStyle(() => ({ opacity: dotTwo.value }));
  const dotThreeStyle = useAnimatedStyle(() => ({ opacity: dotThree.value }));

  if (variant === 'inline') {
    const dotSize = Math.max(4, Math.round(visualSize / 5));
    return (
      <View
        {...({ animating } as { animating: boolean })}
        testID={testID}
        pointerEvents="none"
        style={[styles.inlineRoot, { minWidth: visualSize, height: visualSize }, style]}
      >
        {[dotOneStyle, dotTwoStyle, dotThreeStyle].map((animatedStyle, index) => (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: loaderColor,
              },
              animatedStyle,
            ]}
          />
        ))}
      </View>
    );
  }

  if (variant === 'map') {
    const ringSize = visualSize * 0.9;
    return (
      <View
        {...({ animating } as { animating: boolean })}
        testID={testID}
        pointerEvents="none"
        style={[styles.root, { width: visualSize, height: visualSize }, style]}
      >
        <Animated.View
          style={[
            styles.mapRing,
            {
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              borderColor: loaderColor,
            },
            pulseStyle,
          ]}
        />
        <Animated.View style={[styles.mapPin, bobStyle]}>
          <Ionicons name="location" size={visualSize * 0.72} color={loaderColor} />
        </Animated.View>
      </View>
    );
  }

  if (variant === 'photo' || variant === 'skeleton') {
    const cardWidth = variant === 'skeleton' ? visualSize * 1.55 : visualSize * 1.18;
    const cardHeight = variant === 'skeleton' ? visualSize * 0.9 : visualSize * 1.05;
    return (
      <View
        {...({ animating } as { animating: boolean })}
        testID={testID}
        pointerEvents="none"
        style={[styles.skeletonRoot, { minHeight: cardHeight }, style]}
      >
        <Animated.View
          style={[
            styles.skeletonCard,
            {
              width: cardWidth,
              height: cardHeight,
              borderColor: colors.border,
              backgroundColor: isDark ? colors.surface : colors.card,
            },
            skeletonPulseStyle,
          ]}
        >
          {variant === 'photo' ? (
            <View style={[styles.photoGlyph, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="image-outline" size={visualSize * 0.32} color={loaderColor} />
            </View>
          ) : (
            <>
              <View style={[styles.skeletonLine, { width: '68%', backgroundColor: loaderColor }]} />
              <View style={[styles.skeletonLine, { width: '44%', backgroundColor: loaderColor }]} />
              <View style={[styles.skeletonLine, { width: '56%', backgroundColor: loaderColor }]} />
            </>
          )}
        </Animated.View>
      </View>
    );
  }

  const cardWidth = Math.max(42, visualSize * 0.92);
  const cardHeight = Math.max(44, visualSize * 0.9);
  const noteRadius = Math.min(14, Math.max(10, visualSize * 0.2));
  const notePadding = Math.max(8, visualSize * 0.18);
  const noteLineHeight = Math.max(4, visualSize * 0.08);
  const foldSize = Math.max(9, visualSize * 0.22);
  const lineColor = isDark ? 'rgba(255,255,255,0.32)' : 'rgba(94,85,100,0.2)';

  return (
    <View
      {...({ animating } as { animating: boolean })}
      testID={testID}
      pointerEvents="none"
      style={[styles.noteRoot, { minWidth: visualSize, minHeight: visualSize + 12 }, style]}
    >
      <Animated.View
        style={[
          styles.noteCard,
          {
            width: cardWidth,
            height: cardHeight,
            borderRadius: noteRadius,
            paddingHorizontal: notePadding,
            gap: noteLineHeight * 1.6,
            borderColor: loaderColor,
            backgroundColor: colors.card,
          },
          bobStyle,
        ]}
      >
        <View
          style={[
            styles.noteFold,
            {
              borderTopColor: loaderColor,
              borderTopWidth: foldSize,
              borderLeftWidth: foldSize,
            },
          ]}
        />
        <View
          style={[
            styles.noteLine,
            { width: '68%', height: noteLineHeight, backgroundColor: lineColor },
          ]}
        />
        <View
          style={[
            styles.noteLine,
            { width: '48%', height: noteLineHeight, backgroundColor: lineColor },
          ]}
        />
      </Animated.View>
      <View style={styles.dotsRow}>
        {[dotOneStyle, dotTwoStyle, dotThreeStyle].map((animatedStyle, index) => (
          <Animated.View
            key={index}
            style={[styles.noteDot, { backgroundColor: loaderColor }, animatedStyle]}
          />
        ))}
      </View>
    </View>
  );
}

export default memo(NotoLoader);

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteRoot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteCard: {
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  noteFold: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    opacity: 0.24,
  },
  noteLine: {
    borderRadius: 999,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 8,
  },
  noteDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  inlineRoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dot: {
    opacity: 0.7,
  },
  mapRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  mapPin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonRoot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonCard: {
    borderWidth: 1,
    borderRadius: 22,
    justifyContent: 'center',
    paddingHorizontal: 18,
    gap: 9,
  },
  skeletonLine: {
    height: 6,
    borderRadius: 999,
    opacity: 0.22,
  },
  photoGlyph: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    width: '52%',
    aspectRatio: 1,
    borderRadius: 999,
  },
});

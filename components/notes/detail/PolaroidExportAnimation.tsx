import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Layout, Typography } from '../../../constants/theme';
import { useReducedMotion } from '../../../hooks/useReducedMotion';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type PolaroidExportAnimationProps = {
  uri: string | null;
  success: boolean;
  successLabel: string;
  onFinished: () => void;
};

export default function PolaroidExportAnimation({
  uri,
  success,
  successLabel,
  onFinished,
}: PolaroidExportAnimationProps) {
  const reduceMotionEnabled = useReducedMotion();
  const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stackTranslateY = useSharedValue(screenHeight * 0.72);
  const cardOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.96);
  const cardRotation = useSharedValue(2);
  const flashOpacity = useSharedValue(0);
  const badgeOpacity = useSharedValue(0);
  const badgeTranslateY = useSharedValue(10);

  useEffect(() => {
    return () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!uri) {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
        dismissTimeoutRef.current = null;
      }
      stackTranslateY.value = screenHeight * 0.72;
      cardOpacity.value = 0;
      cardScale.value = 0.96;
      cardRotation.value = 2;
      flashOpacity.value = 0;
      badgeOpacity.value = 0;
      badgeTranslateY.value = 10;
      return;
    }

    stackTranslateY.value = withTiming(0, {
      duration: reduceMotionEnabled ? 140 : 620,
      easing: Easing.out(Easing.cubic),
    });
    cardOpacity.value = withTiming(1, {
      duration: reduceMotionEnabled ? 140 : 220,
      easing: Easing.out(Easing.cubic),
    });
    cardRotation.value = withTiming(reduceMotionEnabled ? 0 : 0.35, {
      duration: reduceMotionEnabled ? 140 : 620,
      easing: Easing.out(Easing.cubic),
    });
    cardScale.value = reduceMotionEnabled
      ? withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic) })
      : withSequence(
          withTiming(1.02, { duration: 520, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) })
        );
    flashOpacity.value = reduceMotionEnabled
      ? 0
      : withSequence(
          withDelay(180, withTiming(0.26, { duration: 90 })),
          withTiming(0, { duration: 200 })
        );
  }, [
    badgeOpacity,
    badgeTranslateY,
    cardOpacity,
    cardRotation,
    cardScale,
    flashOpacity,
    reduceMotionEnabled,
    stackTranslateY,
    uri,
  ]);

  useEffect(() => {
    if (!uri || !success) {
      return;
    }

    badgeOpacity.value = withDelay(
      reduceMotionEnabled ? 0 : 120,
      withTiming(1, {
        duration: reduceMotionEnabled ? 120 : 220,
        easing: Easing.out(Easing.cubic),
      })
    );
    badgeTranslateY.value = withTiming(0, {
      duration: reduceMotionEnabled ? 120 : 220,
      easing: Easing.out(Easing.cubic),
    });

    dismissTimeoutRef.current = setTimeout(() => {
      cardOpacity.value = withTiming(0, {
        duration: reduceMotionEnabled ? 120 : 220,
        easing: Easing.in(Easing.cubic),
      }, (finished) => {
        if (finished) {
          runOnJS(onFinished)();
        }
      });
      stackTranslateY.value = withTiming(screenHeight * 0.18, {
        duration: reduceMotionEnabled ? 120 : 240,
        easing: Easing.in(Easing.cubic),
      });
    }, reduceMotionEnabled ? 800 : 1500);

    return () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
        dismissTimeoutRef.current = null;
      }
    };
  }, [
    badgeOpacity,
    badgeTranslateY,
    cardOpacity,
    stackTranslateY,
    onFinished,
    reduceMotionEnabled,
    success,
    uri,
  ]);

  const stackAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: stackTranslateY.value }],
  }));
  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [
      { rotate: `${cardRotation.value}deg` },
      { scale: cardScale.value },
    ],
  }));
  const flashAnimatedStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));
  const badgeAnimatedStyle = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value,
    transform: [{ translateY: badgeTranslateY.value }],
  }));

  if (!uri) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Animated.View style={[styles.cardStack, stackAnimatedStyle]}>
        <Animated.View style={[styles.polaroidWrap, cardAnimatedStyle]}>
          <Image resizeMode="contain" source={{ uri }} style={styles.previewImage} />
          <Animated.View style={[styles.flashOverlay, flashAnimatedStyle]} />
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.badge, badgeAnimatedStyle]}>
        <Ionicons name="checkmark-circle" size={18} color="#2D6A4F" />
        <Text style={styles.badgeLabel} numberOfLines={1}>
          {successLabel}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: 'center',
    paddingBottom: 0,
    backgroundColor: 'rgba(29, 21, 15, 0.18)',
  },
  cardStack: {
    position: 'absolute',
    bottom: 42,
    alignItems: 'center',
  },
  polaroidWrap: {
    width: Math.min(screenWidth - 64, 264),
    aspectRatio: 1080 / 1350,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#201109',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 12,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3E8D9',
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
  },
  badge: {
    position: 'absolute',
    bottom: -10,
    maxWidth: Math.min(screenWidth - 48, 320),
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Layout.pillRadius,
    backgroundColor: 'rgba(251, 248, 242, 0.94)',
  },
  badgeLabel: {
    color: '#2C241E',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: Typography.body.fontFamily,
  },
});

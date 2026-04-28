import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
  Dimensions,
  Image,
  Modal,
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
import { POLAROID_EXPORT_HEIGHT, POLAROID_EXPORT_WIDTH } from '../../../services/polaroidExport';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const DETAIL_POLAROID_WIDTH = Math.min(screenWidth - 64, 264);
const HOME_POLAROID_WIDTH = Math.min(screenWidth - 112, 224);
const HOME_BOTTOM_PADDING = 34;

type PolaroidExportAnimationVariant = 'detail-sheet' | 'home-feed';
type PolaroidExportAnimationPresentation = 'inline' | 'modal';

type PolaroidExportAnimationProps = {
  uri: string | null;
  success: boolean;
  successLabel: string;
  onFinished: () => void;
  presentation?: PolaroidExportAnimationPresentation;
  variant?: PolaroidExportAnimationVariant;
  bottomPadding?: number;
};

export default function PolaroidExportAnimation({
  uri,
  success,
  successLabel,
  onFinished,
  presentation = 'inline',
  variant = 'detail-sheet',
  bottomPadding,
}: PolaroidExportAnimationProps) {
  const reduceMotionEnabled = useReducedMotion();
  const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHomeFeed = variant === 'home-feed';
  const initialTranslateY = isHomeFeed ? screenHeight * 0.44 : screenHeight * 0.72;
  const restingTranslateY = isHomeFeed && !reduceMotionEnabled ? 8 : 0;
  const stackTranslateY = useSharedValue(initialTranslateY);
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
      stackTranslateY.value = initialTranslateY;
      cardOpacity.value = 0;
      cardScale.value = 0.96;
      cardRotation.value = 2;
      flashOpacity.value = 0;
      badgeOpacity.value = 0;
      badgeTranslateY.value = 10;
      return;
    }

    stackTranslateY.value = withTiming(restingTranslateY, {
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
    restingTranslateY,
    stackTranslateY,
    uri,
    initialTranslateY,
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

  const content = isHomeFeed ? (
    <View
      pointerEvents="none"
      style={[
        styles.homeOverlay,
        { paddingBottom: bottomPadding ?? HOME_BOTTOM_PADDING },
      ]}
    >
      <Animated.View style={[styles.homeContent, stackAnimatedStyle]}>
        <Animated.View style={[styles.homePolaroidWrap, cardAnimatedStyle]}>
          <Image resizeMode="contain" source={{ uri }} style={styles.previewImage} />
          <Animated.View pointerEvents="none" style={[styles.flashOverlay, flashAnimatedStyle]} />
        </Animated.View>
        <Animated.View style={[styles.badge, styles.homeBadge, badgeAnimatedStyle]}>
          <Ionicons name="checkmark-circle" size={18} color="#2D6A4F" />
          <Text style={styles.badgeLabel} numberOfLines={1}>
            {successLabel}
          </Text>
        </Animated.View>
      </Animated.View>
    </View>
  ) : (
    <View pointerEvents="none" style={styles.overlay}>
      <Animated.View style={[styles.cardStack, stackAnimatedStyle]}>
        <Animated.View style={[styles.detailPolaroidWrap, cardAnimatedStyle]}>
          <Image resizeMode="contain" source={{ uri }} style={styles.previewImage} />
          <Animated.View pointerEvents="none" style={[styles.flashOverlay, flashAnimatedStyle]} />
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

  if (presentation === 'modal') {
    return (
      <Modal
        animationType="none"
        hardwareAccelerated
        navigationBarTranslucent
        onRequestClose={() => {}}
        presentationStyle="overFullScreen"
        statusBarTranslucent
        transparent
        visible={Boolean(uri)}
      >
        {content}
      </Modal>
    );
  }

  return content;
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
  detailPolaroidWrap: {
    width: DETAIL_POLAROID_WIDTH,
    aspectRatio: POLAROID_EXPORT_WIDTH / POLAROID_EXPORT_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#201109',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 12,
  },
  homeOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(29, 21, 15, 0.18)',
  },
  homeContent: {
    alignItems: 'center',
  },
  homePolaroidWrap: {
    width: HOME_POLAROID_WIDTH,
    aspectRatio: POLAROID_EXPORT_WIDTH / POLAROID_EXPORT_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#201109',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  previewImage: {
    width: '100%',
    height: '100%',
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
  homeBadge: {
    position: 'relative',
    bottom: 0,
    marginTop: 18,
    maxWidth: Math.min(screenWidth - 64, 320),
  },
  badgeLabel: {
    color: '#2C241E',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: Typography.body.fontFamily,
  },
});

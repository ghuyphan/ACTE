import { memo, useEffect, useRef } from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { TFunction } from 'i18next';
import { Layout } from '../../constants/theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { Note } from '../../services/database';
import { NoteMemoryCard } from './MemoryCardPrimitives';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const CARD_SIZE = Math.min(screenWidth - 64, 264);
const DEFAULT_BOTTOM_PADDING = 34;
const BOTTOM_TAB_CLEARANCE = 20;

type SavedNotePolaroidRevealProps = {
  note: Note | null;
  revealToken: number;
  bottomTabInset?: number;
  colors: {
    primary: string;
    text: string;
    secondaryText: string;
    danger: string;
    card: string;
  };
  t: TFunction;
  onFinished: () => void;
};

function SavedNotePolaroidReveal({
  note,
  revealToken,
  bottomTabInset = 0,
  colors,
  t,
  onFinished,
}: SavedNotePolaroidRevealProps) {
  const reduceMotionEnabled = useReducedMotion();
  const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRevealTokenRef = useRef(0);
  const cardTranslateY = useSharedValue(screenHeight * 0.44);
  const cardOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.96);
  const cardRotation = useSharedValue(2);
  const flashOpacity = useSharedValue(0);

  useEffect(() => {
    return () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!note || revealToken === 0 || lastRevealTokenRef.current === revealToken) {
      if (!note) {
        cardTranslateY.value = screenHeight * 0.44;
        cardOpacity.value = 0;
        cardScale.value = 0.96;
        cardRotation.value = 2;
        flashOpacity.value = 0;
      }
      return;
    }

    lastRevealTokenRef.current = revealToken;

    if (dismissTimeoutRef.current) {
      clearTimeout(dismissTimeoutRef.current);
    }

    cardTranslateY.value = withTiming(reduceMotionEnabled ? 0 : 8, {
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
      ? withTiming(1, {
          duration: 140,
          easing: Easing.out(Easing.cubic),
        })
      : withSequence(
          withTiming(1.02, {
            duration: 520,
            easing: Easing.out(Easing.cubic),
          }),
          withTiming(1, {
            duration: 180,
            easing: Easing.out(Easing.cubic),
          })
        );
    flashOpacity.value = reduceMotionEnabled
      ? withTiming(0, { duration: 0 })
      : withSequence(
          withDelay(
            180,
            withTiming(0.26, {
              duration: 90,
              easing: Easing.out(Easing.cubic),
            })
          ),
          withTiming(0, {
            duration: 200,
            easing: Easing.out(Easing.cubic),
          })
        );

    dismissTimeoutRef.current = setTimeout(() => {
      cardOpacity.value = withTiming(0, {
        duration: reduceMotionEnabled ? 120 : 220,
        easing: Easing.in(Easing.cubic),
      }, (finished) => {
        if (finished) {
          runOnJS(onFinished)();
        }
      });
      cardTranslateY.value = withTiming(screenHeight * 0.18, {
        duration: reduceMotionEnabled ? 120 : 240,
        easing: Easing.in(Easing.cubic),
      });
    }, reduceMotionEnabled ? 800 : 1500);
  }, [
    cardOpacity,
    cardRotation,
    cardScale,
    cardTranslateY,
    flashOpacity,
    note,
    onFinished,
    reduceMotionEnabled,
    revealToken,
  ]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [
      { translateY: cardTranslateY.value },
      { rotate: `${cardRotation.value}deg` },
      { scale: cardScale.value },
    ],
  }));
  const flashAnimatedStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));
  const bottomPadding =
    Platform.OS === 'android'
      ? DEFAULT_BOTTOM_PADDING
      : bottomTabInset > 0
        ? bottomTabInset + BOTTOM_TAB_CLEARANCE
        : DEFAULT_BOTTOM_PADDING;

  if (!note) {
    return null;
  }

  return (
    <View pointerEvents="none" style={[styles.overlay, { paddingBottom: bottomPadding }]}>
      <Animated.View style={[styles.cardWrap, cardAnimatedStyle]}>
        <View style={styles.cardShadowWrap}>
          <NoteMemoryCard note={note} colors={colors} t={t} cardSize={CARD_SIZE} />
          <Animated.View pointerEvents="none" style={[styles.flashOverlay, flashAnimatedStyle]} />
        </View>
      </Animated.View>
    </View>
  );
}

export default memo(SavedNotePolaroidReveal);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 14,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(29, 21, 15, 0.18)',
  },
  cardWrap: {
    width: CARD_SIZE,
    alignItems: 'center',
  },
  cardShadowWrap: {
    position: 'relative',
    shadowColor: '#201109',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: CARD_SIZE,
    borderRadius: Layout.cardRadius,
    borderCurve: 'continuous',
    backgroundColor: '#FFFFFF',
  },
});

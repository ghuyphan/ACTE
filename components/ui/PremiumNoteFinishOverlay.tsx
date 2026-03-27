import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { getNoteColorFinish } from '../../services/noteAppearance';

interface PremiumNoteFinishOverlayProps {
  noteColor?: string | null;
  animated?: boolean;
}

type GradientStops = [string, string, string];

const STATIC_SHEEN_COLORS: Record<string, GradientStops> = {
  rgb: ['rgba(255,80,176,0.0)', 'rgba(255,255,255,0.18)', 'rgba(90,255,240,0.0)'],
  holo: ['rgba(255,255,255,0.0)', 'rgba(255,255,255,0.26)', 'rgba(255,255,255,0.0)'],
  chrome: ['rgba(255,255,255,0.0)', 'rgba(255,255,255,0.22)', 'rgba(255,255,255,0.0)'],
};

const STATIC_WASH_COLORS: Record<string, GradientStops> = {
  rgb: ['rgba(255,0,153,0.12)', 'rgba(86,79,255,0.06)', 'rgba(0,255,217,0.14)'],
  holo: ['rgba(255,136,214,0.12)', 'rgba(111,240,255,0.08)', 'rgba(255,255,255,0.14)'],
  chrome: ['rgba(190,207,255,0.12)', 'rgba(255,255,255,0.08)', 'rgba(255,177,235,0.12)'],
};

export default function PremiumNoteFinishOverlay({
  noteColor,
  animated = false,
}: PremiumNoteFinishOverlayProps) {
  const finish = getNoteColorFinish(noteColor);
  const reduceMotionEnabled = useReducedMotion();
  const sheenProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated || reduceMotionEnabled || finish === 'standard') {
      sheenProgress.stopAnimation();
      sheenProgress.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sheenProgress, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sheenProgress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [animated, finish, reduceMotionEnabled, sheenProgress]);

  if (finish === 'standard') {
    return null;
  }

  const sheenColors = STATIC_SHEEN_COLORS[finish];
  const washColors = STATIC_WASH_COLORS[finish];
  const animatedSheenStyle = animated && !reduceMotionEnabled
    ? {
        transform: [
          {
            translateX: sheenProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [-180, 180],
            }),
          },
          { rotate: finish === 'rgb' ? '14deg' : finish === 'chrome' ? '18deg' : '12deg' },
        ],
      }
    : {
        transform: [{ translateX: 12 }, { rotate: finish === 'chrome' ? '18deg' : '12deg' }],
      };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={washColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          StyleSheet.absoluteFill,
          finish === 'rgb' ? styles.rgbWash : finish === 'chrome' ? styles.chromeWash : styles.holoWash,
        ]}
      />
      <Animated.View style={[styles.sheenWrap, animatedSheenStyle]}>
        <LinearGradient
          colors={sheenColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sheen}
        />
      </Animated.View>
      <View
        style={[
          styles.edgeGlow,
          finish === 'rgb' ? styles.rgbEdge : finish === 'chrome' ? styles.chromeEdge : styles.holoEdge,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheenWrap: {
    position: 'absolute',
    top: -24,
    bottom: -24,
    width: '58%',
    opacity: 0.85,
  },
  sheen: {
    flex: 1,
  },
  edgeGlow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    opacity: 0.95,
  },
  rgbWash: {
    opacity: 0.95,
  },
  holoWash: {
    opacity: 0.88,
  },
  chromeWash: {
    opacity: 0.84,
  },
  rgbEdge: {
    shadowColor: '#A36BFF',
    shadowOpacity: 0.28,
    shadowRadius: 16,
  },
  holoEdge: {
    shadowColor: '#8AF6FF',
    shadowOpacity: 0.24,
    shadowRadius: 14,
  },
  chromeEdge: {
    shadowColor: '#D2B8FF',
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
});

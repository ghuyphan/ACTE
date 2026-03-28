import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useHologramMotion } from '../../hooks/useHologramMotion';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { getNoteColorFinish } from '../../services/noteAppearance';

interface PremiumNoteFinishOverlayProps {
  noteColor?: string | null;
  animated?: boolean;
  interactive?: boolean;
  previewMode?: 'saved' | 'editor';
  strength?: number;
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

const HOLO_SPARKLES = [
  { top: '12%' as const, left: '14%' as const, size: 5, opacity: 0.54 },
  { top: '24%' as const, left: '72%' as const, size: 4, opacity: 0.45 },
  { top: '38%' as const, left: '42%' as const, size: 3, opacity: 0.38 },
  { top: '61%' as const, left: '18%' as const, size: 4, opacity: 0.48 },
  { top: '74%' as const, left: '78%' as const, size: 6, opacity: 0.44 },
];

function HoloSparkle({
  sparkle,
  index,
  tiltX,
  isInteractive,
}: {
  sparkle: (typeof HOLO_SPARKLES)[number];
  index: number;
  tiltX: SharedValue<number>;
  isInteractive: boolean;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const opacity = isInteractive
      ? interpolate(
          tiltX.value,
          [-1, 0, 1],
          [
            index % 2 === 0 ? sparkle.opacity * 0.2 : sparkle.opacity,
            sparkle.opacity * ((index % 3) / 3 + 0.5),
            index % 2 !== 0 ? sparkle.opacity * 0.2 : sparkle.opacity,
          ]
        )
      : sparkle.opacity;

    return {
      opacity,
    };
  }, [index, isInteractive, sparkle.opacity]);

  return (
    <Animated.View
      style={[
        styles.holoSparkle,
        {
          top: sparkle.top,
          left: sparkle.left,
          width: sparkle.size,
          height: sparkle.size,
          borderRadius: sparkle.size / 2,
        },
        animatedStyle,
      ]}
    />
  );
}

export default function PremiumNoteFinishOverlay({
  noteColor,
  animated = false,
  interactive = false,
  previewMode = 'saved',
  strength,
}: PremiumNoteFinishOverlayProps) {
  const finish = getNoteColorFinish(noteColor);
  const reduceMotionEnabled = useReducedMotion();
  const sheenProgress = useSharedValue(0);
  const { tiltX, tiltY, isInteractive } = useHologramMotion({
    enabled: finish === 'holo' && animated && interactive,
    previewMode,
    strength,
  });

  useEffect(() => {
    if (!animated || reduceMotionEnabled || finish === 'standard' || finish === 'holo') {
      cancelAnimation(sheenProgress);
      sheenProgress.value = 0;
      return;
    }

    sheenProgress.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 2600,
          easing: Easing.inOut(Easing.cubic),
        }),
        withTiming(0, {
          duration: 0,
        })
      ),
      -1,
      false
    );

    return () => {
      cancelAnimation(sheenProgress);
    };
  }, [animated, finish, reduceMotionEnabled, sheenProgress]);

  const spectrumAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: finish === 'holo' && isInteractive ? interpolate(tiltX.value, [-1, 1], [-120, 120]) : 0 },
      { translateY: finish === 'holo' && isInteractive ? interpolate(tiltY.value, [-1, 1], [60, -60]) : 0 },
      { rotate: '-35deg' },
      { scale: 1.6 },
    ],
  }), [finish, isInteractive]);
  const spectrum2AnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: finish === 'holo' && isInteractive ? interpolate(tiltX.value, [-1, 1], [80, -80]) : 0 },
      { translateY: finish === 'holo' && isInteractive ? interpolate(tiltY.value, [-1, 1], [-40, 40]) : 0 },
      { rotate: '55deg' },
      { scale: 1.8 },
    ],
  }), [finish, isInteractive]);
  const holoSheenAnimatedStyle = useAnimatedStyle(() => ({
    opacity: finish === 'holo' && isInteractive ? 0.96 : 0.74,
    transform: [
      { translateX: finish === 'holo' && isInteractive ? interpolate(tiltX.value, [-1, 1], [-180, 180]) : 12 },
      { translateY: finish === 'holo' && isInteractive ? interpolate(tiltY.value, [-1, 1], [90, -90]) : -4 },
      { rotate: '15deg' },
      { scale: 1.2 },
    ],
  }), [finish, isInteractive]);
  const sparkleLayerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: finish === 'holo' && isInteractive ? interpolate(tiltX.value, [-1, 1], [-12, 12]) : 0 },
      { translateY: finish === 'holo' && isInteractive ? interpolate(tiltY.value, [-1, 1], [12, -12]) : 0 },
    ],
  }), [finish, isInteractive]);
  const animatedSheenStyle = useAnimatedStyle(() => (
    animated && !reduceMotionEnabled && finish !== 'holo'
      ? {
          transform: [
            {
              translateX: interpolate(sheenProgress.value, [0, 1], [-180, 180]),
            },
            { rotate: finish === 'rgb' ? '14deg' : finish === 'chrome' ? '18deg' : '12deg' },
          ],
        }
      : {
          transform: [{ translateX: 12 }, { rotate: finish === 'chrome' ? '18deg' : '12deg' }],
        }
  ), [animated, finish, reduceMotionEnabled]);

  if (finish === 'standard') {
    return null;
  }

  if (finish === 'holo') {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={['rgba(255,124,214,0.12)', 'rgba(100,222,255,0.12)', 'rgba(255,255,255,0.12)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.holoBaseWash]}
        />
        <Animated.View style={[styles.holoSpectrumWrap, spectrumAnimatedStyle]}>
          <LinearGradient
            colors={[
              'rgba(255,0,0,0)',
              'rgba(255,0,0,0.3)',
              'rgba(255,165,0,0.4)',
              'rgba(255,255,0,0.4)',
              'rgba(0,255,0,0.35)',
              'rgba(0,191,255,0.4)',
              'rgba(138,43,226,0.4)',
              'rgba(255,0,255,0.3)',
              'rgba(255,255,255,0)',
            ]}
            locations={[0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 0.95, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.holoSpectrum}
          />
        </Animated.View>
        <Animated.View style={[styles.holoSpectrumWrap, spectrum2AnimatedStyle]}>
          <LinearGradient
            colors={[
              'rgba(255,255,255,0)',
              'rgba(0,255,255,0.3)',
              'rgba(255,0,255,0.3)',
              'rgba(255,255,0,0.3)',
              'rgba(255,255,255,0)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.holoSpectrum}
          />
        </Animated.View>
        <Animated.View style={[styles.holoSheenWrap, holoSheenAnimatedStyle]}>
          <LinearGradient
            colors={[
              'rgba(255,255,255,0.0)',
              'rgba(255,255,255,0.1)',
              'rgba(255,255,255,0.85)',
              'rgba(255,255,255,1)',
              'rgba(255,255,255,0.85)',
              'rgba(255,255,255,0.1)',
              'rgba(255,255,255,0.0)',
            ]}
            locations={[0, 0.4, 0.48, 0.5, 0.52, 0.6, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.holoSheen}
          />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, sparkleLayerAnimatedStyle]}>
          {HOLO_SPARKLES.map((sparkle, index) => {
            return (
              <HoloSparkle
                key={`holo-sparkle-${index}`}
                sparkle={sparkle}
                index={index}
                tiltX={tiltX}
                isInteractive={isInteractive}
              />
            );
          })}
        </Animated.View>
        <View style={styles.holoNoiseVeil} />
        <View style={styles.holoEdgeGlow} />
        <View style={styles.holoInnerGlow} />
      </View>
    );
  }

  const sheenColors = STATIC_SHEEN_COLORS[finish];
  const washColors = STATIC_WASH_COLORS[finish];

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
    ...StyleSheet.absoluteFill,
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
  holoBaseWash: {
    opacity: 0.94,
  },
  holoSpectrumWrap: {
    position: 'absolute',
    top: '-50%',
    left: '-50%',
    width: '200%',
    height: '200%',
    opacity: 0.85,
  },
  holoSpectrum: {
    flex: 1,
  },
  holoSheenWrap: {
    position: 'absolute',
    top: '-50%',
    left: '-50%',
    width: '200%',
    height: '200%',
  },
  holoSheen: {
    flex: 1,
  },
  holoSparkle: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  holoNoiseVeil: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    opacity: 0.7,
  },
  holoEdgeGlow: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1.2,
    borderColor: 'rgba(190,255,255,0.48)',
    shadowColor: '#7EF3FF',
    shadowOpacity: 0.42,
    shadowRadius: 18,
  },
  holoInnerGlow: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    margin: 5,
    borderColor: 'rgba(255,255,255,0.18)',
  },
});

import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
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

export default function PremiumNoteFinishOverlay({
  noteColor,
  animated = false,
  interactive = false,
  previewMode = 'saved',
  strength,
}: PremiumNoteFinishOverlayProps) {
  const finish = getNoteColorFinish(noteColor);
  const reduceMotionEnabled = useReducedMotion();
  const sheenProgress = useRef(new Animated.Value(0)).current;
  const { tiltX, tiltY, isInteractive } = useHologramMotion({
    enabled: finish === 'holo' && animated && interactive,
    previewMode,
    strength,
  });

  useEffect(() => {
    if (!animated || reduceMotionEnabled || finish === 'standard' || finish === 'holo') {
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

  if (finish === 'holo') {
    const spectrumTranslateX = isInteractive
      ? tiltX.interpolate({
        inputRange: [-1, 1],
        outputRange: [-120, 120],
      })
      : 0;
    const spectrumTranslateY = isInteractive
      ? tiltY.interpolate({
        inputRange: [-1, 1],
        outputRange: [60, -60],
      })
      : 0;
    const spectrum2TranslateX = isInteractive
      ? tiltX.interpolate({
        inputRange: [-1, 1],
        outputRange: [80, -80],
      })
      : 0;
    const spectrum2TranslateY = isInteractive
      ? tiltY.interpolate({
        inputRange: [-1, 1],
        outputRange: [-40, 40],
      })
      : 0;
    const sheenTranslateX = isInteractive
      ? tiltX.interpolate({
        inputRange: [-1, 1],
        outputRange: [-180, 180],
      })
      : 12;
    const sheenTranslateY = isInteractive
      ? tiltY.interpolate({
        inputRange: [-1, 1],
        outputRange: [90, -90],
      })
      : -4;
    const sparkleTranslateX = isInteractive
      ? tiltX.interpolate({
        inputRange: [-1, 1],
        outputRange: [-12, 12],
      })
      : 0;
    const sparkleTranslateY = isInteractive
      ? tiltY.interpolate({
        inputRange: [-1, 1],
        outputRange: [12, -12],
      })
      : 0;

    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={['rgba(255,124,214,0.12)', 'rgba(100,222,255,0.12)', 'rgba(255,255,255,0.12)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.holoBaseWash]}
        />
        <Animated.View
          style={[
            styles.holoSpectrumWrap,
            {
              transform: [
                { translateX: spectrumTranslateX },
                { translateY: spectrumTranslateY },
                { rotate: '-35deg' },
                { scale: 1.6 },
              ],
            },
          ]}
        >
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
        <Animated.View
          style={[
            styles.holoSpectrumWrap,
            {
              transform: [
                { translateX: spectrum2TranslateX },
                { translateY: spectrum2TranslateY },
                { rotate: '55deg' },
                { scale: 1.8 },
              ],
            },
          ]}
        >
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
        <Animated.View
          style={[
            styles.holoSheenWrap,
            {
              opacity: isInteractive ? 0.96 : 0.74,
              transform: [
                { translateX: sheenTranslateX },
                { translateY: sheenTranslateY },
                { rotate: '15deg' },
                { scale: 1.2 },
              ],
            },
          ]}
        >
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
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [
                { translateX: sparkleTranslateX },
                { translateY: sparkleTranslateY },
              ],
            },
          ]}
        >
          {HOLO_SPARKLES.map((sparkle, index) => {
            const sparkleOpacity = isInteractive
              ? tiltX.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: [
                  index % 2 === 0 ? sparkle.opacity * 0.2 : sparkle.opacity,
                  sparkle.opacity * ((index % 3) / 3 + 0.5),
                  index % 2 !== 0 ? sparkle.opacity * 0.2 : sparkle.opacity,
                ],
              })
              : sparkle.opacity;

            return (
              <Animated.View
                key={`holo-sparkle-${index}`}
                style={[
                  styles.holoSparkle,
                  {
                    top: sparkle.top,
                    left: sparkle.left,
                    width: sparkle.size,
                    height: sparkle.size,
                    borderRadius: sparkle.size / 2,
                    opacity: sparkleOpacity,
                  },
                ]}
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
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    opacity: 0.7,
  },
  holoEdgeGlow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.2,
    borderColor: 'rgba(190,255,255,0.48)',
    shadowColor: '#7EF3FF',
    shadowOpacity: 0.42,
    shadowRadius: 18,
  },
  holoInnerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    margin: 5,
    borderColor: 'rgba(255,255,255,0.18)',
  },
});

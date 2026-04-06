import { ReactNode, RefObject } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { Layout, Shadows } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { GlassView } from './GlassView';
import { BlurView } from 'expo-blur';

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

interface GlassHeaderProps {
  topInset: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  docked?: boolean;
  blurTarget?: RefObject<View | null>;
  dockedBlurred?: boolean;
  dockedBlurScrollOffset?: SharedValue<number>;
}

export default function GlassHeader({
  topInset,
  children,
  style,
  docked = false,
  blurTarget,
  dockedBlurred = false,
  dockedBlurScrollOffset,
}: GlassHeaderProps) {
  const { isDark } = useTheme();
  const isAndroid = Platform.OS === 'android';
  const dockedBlurAnimatedStyle = useAnimatedStyle(() => {
    const offsetY = dockedBlurScrollOffset?.value ?? 0;
    return {
      opacity: dockedBlurred
        ? interpolate(offsetY, [0, 8, 28, 64], [0, 0, 0.55, 1], Extrapolation.CLAMP)
        : 0,
    };
  });

  if (docked) {
    return (
      <View
        pointerEvents="box-none"
        style={[
          styles.wrapper,
          styles.dockedWrapper,
          style,
        ]}
      >
        <View
          style={[
            styles.dockedContainer,
            {
              height: topInset + Layout.headerHeight,
            },
          ]}
        >
          {dockedBlurred ? (
            <AnimatedBlurView
              intensity={isAndroid ? 26 : 14}
              tint={isDark ? 'dark' : 'light'}
              blurTarget={isAndroid ? blurTarget : undefined}
              blurReductionFactor={isAndroid ? 1 : undefined}
              blurMethod={isAndroid ? 'dimezisBlurViewSdk31Plus' : undefined}
              style={[StyleSheet.absoluteFill, dockedBlurAnimatedStyle]}
            />
          ) : null}
          <View style={{ height: topInset }} />
          <View style={styles.content}>{children}</View>
        </View>
      </View>
    );
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          paddingTop: topInset + Layout.floatingGap,
          paddingHorizontal: Layout.screenPadding - 8,
        },
        style,
      ]}
    >
      <GlassView
        style={[styles.container, { height: Layout.headerHeight }]}
        glassEffectStyle="regular"
        colorScheme={isDark ? 'dark' : 'light'}
      >
        <View style={styles.content}>{children}</View>
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingBottom: Layout.floatingGap,
  },
  dockedWrapper: {
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  container: {
    borderRadius: 30,
    overflow: 'hidden',
    ...(Platform.OS === 'android'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2,
        }
      : Shadows.floating),
  },
  dockedContainer: {
    borderRadius: 0,
    overflow: 'visible',
  },
  content: {
    flex: 1,
  },
});

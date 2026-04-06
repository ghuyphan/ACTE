import { ReactNode, RefObject } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { type SharedValue } from 'react-native-reanimated';
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
  const { colors, isDark } = useTheme();
  const isAndroid = Platform.OS === 'android';
  const dockedBackdropColor = isDark
    ? isAndroid
      ? 'rgba(18,13,10,0.34)'
      : 'rgba(18,13,10,0.22)'
    : isAndroid
      ? 'rgba(255,251,244,0.36)'
      : 'rgba(255,251,244,0.24)';

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
              intensity={isAndroid ? 56 : 24}
              tint={isDark ? 'dark' : 'light'}
              blurTarget={isAndroid ? blurTarget : undefined}
              blurReductionFactor={isAndroid ? 1 : undefined}
              blurMethod={isAndroid ? 'dimezisBlurViewSdk31Plus' : undefined}
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: dockedBackdropColor,
                },
              ]}
            />
          ) : null}
          <View
            pointerEvents="none"
            style={[
              styles.dockedSeparator,
              {
                backgroundColor: colors.border,
                opacity: dockedBlurred ? 0.42 : 0,
              },
            ]}
          />
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
  dockedSeparator: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
  content: {
    flex: 1,
  },
});

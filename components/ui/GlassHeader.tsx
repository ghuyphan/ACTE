import { ReactNode } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { Layout } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { GlassView } from './GlassView';
import {
  glassContainerShadow,
  glassTokens,
  getGlassSurfacePalette,
} from './glassTokens';

interface GlassHeaderProps {
  topInset: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  docked?: boolean;
  dockedBlurred?: boolean;
}

export default function GlassHeader({
  topInset,
  children,
  style,
  docked = false,
  dockedBlurred = false,
}: GlassHeaderProps) {
  const { colors, isDark } = useTheme();
  const isAndroid = Platform.OS === 'android';
  const showDockedMaterial = dockedBlurred && !isAndroid;
  const { dockedBackdropColor } = getGlassSurfacePalette({ isDark });

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
          {showDockedMaterial ? (
            <BlurView
              intensity={24}
              tint={isDark ? 'dark' : 'light'}
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
                opacity: showDockedMaterial ? 0.42 : 0,
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
    borderRadius: glassTokens.headerContainerRadius,
    overflow: 'hidden',
    ...glassContainerShadow,
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

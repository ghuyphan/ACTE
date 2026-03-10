import { GlassView } from 'expo-glass-effect';
import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Layout, Shadows } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { isOlderIOS } from '../../utils/platform';

interface GlassHeaderProps {
  topInset: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function GlassHeader({ topInset, children, style }: GlassHeaderProps) {
  const { colors, isDark } = useTheme();

  return (
    <View
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
        {isOlderIOS ? (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)',
              },
            ]}
          />
        ) : null}
        <View style={[styles.content, { borderColor: colors.border }]}>{children}</View>
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
  container: {
    borderRadius: 30,
    overflow: 'hidden',
    ...Shadows.floating,
  },
  content: {
    flex: 1,
  },
});

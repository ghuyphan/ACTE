import { type ReactNode, useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Reanimated, { LinearTransition } from 'react-native-reanimated';
import { Radii } from '../../../constants/theme';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { isOlderIOS } from '../../../utils/platform';
import { GlassView } from '../../ui/GlassView';
import { getGlassSurfacePalette } from '../../ui/glassTokens';
import type { CaptureCardColors } from './captureShared';
import { styles } from './captureCardStyles';

interface CaptureControlRailProps {
  borderColor: string;
  colors: CaptureCardColors;
  children: ReactNode;
  rowStyle?: ViewStyle;
  style?: ViewStyle;
}

export function CaptureControlRail({
  borderColor,
  colors,
  children,
  rowStyle,
  style,
}: CaptureControlRailProps) {
  const reduceMotionEnabled = useReducedMotion();
  const glassPalette = getGlassSurfacePalette({
    isDark: colors.captureGlassColorScheme === 'dark',
    borderColor,
  });
  const railLayoutTransition = useMemo(
    () =>
      reduceMotionEnabled
        ? undefined
        : LinearTransition.springify().damping(19).stiffness(220).mass(0.9),
    [reduceMotionEnabled]
  );

  return (
    <Reanimated.View
      layout={railLayoutTransition}
      style={[styles.textBottomToolsBar, style, { borderColor }]}
    >
      {isOlderIOS ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: glassPalette.controlBackgroundColor,
              borderRadius: Radii.pill,
            },
          ]}
        />
      ) : null}
      {!isOlderIOS ? (
        <GlassView
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          glassEffectStyle="regular"
          colorScheme={colors.captureGlassColorScheme}
          fallbackColor={glassPalette.controlBackgroundColor}
        />
      ) : null}
      <Reanimated.View layout={railLayoutTransition} style={[styles.textBottomToolsRow, rowStyle]}>
        {children}
      </Reanimated.View>
    </Reanimated.View>
  );
}

import { Canvas, Path as SkiaPath } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Radii } from '../../../constants/theme';
import { useTheme } from '../../../hooks/useTheme';
import type { StickerStampStyle } from '../../../services/noteStickers';
import {
  createStampFramePath,
  getStampFrameMetrics,
  STAMP_OUTLINE_COLOR,
  STAMP_PAPER_BORDER_COLOR,
} from '../../notes/stampFrameMetrics';

interface StampStylePickerProps {
  value: StickerStampStyle;
  disabled?: boolean;
  classicLabel: string;
  circleLabel: string;
  onChange: (style: StickerStampStyle) => void;
}

const STAMP_STYLE_OPTIONS: readonly {
  accessibilityLabelProp: 'classicLabel' | 'circleLabel';
  style: StickerStampStyle;
}[] = [
  {
    accessibilityLabelProp: 'classicLabel',
    style: 'classic',
  },
  {
    accessibilityLabelProp: 'circleLabel',
    style: 'circle',
  },
];

function StampStyleOutlineIcon({
  style,
}: {
  style: StickerStampStyle;
}) {
  const size = style === 'circle'
    ? { width: 24, height: 24 }
    : { width: 22, height: 26 };
  const metrics = useMemo(
    () => getStampFrameMetrics(size.width, size.height, style),
    [size.height, size.width, style]
  );
  const path = useMemo(() => createStampFramePath(metrics), [metrics]);
  const outlineWidth = Math.max(1.4, metrics.perforationRadius * 0.42);
  const borderWidth = Math.max(0.8, metrics.perforationRadius * 0.12);

  return (
    <Canvas style={{ width: metrics.outerWidth, height: metrics.outerHeight }}>
      <SkiaPath
        path={path}
        color={STAMP_OUTLINE_COLOR}
        style="stroke"
        strokeWidth={outlineWidth}
      />
      <SkiaPath
        path={path}
        color={STAMP_PAPER_BORDER_COLOR}
        style="stroke"
        strokeWidth={borderWidth}
      />
    </Canvas>
  );
}

function StampStylePicker({
  value,
  disabled = false,
  classicLabel,
  circleLabel,
  onChange,
}: StampStylePickerProps) {
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.optionRow}>
      {STAMP_STYLE_OPTIONS.map((option) => {
        const selected = value === option.style;
        const accessibilityLabel =
          option.accessibilityLabelProp === 'classicLabel' ? classicLabel : circleLabel;

        return (
          <Pressable
            key={option.style}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            hitSlop={6}
            onPress={() => onChange(option.style)}
            style={({ pressed }) => [
              styles.optionButton,
              {
                backgroundColor: selected
                  ? (colors.card ?? (isDark ? '#242424' : '#FFFFFF'))
                  : 'transparent',
                borderColor: selected
                  ? colors.primary ?? '#0A84FF'
                  : colors.border ?? (isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)'),
                opacity: disabled ? 0.56 : 1,
              },
              pressed && !disabled ? styles.optionButtonPressed : null,
            ]}
            testID={`stamp-style-option-${option.style}`}
          >
            <StampStyleOutlineIcon style={option.style} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  optionRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.lg,
    borderWidth: 1.5,
  },
  optionButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
});

export default memo(StampStylePicker);

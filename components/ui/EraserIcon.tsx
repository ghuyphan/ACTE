import React, { memo } from 'react';
import { Canvas, Group, Path as SkiaPath } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';

type EraserIconProps = {
  size?: number;
  color?: string;
};

const VIEWBOX_SIZE = 512;
const ERASER_BLOCK_PATH =
  'M 160 208 L 240 128 Q 272 96 312 96 L 352 136 Q 384 168 384 208 L 304 288 Q 272 320 232 320 L 192 280 Q 160 248 160 208 Z';
const SLEEVE_DIVIDER_PATH = 'M 224 272 L 368 128';
const ERASER_OFFSET_X = -16;
const ERASER_OFFSET_Y = 48;

function EraserIcon({ size = 20, color = '#111111' }: EraserIconProps) {
  const scale = size / VIEWBOX_SIZE;

  return (
    <View style={[styles.root, { width: size, height: size }]}>
      <Canvas style={styles.canvas}>
        <Group transform={[{ scale }, { translateX: ERASER_OFFSET_X }, { translateY: ERASER_OFFSET_Y }]}>
          <SkiaPath
            path={ERASER_BLOCK_PATH}
            color={color}
            style="stroke"
            strokeWidth={32}
            strokeCap="round"
            strokeJoin="round"
          />
          <SkiaPath
            path={SLEEVE_DIVIDER_PATH}
            color={color}
            style="stroke"
            strokeWidth={32}
            strokeCap="round"
            strokeJoin="round"
          />
        </Group>
      </Canvas>
    </View>
  );
}

export default memo(EraserIcon);

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    width: '100%',
    height: '100%',
  },
});

import React, { memo } from 'react';
import { Canvas, Group, Path as SkiaPath } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';

type DoodleIconProps = {
  size?: number;
  color?: string;
};

const VIEWBOX_SIZE = 512;
const SCRIBBLE_PATH =
  'M 64 240 C 192 80, 320 80, 224 240 C 128 400, 256 400, 384 240';
const PENCIL_PATH =
  'M 384 240 L 384 192 L 448 128 A 34 34 0 0 1 496 176 L 432 240 Z';
const TIP_DIVIDER_PATH = 'M 384 192 L 432 240';
const ERASER_DIVIDER_PATH = 'M 432 144 L 480 192';

function DoodleIcon({ size = 18, color = '#111111' }: DoodleIconProps) {
  const scale = size / VIEWBOX_SIZE;

  return (
    <View style={[styles.root, { width: size, height: size }]}>
      <Canvas style={styles.canvas}>
        <Group transform={[{ scale }]}>
          <SkiaPath
            path={SCRIBBLE_PATH}
            color={color}
            style="stroke"
            strokeWidth={32}
            strokeCap="round"
            strokeJoin="round"
          />
          <SkiaPath
            path={PENCIL_PATH}
            color={color}
            style="stroke"
            strokeWidth={32}
            strokeCap="round"
            strokeJoin="round"
          />
          <SkiaPath
            path={TIP_DIVIDER_PATH}
            color={color}
            style="stroke"
            strokeWidth={32}
            strokeCap="round"
            strokeJoin="round"
          />
          <SkiaPath
            path={ERASER_DIVIDER_PATH}
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

export default memo(DoodleIcon);

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

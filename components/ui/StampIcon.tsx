import React, { memo } from 'react';
import { Canvas, Group, Path as SkiaPath } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';

type StampIconProps = {
  size?: number;
  color?: string;
};

const VIEWBOX_SIZE = 512;
const OUTLINE_PATH =
  'M 64 80 A 16 16 0 0 1 80 64 H 112 A 32 32 0 0 1 176 64 H 224 A 32 32 0 0 1 288 64 H 336 A 32 32 0 0 1 400 64 H 432 A 16 16 0 0 1 448 80 V 112 A 32 32 0 0 1 448 176 V 224 A 32 32 0 0 1 448 288 V 336 A 32 32 0 0 1 448 400 V 432 A 16 16 0 0 1 432 448 H 400 A 32 32 0 0 1 336 448 H 288 A 32 32 0 0 1 224 448 H 176 A 32 32 0 0 1 112 448 H 80 A 16 16 0 0 1 64 432 V 400 A 32 32 0 0 1 64 336 V 288 A 32 32 0 0 1 64 224 V 176 A 32 32 0 0 1 64 112 Z';

function StampIcon({ size = 18, color = '#111111' }: StampIconProps) {
  const scale = size / VIEWBOX_SIZE;

  return (
    <View style={[styles.root, { width: size, height: size }]}>
      <Canvas style={styles.canvas}>
        <Group transform={[{ scale }]}>
          <SkiaPath
            path={OUTLINE_PATH}
            color={color}
            style="stroke"
            strokeWidth={40}
            strokeCap="round"
            strokeJoin="round"
          />
        </Group>
      </Canvas>
    </View>
  );
}

export default memo(StampIcon);

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

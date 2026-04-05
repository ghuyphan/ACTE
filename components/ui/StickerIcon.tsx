import React, { memo } from 'react';
import { Canvas, Circle, Group, Path as SkiaPath } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';

type StickerIconProps = {
  size?: number;
  color?: string;
};

const VIEWBOX_SIZE = 512;
const OUTLINE_PATH =
  'M 320 448 H 128 A 64 64 0 0 1 64 384 V 128 A 64 64 0 0 1 128 64 H 384 A 64 64 0 0 1 448 128 V 320';
const PEEL_PATH = 'M 448 320 L 320 448 C 320 376, 376 320, 448 320 Z';
const SMILE_PATH = 'M 160 288 C 160 352, 320 352, 320 288';

function StickerIcon({ size = 18, color = '#111111' }: StickerIconProps) {
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
          <SkiaPath path={PEEL_PATH} color={color} style="fill" />
          <SkiaPath
            path={PEEL_PATH}
            color={color}
            style="stroke"
            strokeWidth={40}
            strokeJoin="round"
          />
          <Circle cx={176} cy={192} r={28} color={color} />
          <Circle cx={304} cy={192} r={28} color={color} />
          <SkiaPath
            path={SMILE_PATH}
            color={color}
            style="stroke"
            strokeWidth={40}
            strokeCap="round"
          />
        </Group>
      </Canvas>
    </View>
  );
}

export default memo(StickerIcon);

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

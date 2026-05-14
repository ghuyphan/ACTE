import { Canvas, Group, Path as SkiaPath } from '@shopify/react-native-skia';
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

type SkiaStrokeIconProps = {
  color: string;
  paths: readonly string[];
  size: number;
  strokeWidth: number;
  viewBoxSize: number;
};

function SkiaStrokeIcon({
  color,
  paths,
  size,
  strokeWidth,
  viewBoxSize,
}: SkiaStrokeIconProps) {
  const scale = size / viewBoxSize;

  return (
    <View style={[styles.root, { width: size, height: size }]}>
      <Canvas style={styles.canvas}>
        <Group transform={[{ scale }]}>
          {paths.map((path) => (
            <SkiaPath
              key={path}
              path={path}
              color={color}
              style="stroke"
              strokeWidth={strokeWidth}
              strokeCap="round"
              strokeJoin="round"
            />
          ))}
        </Group>
      </Canvas>
    </View>
  );
}

export default memo(SkiaStrokeIcon);

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

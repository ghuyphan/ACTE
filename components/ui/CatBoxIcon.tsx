import React, { memo } from 'react';
import { Canvas, Group, Path as SkiaPath } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';

type CatBoxIconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

const VIEWBOX_SIZE = 24;
const PATHS = [
  'M 4 13 L 2.5 17',
  'M 20 13 L 21.5 17',
  'M 7 13 V 8.5 L 8.4 5 L 10.3 7 Q 12 6.2 13.7 7 L 15.6 5 L 17 8.5 V 13',
  'M 10.2 8.9 L 10.2 10.2',
  'M 13.8 8.9 L 13.8 10.2',
  'M 7 9.3 L 4.6 8.8',
  'M 7 10.8 L 4.4 11',
  'M 17 9.3 L 19.4 8.8',
  'M 17 10.8 L 19.6 11',
  'M 4 13 V 19.5 A 2 2 0 0 0 6 21.5 H 18 A 2 2 0 0 0 20 19.5 V 13',
  'M 2 13 H 22',
];

function CatBoxIcon({
  size = 42,
  color = '#111111',
  strokeWidth = 1.08,
}: CatBoxIconProps) {
  const scale = size / VIEWBOX_SIZE;

  return (
    <View style={[styles.root, { width: size, height: size }]}>
      <Canvas style={styles.canvas}>
        <Group transform={[{ scale }]}>
          {PATHS.map((path) => (
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

export default memo(CatBoxIcon);

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

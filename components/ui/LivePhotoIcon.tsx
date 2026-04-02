import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

type LivePhotoIconProps = {
  size?: number;
  color?: string;
};

const OUTER_DOT_COUNT = 14;

function LivePhotoIcon({ size = 18, color = '#111111' }: LivePhotoIconProps) {
  const outerSize = size;
  const middleSize = size * 0.66;
  const centerSize = size * 0.34;
  const dotSize = Math.max(1.4, size * 0.09);
  const dotRadius = size * 0.44;
  const dotOffset = outerSize / 2 - dotSize / 2;

  return (
    <View style={[styles.root, { width: outerSize, height: outerSize }]}>
      {Array.from({ length: OUTER_DOT_COUNT }).map((_, index) => {
        const angle = (index / OUTER_DOT_COUNT) * Math.PI * 2;
        const x = Math.cos(angle) * dotRadius + dotOffset;
        const y = Math.sin(angle) * dotRadius + dotOffset;

        return (
          <View
            key={index}
            style={[
              styles.outerDot,
              {
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: color,
                left: x,
                top: y,
              },
            ]}
          />
        );
      })}
      <View
        style={[
          styles.middleRing,
          {
            width: middleSize,
            height: middleSize,
            borderRadius: middleSize / 2,
            borderColor: color,
            borderWidth: Math.max(1.25, size * 0.08),
          },
        ]}
      />
      <View
        style={[
          styles.centerRing,
          {
            width: centerSize,
            height: centerSize,
            borderRadius: centerSize / 2,
            borderColor: color,
            borderWidth: Math.max(1.6, size * 0.12),
          },
        ]}
      />
    </View>
  );
}

export default memo(LivePhotoIcon);

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerDot: {
    position: 'absolute',
  },
  middleRing: {
    position: 'absolute',
  },
  centerRing: {
    position: 'absolute',
  },
});

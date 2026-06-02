import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import LivePhotoIcon from './LivePhotoIcon';

type LivePhotoOffIconProps = {
  size?: number;
  color?: string;
  progress?: SharedValue<number>;
};

function LivePhotoOffIcon({ size = 18, color = '#111111', progress }: LivePhotoOffIconProps) {
  const containerSize = Math.max(size, 1);
  const slashAnimatedStyle = useAnimatedStyle(() => {
    const value = progress?.value ?? 1;

    return {
      opacity: value,
      transform: [
        { rotate: '-42deg' },
        { scaleX: 0.18 + value * 0.82 },
      ],
    };
  }, [progress]);

  return (
    <View style={[styles.root, { width: containerSize, height: containerSize }]}>
      <LivePhotoIcon size={size} color={color} />
      <Reanimated.View
        style={[
          styles.slash,
          {
            width: size * 1.04,
            height: Math.max(1.15, size * 0.065),
            borderRadius: Math.max(0.58, size * 0.033),
            backgroundColor: color,
          },
          slashAnimatedStyle,
        ]}
      />
    </View>
  );
}

export default memo(LivePhotoOffIcon);

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  slash: {
    position: 'absolute',
    transform: [{ rotate: '-42deg' }],
  },
});

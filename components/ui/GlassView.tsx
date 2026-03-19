import { GlassView as ExpoGlassView } from 'expo-glass-effect';
import type { ComponentProps } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

type ExpoGlassViewProps = ComponentProps<typeof ExpoGlassView>;

interface GlassViewProps extends ExpoGlassViewProps {
  fallbackColor?: string;
}

function getAndroidFallbackColor({
  colorScheme,
  fallbackColor,
  tintColor,
}: Pick<GlassViewProps, 'colorScheme' | 'fallbackColor' | 'tintColor'>) {
  if (fallbackColor) {
    return fallbackColor;
  }

  if (typeof tintColor === 'string' && tintColor.length > 0) {
    return tintColor;
  }

  return colorScheme === 'dark' ? 'rgba(24,24,28,0.94)' : 'rgba(255,252,246,0.94)';
}

export function GlassView({
  children,
  colorScheme = 'light',
  fallbackColor,
  style,
  tintColor,
  ...rest
}: GlassViewProps) {
  if (Platform.OS === 'android') {
    return (
      <View
        {...rest}
        style={[
          styles.androidFallback,
          {
            backgroundColor: getAndroidFallbackColor({
              colorScheme,
              fallbackColor,
              tintColor,
            }),
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <ExpoGlassView {...rest} style={style} colorScheme={colorScheme} tintColor={tintColor}>
      {children}
    </ExpoGlassView>
  );
}

const styles = StyleSheet.create({
  androidFallback: {
    overflow: 'hidden',
  },
});

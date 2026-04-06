import { requireNativeViewManager } from 'expo-modules-core';
import { forwardRef } from 'react';
import { Platform, View, type ViewProps } from 'react-native';

const AndroidBlurTargetView =
  Platform.OS === 'android'
    ? requireNativeViewManager<ViewProps>('ExpoBlur', 'ExpoBlurTargetView')
    : View;

const BlurTargetView = forwardRef<View, ViewProps>(function BlurTargetView(props, ref) {
  const Component = AndroidBlurTargetView as typeof View;
  return <Component {...props} ref={ref} />;
});

export default BlurTargetView;

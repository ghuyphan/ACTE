import { useMemo } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ANDROID_TAB_SHELL_BOTTOM_OFFSET,
  ANDROID_TAB_SHELL_HEIGHT,
  ANDROID_TAB_SHELL_MIN_SAFE_AREA,
} from '../components/navigation/androidTabShellMetrics';

const IOS_NATIVE_TAB_BAR_HEIGHT = 49;

export function useBottomTabVisualInset() {
  const insets = useSafeAreaInsets();

  return useMemo(() => {
    if (Platform.OS === 'android') {
      return (
        Math.max(insets.bottom, ANDROID_TAB_SHELL_MIN_SAFE_AREA) +
        ANDROID_TAB_SHELL_BOTTOM_OFFSET +
        ANDROID_TAB_SHELL_HEIGHT
      );
    }

    if (Platform.OS === 'ios') {
      return insets.bottom + IOS_NATIVE_TAB_BAR_HEIGHT;
    }

    return insets.bottom;
  }, [insets.bottom]);
}

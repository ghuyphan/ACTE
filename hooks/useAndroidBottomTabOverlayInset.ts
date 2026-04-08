import { useMemo } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ANDROID_TAB_SHELL_BOTTOM_OFFSET,
  ANDROID_TAB_SHELL_HEIGHT,
  ANDROID_TAB_SHELL_MIN_SAFE_AREA,
  ANDROID_TAB_SHELL_SCROLL_CLEARANCE,
} from '../components/navigation/androidTabShellMetrics';

export function useAndroidBottomTabOverlayInset() {
  const insets = useSafeAreaInsets();

  return useMemo(() => {
    if (Platform.OS !== 'android') {
      return 0;
    }

    return (
      Math.max(insets.bottom, ANDROID_TAB_SHELL_MIN_SAFE_AREA) +
      ANDROID_TAB_SHELL_BOTTOM_OFFSET +
      ANDROID_TAB_SHELL_HEIGHT +
      ANDROID_TAB_SHELL_SCROLL_CLEARANCE
    );
  }, [insets.bottom]);
}

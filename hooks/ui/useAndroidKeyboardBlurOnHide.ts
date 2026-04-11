import { useEffect, useRef, type RefObject } from 'react';
import { Keyboard, Platform } from 'react-native';

type BlurTarget = {
  blur?: () => void;
  isFocused?: () => boolean;
} | null;

type BlurTargetRef = RefObject<BlurTarget>;

type UseAndroidKeyboardBlurOnHideOptions = {
  refs: BlurTargetRef[];
  enabled?: boolean;
};

export function useAndroidKeyboardBlurOnHide({
  refs,
  enabled = true,
}: UseAndroidKeyboardBlurOnHideOptions) {
  const refsRef = useRef(refs);
  refsRef.current = refs;

  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled) {
      return;
    }

    const subscription = Keyboard.addListener('keyboardDidHide', () => {
      refsRef.current.forEach((targetRef) => {
        const target = targetRef.current;
        if (target?.isFocused?.()) {
          target.blur?.();
        }
      });
    });

    return () => subscription.remove();
  }, [enabled]);
}

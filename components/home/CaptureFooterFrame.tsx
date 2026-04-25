import { memo, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Reanimated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export const CAPTURE_FOOTER_FRAME_HEIGHT = 58;

interface CaptureFooterFrameProps {
  children: ReactNode;
}

function CaptureFooterFrame({ children }: CaptureFooterFrameProps) {
  const reduceMotionEnabled = useReducedMotion();

  return (
    <Reanimated.View
      entering={reduceMotionEnabled ? undefined : FadeInDown.duration(180)}
      exiting={reduceMotionEnabled ? undefined : FadeOutUp.duration(120)}
      style={styles.frame}
    >
      {children}
    </Reanimated.View>
  );
}

export default memo(CaptureFooterFrame);

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    height: CAPTURE_FOOTER_FRAME_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

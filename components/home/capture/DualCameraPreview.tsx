import { requireNativeViewManager } from 'expo-modules-core';
import {
  forwardRef,
  memo,
  useImperativeHandle,
  useRef,
} from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Platform } from 'react-native';
import {
  hasDualCameraNativeModule,
  type DualCameraFacing,
  type DualCameraStillCapture,
} from '../../../services/dualCamera';

type NativeDualCameraPreviewProps = {
  active: boolean;
  primaryFacing: DualCameraFacing;
  style?: StyleProp<ViewStyle>;
  onPreviewReady?: () => void;
  onCaptureError?: (event: {
    nativeEvent?: {
      message?: string;
      code?: string;
    };
  }) => void;
};

export type DualCameraPreviewHandle = {
  captureStill: () => Promise<DualCameraStillCapture>;
};

type DualCameraPreviewProps = NativeDualCameraPreviewProps & {
  style?: StyleProp<ViewStyle>;
};

const NativeDualCameraPreview = Platform.OS === 'ios' && hasDualCameraNativeModule()
  ? (requireNativeViewManager<NativeDualCameraPreviewProps>('NotoDualCamera') as any)
  : null;

export const DualCameraPreview = memo(
  forwardRef<DualCameraPreviewHandle, DualCameraPreviewProps>(function DualCameraPreview(
    {
      active,
      onCaptureError,
      onPreviewReady,
      primaryFacing,
      style,
    },
    ref
  ) {
    const nativeRef = useRef<any>(null);

    useImperativeHandle(
      ref,
      () => ({
        async captureStill() {
          return nativeRef.current?.captureStill();
        },
      }),
      []
    );

    if (!NativeDualCameraPreview) {
      return null;
    }

    return (
      <NativeDualCameraPreview
        ref={nativeRef}
        active={active}
        primaryFacing={primaryFacing}
        onPreviewReady={onPreviewReady}
        onCaptureError={onCaptureError}
        style={style}
      />
    );
  })
);

import type { ComponentProps } from 'react';
import type { TextInput } from 'react-native';
import Reanimated from 'react-native-reanimated';
import type { ThemeColors } from '../../../hooks/useTheme';

export type CaptureCardAnimatedStyle = ComponentProps<typeof Reanimated.View>['style'];
export type CaptureCardTextInputStyle = ComponentProps<typeof TextInput>['style'];
export type CaptureCardColors = Pick<
  ThemeColors,
  | 'primary'
  | 'primarySoft'
  | 'captureButtonBg'
  | 'card'
  | 'border'
  | 'text'
  | 'secondaryText'
  | 'captureCardText'
  | 'captureCardPlaceholder'
  | 'captureCardBorder'
  | 'captureGlassFill'
  | 'captureGlassBorder'
  | 'captureGlassText'
  | 'captureGlassIcon'
  | 'captureGlassPlaceholder'
  | 'captureGlassColorScheme'
  | 'captureCameraOverlay'
  | 'captureCameraOverlayBorder'
  | 'captureCameraOverlayText'
  | 'captureFlashOverlay'
>;

export type CameraUiStage = 'text' | 'live' | 'capturing' | 'review';
export type StickerAction = 'remove' | 'motion-lock-toggle' | 'outline-toggle';

const DUAL_CAMERA_COMPOSER_SIZE = 1080;
const CAPTURE_CARD_RADIUS_RATIO = 60 / 369;

export const DUAL_CAMERA_INSET_SIZE_RATIO = 228 / DUAL_CAMERA_COMPOSER_SIZE;
export const DUAL_CAMERA_INSET_MARGIN_RATIO = 58 / DUAL_CAMERA_COMPOSER_SIZE;
export const DUAL_CAMERA_INSET_BORDER_WIDTH_RATIO = 2 / DUAL_CAMERA_COMPOSER_SIZE;
export const DUAL_CAMERA_INSET_FRAME_COLOR = 'rgba(255,255,255,0.82)';
export const DUAL_CAMERA_INSET_FROST_COLOR = 'rgba(255,255,255,0.01)';
export const DUAL_CAMERA_INSET_PREVIEW_SCRIM_COLOR = 'rgba(255,255,255,0.04)';
export const DUAL_CAMERA_INSET_SHELL_BACKGROUND = '#111111';
export const DUAL_CAMERA_INSET_SHADOW_COLOR = '#000000';
export const DUAL_CAMERA_INSET_SHADOW_OPACITY = 0.14;
export const DUAL_CAMERA_INSET_SHADOW_RADIUS = 10;
export const DUAL_CAMERA_INSET_SHADOW_OFFSET = {
  width: 0,
  height: 4,
} as const;

export function getDualCameraInsetMetrics(containerSize: number) {
  const insetSize = Math.round(containerSize * DUAL_CAMERA_INSET_SIZE_RATIO);
  const insetMargin = Math.round(containerSize * DUAL_CAMERA_INSET_MARGIN_RATIO);
  const insetBorderWidth = Math.max(1.5, containerSize * DUAL_CAMERA_INSET_BORDER_WIDTH_RATIO);
  const outerRadius = containerSize * CAPTURE_CARD_RADIUS_RATIO;
  const concentricInsetRadius = outerRadius - insetMargin + insetBorderWidth / 2;
  // A strict concentric radius turns tiny square insets into circles, so cap it
  // to keep the inset reading as a rounded card rather than a badge.
  const visualInsetRadiusCap = insetSize * 0.27;

  return {
    insetSize,
    insetMargin,
    insetRadius: Math.round(
      Math.max(12, Math.min(concentricInsetRadius, visualInsetRadiusCap))
    ),
    insetBorderWidth,
  };
}

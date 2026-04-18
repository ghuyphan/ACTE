const DUAL_CAMERA_COMPOSER_SIZE = 1080;
const CAPTURE_CARD_RADIUS_RATIO = 60 / 369;

export const DUAL_CAMERA_INSET_SIZE_RATIO = 228 / DUAL_CAMERA_COMPOSER_SIZE;
export const DUAL_CAMERA_INSET_MARGIN_RATIO = 58 / DUAL_CAMERA_COMPOSER_SIZE;
export const DUAL_CAMERA_INSET_BORDER_WIDTH_RATIO = 3 / DUAL_CAMERA_COMPOSER_SIZE;

export function getDualCameraInsetMetrics(containerSize: number) {
  const insetSize = Math.round(containerSize * DUAL_CAMERA_INSET_SIZE_RATIO);
  const insetMargin = Math.round(containerSize * DUAL_CAMERA_INSET_MARGIN_RATIO);
  const insetBorderWidth = Math.max(2, Math.round(containerSize * DUAL_CAMERA_INSET_BORDER_WIDTH_RATIO));
  const outerRadius = containerSize * CAPTURE_CARD_RADIUS_RATIO;
  const concentricInsetRadius = outerRadius - insetMargin + insetBorderWidth / 2;
  // A strict concentric radius turns tiny square insets into circles, so cap it
  // to keep the inset reading as a rounded card rather than a badge.
  const visualInsetRadiusCap = insetSize * 0.32;

  return {
    insetSize,
    insetMargin,
    insetRadius: Math.round(
      Math.max(12, Math.min(concentricInsetRadius, visualInsetRadiusCap))
    ),
    insetBorderWidth,
  };
}

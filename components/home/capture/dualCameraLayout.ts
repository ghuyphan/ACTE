const DUAL_CAMERA_COMPOSER_SIZE = 1080;

export const DUAL_CAMERA_INSET_SIZE_RATIO = 276 / DUAL_CAMERA_COMPOSER_SIZE;
export const DUAL_CAMERA_INSET_MARGIN_RATIO = 44 / DUAL_CAMERA_COMPOSER_SIZE;
export const DUAL_CAMERA_INSET_RADIUS_RATIO = 46 / DUAL_CAMERA_COMPOSER_SIZE;
export const DUAL_CAMERA_INSET_BORDER_WIDTH_RATIO = 6 / DUAL_CAMERA_COMPOSER_SIZE;

export function getDualCameraInsetMetrics(containerSize: number) {
  return {
    insetSize: Math.round(containerSize * DUAL_CAMERA_INSET_SIZE_RATIO),
    insetMargin: Math.round(containerSize * DUAL_CAMERA_INSET_MARGIN_RATIO),
    insetRadius: Math.max(12, Math.round(containerSize * DUAL_CAMERA_INSET_RADIUS_RATIO)),
    insetBorderWidth: Math.max(2, Math.round(containerSize * DUAL_CAMERA_INSET_BORDER_WIDTH_RATIO)),
  };
}

import type { CameraDevice } from 'react-native-vision-camera';

export type BackCameraLens = 'wide' | 'ultra-wide' | 'telephoto';

export type BackCameraLensZoomSpec = {
  anchor: number;
  min: number;
  max: number;
};

export type BackCameraLensZoomConfig = Record<BackCameraLens, BackCameraLensZoomSpec>;

export type LogicalCameraZoomBounds = {
  min: number;
  max: number;
  neutral: number;
  deviceMin: number;
  deviceMax: number;
};

type ZoomLabelStyle = 'badge' | 'selector';

const MAX_PREVIEW_ZOOM_FACTOR = 8;

const DEFAULT_BACK_CAMERA_LENS_ZOOM_ANCHORS: Record<BackCameraLens, number> = {
  'ultra-wide': 0.5,
  wide: 1,
  telephoto: 2,
};

function clamp(value: number, minValue: number, maxValue: number) {
  return Math.min(maxValue, Math.max(minValue, value));
}

export function getSafeRepresentativeFieldOfView(device?: CameraDevice | null) {
  if (!device || !Array.isArray(device.formats)) {
    return null;
  }

  const fieldOfView = device.formats.find(
    (format) => Number.isFinite(format.fieldOfView) && format.fieldOfView > 0
  )?.fieldOfView;

  return typeof fieldOfView === 'number' && fieldOfView > 0 ? fieldOfView : null;
}

export function getLensAnchorFromFieldOfView(
  lens: BackCameraLens,
  targetFieldOfView: number | null,
  wideFieldOfView: number | null
) {
  if (
    lens === 'wide' ||
    targetFieldOfView == null ||
    wideFieldOfView == null ||
    targetFieldOfView <= 0 ||
    wideFieldOfView <= 0
  ) {
    return DEFAULT_BACK_CAMERA_LENS_ZOOM_ANCHORS[lens];
  }

  const halfWideRadians = (wideFieldOfView * Math.PI) / 360;
  const halfTargetRadians = (targetFieldOfView * Math.PI) / 360;
  const tangentRatio = Math.tan(halfWideRadians) / Math.tan(halfTargetRadians);

  if (!Number.isFinite(tangentRatio) || tangentRatio <= 0) {
    return DEFAULT_BACK_CAMERA_LENS_ZOOM_ANCHORS[lens];
  }

  if (lens === 'ultra-wide') {
    return clamp(tangentRatio, 0.4, 0.95);
  }

  return clamp(tangentRatio, 1.05, 6);
}

export function createBackCameraLensZoomSpec(
  lens: BackCameraLens,
  device?: CameraDevice | null,
  anchor = DEFAULT_BACK_CAMERA_LENS_ZOOM_ANCHORS[lens]
): BackCameraLensZoomSpec {
  if (!device) {
    return {
      anchor,
      min: anchor,
      max: anchor,
    };
  }

  const neutralZoom =
    Number.isFinite(device.neutralZoom) && device.neutralZoom > 0 ? device.neutralZoom : 1;
  const minZoom = Number.isFinite(device.minZoom) && device.minZoom > 0 ? device.minZoom : 1;
  const maxZoom =
    Number.isFinite(device.maxZoom) && device.maxZoom > 0
      ? Math.max(neutralZoom, Math.min(device.maxZoom, MAX_PREVIEW_ZOOM_FACTOR))
      : neutralZoom;

  return {
    anchor,
    min: (anchor * minZoom) / neutralZoom,
    max: (anchor * maxZoom) / neutralZoom,
  };
}

export function getBackCameraLensZoomSpec(
  zoomConfig: BackCameraLensZoomConfig | undefined,
  lens: BackCameraLens
) {
  return zoomConfig?.[lens] ?? createBackCameraLensZoomSpec(lens);
}

export function getLogicalZoomBoundsForCameraDevice(
  cameraDevice: CameraDevice | undefined,
  lensAnchor: number
): LogicalCameraZoomBounds {
  if (!cameraDevice) {
    return {
      min: lensAnchor,
      max: lensAnchor,
      neutral: 1,
      deviceMin: 1,
      deviceMax: 1,
    };
  }

  const neutralZoom =
    Number.isFinite(cameraDevice.neutralZoom) && cameraDevice.neutralZoom > 0
      ? cameraDevice.neutralZoom
      : 1;
  const minZoom =
    Number.isFinite(cameraDevice.minZoom) && cameraDevice.minZoom > 0 ? cameraDevice.minZoom : 1;
  const maxZoom =
    Number.isFinite(cameraDevice.maxZoom) && cameraDevice.maxZoom > 0
      ? Math.max(neutralZoom, Math.min(cameraDevice.maxZoom, MAX_PREVIEW_ZOOM_FACTOR))
      : neutralZoom;

  return {
    min: (lensAnchor * minZoom) / neutralZoom,
    max: (lensAnchor * maxZoom) / neutralZoom,
    neutral: neutralZoom,
    deviceMin: minZoom,
    deviceMax: maxZoom,
  };
}

export function resolveCameraZoomState(
  cameraDevice: CameraDevice | undefined,
  lensAnchor: number,
  requestedLogicalZoomFactor: number
) {
  const bounds = getLogicalZoomBoundsForCameraDevice(cameraDevice, lensAnchor);
  const effectiveLogicalZoomFactor = clamp(
    Number.isFinite(requestedLogicalZoomFactor) && requestedLogicalZoomFactor > 0
      ? requestedLogicalZoomFactor
      : bounds.min,
    bounds.min,
    bounds.max
  );
  const unclampedPreviewZoom = (bounds.neutral * effectiveLogicalZoomFactor) / lensAnchor;
  const previewZoom = clamp(unclampedPreviewZoom, bounds.deviceMin, bounds.deviceMax);
  const logicalZoomFactor = clamp(
    (lensAnchor * previewZoom) / bounds.neutral,
    bounds.min,
    bounds.max
  );

  return {
    bounds,
    logicalZoomFactor,
    previewZoom,
  };
}

export function formatCameraZoomFactor(value: number, style: ZoomLabelStyle = 'badge') {
  const normalizedValue = Number.isFinite(value) && value > 0 ? value : 1;

  if (style === 'selector') {
    return `${normalizedValue.toFixed(1).replace(/\.0$/, '')}x`;
  }

  return `${normalizedValue.toFixed(1)}x`;
}

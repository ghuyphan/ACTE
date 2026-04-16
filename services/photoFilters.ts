import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'react-native';
import {
  BlendMode,
  ImageFormat,
  Skia,
  TileMode,
  type SkCanvas,
  type SkImage,
} from '@shopify/react-native-skia';
import type { PlanTier } from '../constants/subscription';
import { deleteAsync, EncodingType, getInfoAsync, writeAsStringAsync } from '../utils/fileSystem';

export type PhotoFilterId = 'original' | 'soft' | 'warm' | 'cool' | 'mono' | 'vivid' | 'vintage';

export type PhotoFilterBlendMode = 'srcOver' | 'screen' | 'softLight' | 'multiply';

export type PhotoFilterPoint = {
  x: number;
  y: number;
};

export type PhotoFilterLayer =
  | {
      type: 'solid';
      color: string;
      opacity: number;
      blendMode: PhotoFilterBlendMode;
    }
  | {
      type: 'linearGradient';
      colors: string[];
      positions?: number[];
      start: PhotoFilterPoint;
      end: PhotoFilterPoint;
      opacity: number;
      blendMode: PhotoFilterBlendMode;
    }
  | {
      type: 'radialGradient';
      colors: string[];
      positions?: number[];
      center: PhotoFilterPoint;
      radius: number;
      opacity: number;
      blendMode: PhotoFilterBlendMode;
    }
  | {
      type: 'grain';
      freqX: number;
      freqY: number;
      octaves: number;
      seed: number;
      tileScale: number;
      opacity: number;
      blendMode: PhotoFilterBlendMode;
    };

export type PhotoFilterPreset = {
  id: PhotoFilterId;
  labelKey: string;
  defaultLabel: string;
  tier: PlanTier;
  matrix: number[];
  layers?: PhotoFilterLayer[];
};

const IDENTITY_MATRIX = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

const BLEND_MODE_MAP: Record<PhotoFilterBlendMode, BlendMode> = {
  srcOver: BlendMode.SrcOver,
  screen: BlendMode.Screen,
  softLight: BlendMode.SoftLight,
  multiply: BlendMode.Multiply,
};

const MATTE_CAFE_LAYERS: PhotoFilterLayer[] = [
  {
    type: 'solid',
    color: '#F2E8DA',
    opacity: 0.03,
    blendMode: 'softLight',
  },
  {
    type: 'linearGradient',
    colors: ['rgba(255, 249, 241, 0.8)', 'rgba(236, 227, 212, 0.45)', 'rgba(176, 193, 178, 0.36)'],
    positions: [0, 0.48, 1],
    start: { x: 0.3, y: 0 },
    end: { x: 0.7, y: 1 },
    opacity: 0.08,
    blendMode: 'softLight',
  },
  {
    type: 'linearGradient',
    colors: ['rgba(0, 0, 0, 0)', 'rgba(80, 96, 84, 0.78)'],
    positions: [0.35, 1],
    start: { x: 0.5, y: 0.15 },
    end: { x: 0.5, y: 1 },
    opacity: 0.08,
    blendMode: 'multiply',
  },
  {
    type: 'radialGradient',
    colors: ['rgba(0, 0, 0, 0)', 'rgba(73, 64, 53, 0.55)'],
    positions: [0.68, 1],
    center: { x: 0.5, y: 0.5 },
    radius: 0.82,
    opacity: 0.06,
    blendMode: 'multiply',
  },
  {
    type: 'grain',
      freqX: 1.15,
      freqY: 1.15,
      octaves: 3,
      seed: 18,
      tileScale: 0.22,
      opacity: 0.018,
      blendMode: 'softLight',
  },
];

export const PHOTO_FILTER_PRESETS: PhotoFilterPreset[] = [
  {
    id: 'original',
    labelKey: 'capture.filterOriginal',
    defaultLabel: 'Original',
    tier: 'free',
    matrix: IDENTITY_MATRIX,
  },
  {
    id: 'soft',
    labelKey: 'capture.filterSoft',
    defaultLabel: 'Soft',
    tier: 'free',
    matrix: [
      0.8, 0.11, 0.03, 0, 0.02,
      0.04, 0.84, 0.04, 0, 0.015,
      0.03, 0.09, 0.82, 0, 0.02,
      0, 0, 0, 1, 0,
    ],
    layers: MATTE_CAFE_LAYERS,
  },
  {
    id: 'warm',
    labelKey: 'capture.filterWarm',
    defaultLabel: 'Warm',
    tier: 'plus',
    matrix: [
      1.08, 0.02, 0, 0, 0,
      0.01, 1.01, 0, 0, 0,
      0, 0.01, 0.92, 0, 0,
      0, 0, 0, 1, 0,
    ],
  },
  {
    id: 'cool',
    labelKey: 'capture.filterCool',
    defaultLabel: 'Cool',
    tier: 'plus',
    matrix: [
      0.95, 0, 0.02, 0, 0,
      0, 1, 0.01, 0, 0,
      0.02, 0.01, 1.08, 0, 0,
      0, 0, 0, 1, 0,
    ],
  },
  {
    id: 'mono',
    labelKey: 'capture.filterMono',
    defaultLabel: 'Mono',
    tier: 'plus',
    matrix: [
      0.2126, 0.7152, 0.0722, 0, 0,
      0.2126, 0.7152, 0.0722, 0, 0,
      0.2126, 0.7152, 0.0722, 0, 0,
      0, 0, 0, 1, 0,
    ],
  },
  {
    id: 'vivid',
    labelKey: 'capture.filterVivid',
    defaultLabel: 'Vivid',
    tier: 'plus',
    matrix: [
      1.12, -0.04, -0.04, 0, 0,
      -0.03, 1.12, -0.03, 0, 0,
      -0.03, -0.03, 1.12, 0, 0,
      0, 0, 0, 1, 0,
    ],
  },
  {
    id: 'vintage',
    labelKey: 'capture.filterVintage',
    defaultLabel: 'Vintage',
    tier: 'plus',
    matrix: [
      0.88, 0.08, 0.02, 0, 0,
      0.04, 0.9, 0.02, 0, 0,
      0.02, 0.06, 0.78, 0, 0,
      0, 0, 0, 1, 0,
    ],
  },
];

export const PREMIUM_PHOTO_FILTER_IDS = PHOTO_FILTER_PRESETS
  .filter((preset) => preset.tier === 'plus')
  .map((preset) => preset.id);

const PHOTO_FILTER_MAP = new Map(PHOTO_FILTER_PRESETS.map((preset) => [preset.id, preset]));
const MAX_FILTER_RENDER_DIMENSION = 2048;

export function getPhotoFilterPreset(filterId: PhotoFilterId) {
  return PHOTO_FILTER_MAP.get(filterId) ?? PHOTO_FILTER_MAP.get('original')!;
}

function createLayerPaint(width: number, height: number, layer: PhotoFilterLayer) {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setDither(true);
  paint.setAlphaf(layer.opacity);
  paint.setBlendMode(BLEND_MODE_MAP[layer.blendMode]);

  if (layer.type === 'solid') {
    paint.setColor(Skia.Color(layer.color));
    return paint;
  }

  if (layer.type === 'linearGradient') {
    paint.setShader(
      Skia.Shader.MakeLinearGradient(
        { x: width * layer.start.x, y: height * layer.start.y },
        { x: width * layer.end.x, y: height * layer.end.y },
        layer.colors.map((color) => Skia.Color(color)),
        layer.positions ?? null,
        TileMode.Clamp
      )
    );
    return paint;
  }

  if (layer.type === 'radialGradient') {
    paint.setShader(
      Skia.Shader.MakeRadialGradient(
        { x: width * layer.center.x, y: height * layer.center.y },
        Math.max(width, height) * layer.radius,
        layer.colors.map((color) => Skia.Color(color)),
        layer.positions ?? null,
        TileMode.Clamp
      )
    );
    return paint;
  }

  paint.setShader(
    Skia.Shader.MakeFractalNoise(
      layer.freqX,
      layer.freqY,
      layer.octaves,
      layer.seed,
      Math.max(96, width * layer.tileScale),
      Math.max(96, height * layer.tileScale)
    )
  );
  return paint;
}

export function applyPhotoFilterToCanvas(
  canvas: SkCanvas,
  sourceImage: SkImage,
  preset: PhotoFilterPreset,
  width: number,
  height: number
) {
  const imagePaint = Skia.Paint();
  imagePaint.setAntiAlias(true);
  imagePaint.setDither(true);
  imagePaint.setColorFilter(Skia.ColorFilter.MakeMatrix(preset.matrix));

  canvas.drawImage(sourceImage, 0, 0, imagePaint);

  if (!preset.layers?.length) {
    return;
  }

  const fullRect = Skia.XYWHRect(0, 0, width, height);
  for (const layer of preset.layers) {
    const layerPaint = createLayerPaint(width, height, layer);
    canvas.drawRect(fullRect, layerPaint);
  }
}

async function getImageSize(sourceUri: string) {
  return await new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(
      sourceUri,
      (width, height) => resolve({ width, height }),
      reject
    );
  });
}

export async function renderFilteredPhotoToFile(sourceUri: string, destinationPath: string, filterId: PhotoFilterId) {
  const preset = getPhotoFilterPreset(filterId);
  if (preset.id === 'original') {
    throw new Error('renderFilteredPhotoToFile only supports non-original filters.');
  }

  let workingSourceUri = sourceUri;
  let cleanupUri: string | null = null;

  try {
    const { width, height } = await getImageSize(sourceUri);
    const maxDimension = Math.max(width, height);
    if (Number.isFinite(maxDimension) && maxDimension > MAX_FILTER_RENDER_DIMENSION) {
      const resize =
        width >= height
          ? { width: MAX_FILTER_RENDER_DIMENSION }
          : { height: MAX_FILTER_RENDER_DIMENSION };
      const resized = await manipulateAsync(
        sourceUri,
        [{ resize }],
        {
          compress: 0.95,
          format: SaveFormat.JPEG,
        }
      );
      workingSourceUri = resized.uri;
      cleanupUri = resized.uri !== sourceUri ? resized.uri : null;
    }
  } catch (error) {
    console.warn('[photo-filters] Failed to pre-scale photo before filtering; using the original asset.', error);
  }

  try {
    const sourceData = await Skia.Data.fromURI(workingSourceUri);
    const sourceImage = Skia.Image.MakeImageFromEncoded(sourceData);
    if (!sourceImage) {
      throw new Error(`Could not decode photo for filter "${filterId}".`);
    }

    const surface = Skia.Surface.MakeOffscreen(sourceImage.width(), sourceImage.height());
    if (!surface) {
      throw new Error('Could not create offscreen surface for photo filter rendering.');
    }

    const canvas = surface.getCanvas();
    applyPhotoFilterToCanvas(canvas, sourceImage, preset, sourceImage.width(), sourceImage.height());
    surface.flush();

    const output = surface.makeImageSnapshot();
    const encoded = output.encodeToBase64(ImageFormat.JPEG, 90);
    await writeAsStringAsync(destinationPath, encoded, { encoding: EncodingType.Base64 });
  } finally {
    if (cleanupUri) {
      const cleanupInfo = await getInfoAsync(cleanupUri).catch(() => null);
      if (cleanupInfo?.exists) {
        await deleteAsync(cleanupUri, { idempotent: true }).catch(() => undefined);
      }
    }
  }
}

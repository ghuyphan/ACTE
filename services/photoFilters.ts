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

export type PhotoFilterImagePass = {
  opacity: number;
  blendMode: PhotoFilterBlendMode;
  blurSigma?: number;
  colorMatrix?: number[];
};

export type PhotoFilterPreset = {
  id: PhotoFilterId;
  labelKey: string;
  defaultLabel: string;
  tier: PlanTier;
  previewLayers: PhotoFilterLayer[];
  renderMatrix: number[];
  renderPasses?: PhotoFilterImagePass[];
  renderLayers?: PhotoFilterLayer[];
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
    colors: ['rgba(255, 249, 241, 0.78)', 'rgba(236, 227, 212, 0.44)', 'rgba(176, 193, 178, 0.34)'],
    positions: [0, 0.48, 1],
    start: { x: 0.3, y: 0 },
    end: { x: 0.7, y: 1 },
    opacity: 0.08,
    blendMode: 'softLight',
  },
  {
    type: 'linearGradient',
    colors: ['rgba(0, 0, 0, 0)', 'rgba(80, 96, 84, 0.74)'],
    positions: [0.35, 1],
    start: { x: 0.5, y: 0.15 },
    end: { x: 0.5, y: 1 },
    opacity: 0.08,
    blendMode: 'multiply',
  },
  {
    type: 'radialGradient',
    colors: ['rgba(0, 0, 0, 0)', 'rgba(73, 64, 53, 0.48)'],
    positions: [0.68, 1],
    center: { x: 0.5, y: 0.5 },
    radius: 0.82,
    opacity: 0.05,
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

const WARM_GLOW_LAYERS: PhotoFilterLayer[] = [
  {
    type: 'solid',
    color: '#F4D8A9',
    opacity: 0.05,
    blendMode: 'softLight',
  },
  {
    type: 'linearGradient',
    colors: ['rgba(255, 244, 220, 0.75)', 'rgba(239, 181, 105, 0.35)', 'rgba(120, 79, 44, 0.22)'],
    positions: [0, 0.54, 1],
    start: { x: 0.2, y: 0 },
    end: { x: 0.8, y: 1 },
    opacity: 0.09,
    blendMode: 'softLight',
  },
  {
    type: 'grain',
    freqX: 1.12,
    freqY: 1.12,
    octaves: 2,
    seed: 11,
    tileScale: 0.24,
    opacity: 0.012,
    blendMode: 'softLight',
  },
];

const COOL_DUSK_LAYERS: PhotoFilterLayer[] = [
  {
    type: 'solid',
    color: '#D7E5F3',
    opacity: 0.05,
    blendMode: 'softLight',
  },
  {
    type: 'linearGradient',
    colors: ['rgba(225, 239, 255, 0.75)', 'rgba(137, 176, 214, 0.28)', 'rgba(35, 55, 90, 0.4)'],
    positions: [0, 0.58, 1],
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
    opacity: 0.1,
    blendMode: 'softLight',
  },
  {
    type: 'radialGradient',
    colors: ['rgba(0, 0, 0, 0)', 'rgba(27, 38, 61, 0.4)'],
    positions: [0.7, 1],
    center: { x: 0.5, y: 0.48 },
    radius: 0.84,
    opacity: 0.04,
    blendMode: 'multiply',
  },
];

const MONO_MATTE_LAYERS: PhotoFilterLayer[] = [
  {
    type: 'solid',
    color: '#ECE9E2',
    opacity: 0.04,
    blendMode: 'softLight',
  },
  {
    type: 'radialGradient',
    colors: ['rgba(255,255,255,0)', 'rgba(28, 28, 30, 0.32)'],
    positions: [0.72, 1],
    center: { x: 0.5, y: 0.5 },
    radius: 0.85,
    opacity: 0.04,
    blendMode: 'multiply',
  },
  {
    type: 'grain',
    freqX: 1.2,
    freqY: 1.2,
    octaves: 3,
    seed: 9,
    tileScale: 0.18,
    opacity: 0.018,
    blendMode: 'softLight',
  },
];

const VIVID_POP_LAYERS: PhotoFilterLayer[] = [
  {
    type: 'solid',
    color: '#FFE5C7',
    opacity: 0.04,
    blendMode: 'screen',
  },
  {
    type: 'linearGradient',
    colors: ['rgba(255, 208, 168, 0.48)', 'rgba(255, 255, 255, 0)', 'rgba(77, 150, 171, 0.3)'],
    positions: [0, 0.5, 1],
    start: { x: 0, y: 0.1 },
    end: { x: 1, y: 0.9 },
    opacity: 0.08,
    blendMode: 'softLight',
  },
];

const VINTAGE_FILM_LAYERS: PhotoFilterLayer[] = [
  {
    type: 'solid',
    color: '#EADBC3',
    opacity: 0.06,
    blendMode: 'softLight',
  },
  {
    type: 'linearGradient',
    colors: ['rgba(249, 241, 224, 0.74)', 'rgba(207, 181, 134, 0.26)', 'rgba(92, 102, 82, 0.30)'],
    positions: [0, 0.52, 1],
    start: { x: 0.12, y: 0.02 },
    end: { x: 0.84, y: 1 },
    opacity: 0.1,
    blendMode: 'softLight',
  },
  {
    type: 'linearGradient',
    colors: ['rgba(0, 0, 0, 0)', 'rgba(80, 69, 48, 0.72)'],
    positions: [0.42, 1],
    start: { x: 0.5, y: 0.1 },
    end: { x: 0.5, y: 1 },
    opacity: 0.06,
    blendMode: 'multiply',
  },
  {
    type: 'radialGradient',
    colors: ['rgba(255, 245, 226, 0)', 'rgba(73, 59, 39, 0.5)'],
    positions: [0.66, 1],
    center: { x: 0.5, y: 0.48 },
    radius: 0.9,
    opacity: 0.09,
    blendMode: 'multiply',
  },
  {
    type: 'grain',
    freqX: 1.08,
    freqY: 1.08,
    octaves: 4,
    seed: 14,
    tileScale: 0.16,
    opacity: 0.024,
    blendMode: 'softLight',
  },
  {
    type: 'grain',
    freqX: 0.92,
    freqY: 0.92,
    octaves: 2,
    seed: 27,
    tileScale: 0.24,
    opacity: 0.018,
    blendMode: 'multiply',
  },
];

const RETRO_HALATION_PASSES: PhotoFilterImagePass[] = [
  {
    blurSigma: 10,
    opacity: 0.18,
    blendMode: 'screen',
    colorMatrix: [
      1.15, 0.06, 0.01, 0, 0.01,
      0.03, 1.02, 0.01, 0, 0.005,
      0.01, 0.02, 0.72, 0, 0,
      0, 0, 0, 1, 0,
    ],
  },
  {
    blurSigma: 3,
    opacity: 0.1,
    blendMode: 'softLight',
    colorMatrix: [
      1.03, 0.01, 0, 0, 0,
      0.01, 1.01, 0, 0, 0,
      0, 0.01, 0.94, 0, 0,
      0, 0, 0, 1, 0,
    ],
  },
];

export const PHOTO_FILTER_PRESETS: PhotoFilterPreset[] = [
  {
    id: 'original',
    labelKey: 'capture.filterOriginal',
    defaultLabel: 'Original',
    tier: 'free',
    previewLayers: [],
    renderMatrix: IDENTITY_MATRIX,
  },
  {
    id: 'soft',
    labelKey: 'capture.filterSoft',
    defaultLabel: 'Soft',
    tier: 'free',
    previewLayers: MATTE_CAFE_LAYERS,
    renderMatrix: [
      0.8, 0.11, 0.03, 0, 0.02,
      0.04, 0.84, 0.04, 0, 0.015,
      0.03, 0.09, 0.82, 0, 0.02,
      0, 0, 0, 1, 0,
    ],
    renderLayers: MATTE_CAFE_LAYERS,
  },
  {
    id: 'warm',
    labelKey: 'capture.filterWarm',
    defaultLabel: 'Warm',
    tier: 'plus',
    previewLayers: WARM_GLOW_LAYERS,
    renderMatrix: [
      1.08, 0.02, 0, 0, 0,
      0.01, 1.01, 0, 0, 0,
      0, 0.01, 0.92, 0, 0,
      0, 0, 0, 1, 0,
    ],
    renderLayers: WARM_GLOW_LAYERS,
  },
  {
    id: 'cool',
    labelKey: 'capture.filterCool',
    defaultLabel: 'Cool',
    tier: 'plus',
    previewLayers: COOL_DUSK_LAYERS,
    renderMatrix: [
      0.95, 0, 0.02, 0, 0,
      0, 1, 0.01, 0, 0,
      0.02, 0.01, 1.08, 0, 0,
      0, 0, 0, 1, 0,
    ],
    renderLayers: COOL_DUSK_LAYERS,
  },
  {
    id: 'mono',
    labelKey: 'capture.filterMono',
    defaultLabel: 'Mono',
    tier: 'plus',
    previewLayers: MONO_MATTE_LAYERS,
    renderMatrix: [
      0.2126, 0.7152, 0.0722, 0, 0,
      0.2126, 0.7152, 0.0722, 0, 0,
      0.2126, 0.7152, 0.0722, 0, 0,
      0, 0, 0, 1, 0,
    ],
    renderLayers: MONO_MATTE_LAYERS,
  },
  {
    id: 'vivid',
    labelKey: 'capture.filterVivid',
    defaultLabel: 'Vivid',
    tier: 'plus',
    previewLayers: VIVID_POP_LAYERS,
    renderMatrix: [
      1.12, -0.04, -0.04, 0, 0,
      -0.03, 1.12, -0.03, 0, 0,
      -0.03, -0.03, 1.12, 0, 0,
      0, 0, 0, 1, 0,
    ],
    renderLayers: VIVID_POP_LAYERS,
  },
  {
    id: 'vintage',
    labelKey: 'capture.filterVintage',
    defaultLabel: 'Vintage',
    tier: 'plus',
    previewLayers: VINTAGE_FILM_LAYERS,
    renderMatrix: [
      0.84, 0.09, 0.03, 0, 0.015,
      0.05, 0.9, 0.02, 0, 0.008,
      0.03, 0.08, 0.72, 0, 0.012,
      0, 0, 0, 1, 0,
    ],
    renderPasses: RETRO_HALATION_PASSES,
    renderLayers: VINTAGE_FILM_LAYERS,
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

function createImagePassPaint(pass: PhotoFilterImagePass) {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setDither(true);
  paint.setAlphaf(pass.opacity);
  paint.setBlendMode(BLEND_MODE_MAP[pass.blendMode]);

  if (pass.colorMatrix) {
    paint.setColorFilter(Skia.ColorFilter.MakeMatrix(pass.colorMatrix));
  }

  if (pass.blurSigma && pass.blurSigma > 0) {
    paint.setImageFilter(
      Skia.ImageFilter.MakeBlur(pass.blurSigma, pass.blurSigma, TileMode.Decal, null)
    );
  }

  return paint;
}

export function applyPhotoFilterLayerStack(
  canvas: SkCanvas,
  width: number,
  height: number,
  layers: PhotoFilterLayer[]
) {
  if (!layers.length) {
    return;
  }

  const fullRect = Skia.XYWHRect(0, 0, width, height);
  for (const layer of layers) {
    const layerPaint = createLayerPaint(width, height, layer);
    canvas.drawRect(fullRect, layerPaint);
  }
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
  imagePaint.setColorFilter(Skia.ColorFilter.MakeMatrix(preset.renderMatrix));

  canvas.drawImage(sourceImage, 0, 0, imagePaint);

  for (const pass of preset.renderPasses ?? []) {
    const passPaint = createImagePassPaint(pass);
    canvas.drawImage(sourceImage, 0, 0, passPaint);
  }

  applyPhotoFilterLayerStack(canvas, width, height, preset.renderLayers ?? preset.previewLayers);
}

async function getImageSize(sourceUri: string) {
  return await new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(
      sourceUri,
      (nextWidth, nextHeight) => resolve({ width: nextWidth, height: nextHeight }),
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

import { ImageFormat, Skia } from '@shopify/react-native-skia';
import type { PlanTier } from '../constants/subscription';
import { EncodingType, writeAsStringAsync } from '../utils/fileSystem';

export type PhotoFilterId = 'original' | 'warm' | 'cool' | 'mono' | 'vivid' | 'vintage';

export type PhotoFilterPreset = {
  id: PhotoFilterId;
  labelKey: string;
  defaultLabel: string;
  tier: PlanTier;
  matrix: number[];
};

const IDENTITY_MATRIX = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
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

export function getPhotoFilterPreset(filterId: PhotoFilterId) {
  return PHOTO_FILTER_MAP.get(filterId) ?? PHOTO_FILTER_MAP.get('original')!;
}

export async function renderFilteredPhotoToFile(sourceUri: string, destinationPath: string, filterId: PhotoFilterId) {
  const preset = getPhotoFilterPreset(filterId);
  if (preset.id === 'original') {
    throw new Error('renderFilteredPhotoToFile only supports non-original filters.');
  }

  const sourceData = await Skia.Data.fromURI(sourceUri);
  const sourceImage = Skia.Image.MakeImageFromEncoded(sourceData);
  if (!sourceImage) {
    throw new Error(`Could not decode photo for filter "${filterId}".`);
  }

  const surface = Skia.Surface.MakeOffscreen(sourceImage.width(), sourceImage.height());
  if (!surface) {
    throw new Error('Could not create offscreen surface for photo filter rendering.');
  }

  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColorFilter(Skia.ColorFilter.MakeMatrix(preset.matrix));

  const canvas = surface.getCanvas();
  canvas.drawImage(sourceImage, 0, 0, paint);
  surface.flush();

  const output = surface.makeImageSnapshot();
  const encoded = output.encodeToBase64(ImageFormat.JPEG, 90);
  await writeAsStringAsync(destinationPath, encoded, { encoding: EncodingType.Base64 });
}

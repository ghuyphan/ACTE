import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type { TFunction } from 'i18next';
import { Image } from 'react-native';
import * as FileSystem from '../utils/fileSystem';
import { showAppAlert } from '../utils/alert';

const PROFILE_AVATAR_IMPORT_OPTIMIZATION_PRESETS = [
  { maxDimension: 512, compress: 0.86 },
  { maxDimension: 384, compress: 0.78 },
  { maxDimension: 256, compress: 0.68 },
];
const MAX_PROFILE_AVATAR_SIZE_BYTES = 120 * 1024;

function getImageSize(uri: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error)
    );
  });
}

function buildResizeActions(
  width: number,
  height: number,
  maxDimension: number
) {
  if (width <= maxDimension && height <= maxDimension) {
    return [];
  }

  return width >= height
    ? [{ resize: { width: maxDimension } }]
    : [{ resize: { height: maxDimension } }];
}

async function readFileSize(uri: string) {
  const info = await FileSystem.getInfoAsync(uri).catch(() => null);
  if (!info?.exists || info.isDirectory) {
    return null;
  }

  return typeof info.size === 'number' ? info.size : null;
}

async function optimizeAvatarImage(uri: string) {
  let currentUri = uri;
  let currentSize = await getImageSize(uri);
  let bestUri = uri;
  let bestFileSize = await readFileSize(uri);
  const cleanupUris: string[] = [];

  for (const preset of PROFILE_AVATAR_IMPORT_OPTIMIZATION_PRESETS) {
    const result = await manipulateAsync(
      currentUri,
      buildResizeActions(currentSize.width, currentSize.height, preset.maxDimension),
      {
        compress: preset.compress,
        format: SaveFormat.JPEG,
      }
    );

    if (result.uri !== uri) {
      cleanupUris.push(result.uri);
    }

    currentUri = result.uri;
    currentSize = {
      width: Math.max(1, Math.round(result.width ?? currentSize.width)),
      height: Math.max(1, Math.round(result.height ?? currentSize.height)),
    };

    const nextFileSize = await readFileSize(result.uri);
    if (bestFileSize === null || (nextFileSize !== null && nextFileSize < bestFileSize)) {
      bestUri = result.uri;
      bestFileSize = nextFileSize;
    }

    if (
      currentSize.width <= preset.maxDimension &&
      currentSize.height <= preset.maxDimension &&
      (nextFileSize === null || nextFileSize <= MAX_PROFILE_AVATAR_SIZE_BYTES)
    ) {
      return {
        uri: result.uri,
        cleanupUris,
      };
    }
  }

  return {
    uri: bestUri,
    cleanupUris,
  };
}

async function convertImageToDataUri(uri: string) {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (!base64.trim()) {
    throw new Error('Avatar file is empty.');
  }

  return `data:image/jpeg;base64,${base64}`;
}

export async function pickCompressedProfileAvatarDataUri(t: TFunction) {
  let mediaPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (mediaPermission.status !== 'granted') {
    mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  }

  if (mediaPermission.status !== 'granted') {
    showAppAlert(
      t('capture.photoLibraryPermissionTitle', 'Photo access needed'),
      mediaPermission.canAskAgain === false
        ? t(
            'capture.photoLibraryPermissionSettingsMsg',
            'Photo library access is blocked for Noto. Open Settings to import from your library.'
          )
        : t(
            'capture.photoLibraryPermissionMsg',
            'Allow photo library access so you can import an image into this note.'
          )
    );
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
    selectionLimit: 1,
  });

  if (result.canceled || !result.assets?.[0]?.uri) {
    return null;
  }

  const optimized = await optimizeAvatarImage(result.assets[0].uri);
  try {
    return await convertImageToDataUri(optimized.uri);
  } finally {
    await Promise.all(
      optimized.cleanupUris.map((cleanupUri) =>
        FileSystem.deleteAsync(cleanupUri, { idempotent: true }).catch(() => undefined)
      )
    );
  }
}

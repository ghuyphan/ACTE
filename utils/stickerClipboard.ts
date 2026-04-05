import {
  cacheDirectory as fileSystemCacheDirectory,
  deleteAsync as deleteFileAsync,
  EncodingType,
  writeAsStringAsync,
} from './fileSystem';
import { decode as decodeBase64ArrayBuffer } from 'base64-arraybuffer';
import { importStickerAsset, type StickerAsset } from '../services/noteStickers';

const CLIPBOARD_STICKER_PREFIX = 'data:image/png;base64,';

type ClipboardModule = {
  getImageAsync: (options: { format: 'png' | 'jpeg'; jpegQuality?: number }) => Promise<{
    data: string;
    size: {
      width: number;
      height: number;
    };
  } | null>;
  hasImageAsync: () => Promise<boolean>;
};

export type ClipboardStickerMessages = {
  requiresUpdate: string;
  unavailable: string;
  unsupported: string;
  storageUnavailable: string;
  permissionDenied: string;
};

export class ClipboardStickerError extends Error {
  code:
    | 'requires-update'
    | 'unavailable'
    | 'unsupported'
    | 'storage-unavailable'
    | 'permission-denied';

  constructor(
    code:
      | 'requires-update'
      | 'unavailable'
      | 'unsupported'
      | 'storage-unavailable'
      | 'permission-denied',
    message: string
  ) {
    super(message);
    this.name = 'ClipboardStickerError';
    this.code = code;
  }
}

function getClipboardStickerBase64(data: string) {
  return data.startsWith(CLIPBOARD_STICKER_PREFIX)
    ? data.slice(CLIPBOARD_STICKER_PREFIX.length)
    : null;
}

function parsePngHasTransparency(bytes: Uint8Array) {
  if (bytes.length < 33) {
    return false;
  }

  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!pngSignature.every((value, index) => bytes[index] === value)) {
    return false;
  }

  const colorType = bytes[25] ?? 0;
  if (colorType === 4 || colorType === 6) {
    return true;
  }

  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length =
      ((bytes[offset] ?? 0) << 24) |
      ((bytes[offset + 1] ?? 0) << 16) |
      ((bytes[offset + 2] ?? 0) << 8) |
      (bytes[offset + 3] ?? 0);
    const type = String.fromCharCode(
      bytes[offset + 4] ?? 0,
      bytes[offset + 5] ?? 0,
      bytes[offset + 6] ?? 0,
      bytes[offset + 7] ?? 0
    );

    if (type === 'tRNS') {
      return true;
    }

    offset += 12 + length;
    if (type === 'IEND') {
      break;
    }
  }

  return false;
}

export function clipboardImageDataHasTransparency(data: string) {
  const base64 = getClipboardStickerBase64(data);
  if (!base64) {
    return false;
  }

  try {
    return parsePngHasTransparency(new Uint8Array(decodeBase64ArrayBuffer(base64)));
  } catch {
    return false;
  }
}

async function loadClipboardModule() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-clipboard') as ClipboardModule;
  } catch (error) {
    console.warn('Clipboard module unavailable in this build:', error);
    return null;
  }
}

export async function hasClipboardStickerImage() {
  const clipboardModule = await loadClipboardModule();
  if (!clipboardModule?.hasImageAsync) {
    return false;
  }

  try {
    return await clipboardModule.hasImageAsync();
  } catch {
    return false;
  }
}

export async function hasTransparentClipboardStickerImage() {
  const clipboardModule = await loadClipboardModule();
  if (!clipboardModule?.hasImageAsync || !clipboardModule?.getImageAsync) {
    return false;
  }

  try {
    const hasImage = await clipboardModule.hasImageAsync();
    if (!hasImage) {
      return false;
    }

    const clipboardImage = await clipboardModule.getImageAsync({ format: 'png' });
    return !!clipboardImage?.data && clipboardImageDataHasTransparency(clipboardImage.data);
  } catch (error) {
    if (isClipboardPermissionDeniedError(error)) {
      return false;
    }

    return false;
  }
}

function isClipboardPermissionDeniedError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.toLowerCase();
  return (
    normalizedMessage.includes('no permission to read this clipboard item') ||
    (normalizedMessage.includes('clipboard') && normalizedMessage.includes('permission'))
  );
}

async function importStickerAssetFromClipboardBase64(
  base64DataUri: string,
  messages: ClipboardStickerMessages
): Promise<StickerAsset> {
  let clipboardTempUri: string | null = null;

  try {
    const base64 = getClipboardStickerBase64(base64DataUri);
    if (!base64) {
      throw new ClipboardStickerError('unsupported', messages.unsupported);
    }

    if (!fileSystemCacheDirectory) {
      throw new ClipboardStickerError('storage-unavailable', messages.storageUnavailable);
    }

    clipboardTempUri = `${fileSystemCacheDirectory}clipboard-sticker-${Date.now()}.png`;
    await writeAsStringAsync(clipboardTempUri, base64, {
      encoding: EncodingType.Base64,
    });

    return await importStickerAsset({
      uri: clipboardTempUri,
      mimeType: 'image/png',
      name: 'clipboard-sticker.png',
    });
  } finally {
    if (clipboardTempUri) {
      await deleteFileAsync(clipboardTempUri, { idempotent: true }).catch(() => undefined);
    }
  }
}

export async function importStickerAssetFromClipboardImageData(
  base64DataUri: string,
  messages: ClipboardStickerMessages
): Promise<StickerAsset> {
  return importStickerAssetFromClipboardBase64(base64DataUri, messages);
}

export async function importStickerAssetFromClipboard(
  messages: ClipboardStickerMessages
): Promise<StickerAsset> {
  const clipboardModule = await loadClipboardModule();
  if (!clipboardModule?.hasImageAsync || !clipboardModule?.getImageAsync) {
    throw new ClipboardStickerError('requires-update', messages.requiresUpdate);
  }

  const hasImage = await clipboardModule.hasImageAsync();
  if (!hasImage) {
    throw new ClipboardStickerError('unavailable', messages.unavailable);
  }

  let clipboardImage: { data: string } | null = null;

  try {
    clipboardImage = await clipboardModule.getImageAsync({ format: 'png' });
  } catch (error) {
    if (isClipboardPermissionDeniedError(error)) {
      throw new ClipboardStickerError('permission-denied', messages.permissionDenied);
    }

    throw error;
  }

  if (!clipboardImage?.data) {
    throw new ClipboardStickerError('unavailable', messages.unavailable);
  }

  return importStickerAssetFromClipboardBase64(clipboardImage.data, messages);
}

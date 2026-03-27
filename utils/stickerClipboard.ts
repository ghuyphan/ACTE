import {
  cacheDirectory as fileSystemCacheDirectory,
  deleteAsync as deleteFileAsync,
  EncodingType,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
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
};

export class ClipboardStickerError extends Error {
  code: 'requires-update' | 'unavailable' | 'unsupported' | 'storage-unavailable';

  constructor(
    code: 'requires-update' | 'unavailable' | 'unsupported' | 'storage-unavailable',
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

export async function importStickerAssetFromClipboard(
  messages: ClipboardStickerMessages
): Promise<StickerAsset> {
  let clipboardTempUri: string | null = null;

  try {
    const clipboardModule = await loadClipboardModule();
    if (!clipboardModule?.hasImageAsync || !clipboardModule?.getImageAsync) {
      throw new ClipboardStickerError('requires-update', messages.requiresUpdate);
    }

    const hasImage = await clipboardModule.hasImageAsync();
    if (!hasImage) {
      throw new ClipboardStickerError('unavailable', messages.unavailable);
    }

    const clipboardImage = await clipboardModule.getImageAsync({ format: 'png' });
    const base64 = clipboardImage?.data ? getClipboardStickerBase64(clipboardImage.data) : null;
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

import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { TFunction } from 'i18next';
import { useStickerCreationFlow } from '../hooks/ui/useStickerCreationFlow';

const mockPrepareStampCutterDraft = jest.fn();
const mockShouldImportSourceDirectlyAsSticker = jest.fn();
const mockCleanupSchedule = jest.fn();
const mockPrepareStickerSubjectCutout = jest.fn();

jest.mock('../services/stampCutter', () => ({
  exportStampCutoutImageSource: jest.fn(),
  prepareStampCutterDraft: (...args: unknown[]) => mockPrepareStampCutterDraft(...args),
}));

jest.mock('../services/noteStickers', () => ({
  shouldImportSourceDirectlyAsSticker: (...args: unknown[]) =>
    mockShouldImportSourceDirectlyAsSticker(...args),
}));

jest.mock('../services/stickerSubjectCutout', () => ({
  SubjectCutoutError: class SubjectCutoutError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  cleanupStickerTempUri: jest.fn(),
  createStickerImportSourceFromSubjectCutout: jest.fn(),
  prepareStickerSubjectCutout: (...args: unknown[]) => mockPrepareStickerSubjectCutout(...args),
}));

jest.mock('../services/stickerTempFiles', () => ({
  cleanupStickerTempUri: jest.fn(),
  cleanupStickerTempUris: jest.fn(),
}));

jest.mock('../hooks/ui/useDeferredUriCleanup', () => ({
  useDeferredUriCleanup: () => ({
    clear: jest.fn(),
    flush: jest.fn(),
    schedule: (...args: unknown[]) => mockCleanupSchedule(...args),
  }),
}));

describe('useStickerCreationFlow', () => {
  const pickStickerImportSource = jest.fn(async () => ({
    source: {
      uri: 'file:///photo.jpg',
      mimeType: 'image/jpeg',
      name: 'photo.jpg',
    },
    width: 1600,
    height: 1200,
  }));
  const importStickerFromSource = jest.fn();
  const runImportingStickerTask = (async <T,>(task: () => Promise<T>) => task()) as
    <T>(task: () => Promise<T>) => Promise<T>;
  const dismissStickerUi = jest.fn();
  const getErrorMessage = jest.fn(() => 'Import failed');
  const t = ((key: string, fallback?: string) => fallback ?? key) as TFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrepareStampCutterDraft.mockResolvedValue({
      source: {
        uri: 'file:///photo.jpg',
        mimeType: 'image/jpeg',
        name: 'photo.jpg',
      },
      width: 1600,
      height: 1200,
      cleanupUri: 'file:///tmp/stamp-preview.jpg',
    });
    mockShouldImportSourceDirectlyAsSticker.mockResolvedValue(true);
    mockPrepareStickerSubjectCutout.mockResolvedValue(undefined);
  });

  it('clears the stamp preview draft even if the current render still thinks importing is active', async () => {
    const { result, rerender } = renderHook(
      (({ importingSticker }: { importingSticker: boolean }) =>
        useStickerCreationFlow({
          dismissStickerUi,
          enablePhotoStickers: true,
          getErrorMessage,
          importStickerFromSource,
          importingSticker,
          pickStickerImportSource,
          runImportingStickerTask,
          t,
        })) as ({
          importingSticker,
        }: {
          importingSticker: boolean;
        }) => ReturnType<typeof useStickerCreationFlow>,
      {
        initialProps: { importingSticker: false },
      }
    );

    await act(async () => {
      await result.current.handlePrepareStampPreview();
    });

    await waitFor(() => {
      expect(result.current.showStampPreviewEditor).toBe(true);
    });

    rerender({ importingSticker: true });

    act(() => {
      result.current.handleCloseStampPreviewEditor();
    });

    expect(result.current.showStampPreviewEditor).toBe(false);
    expect(mockCleanupSchedule).toHaveBeenCalledWith('file:///tmp/stamp-preview.jpg');
  });
});

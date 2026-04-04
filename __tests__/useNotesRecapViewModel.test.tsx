import { renderHook, waitFor } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import { useNotesRecapViewModel } from '../hooks/state/useNotesRecapViewModel';
import type { Note } from '../services/database';

let mockLanguage = 'en';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValueOrOptions?: unknown) =>
      typeof defaultValueOrOptions === 'string' ? defaultValueOrOptions : _key,
    i18n: { language: mockLanguage },
  }),
}));

jest.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#f59e0b',
      accent: '#ea580c',
      secondaryText: '#6b7280',
    },
  }),
}));

jest.mock('../services/database', () => ({
  getCachedMonthlyRecaps: jest.fn(async () => new Map()),
  refreshCachedMonthlyRecapForMonthKey: jest.fn(async () => null),
}));

function buildNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    type: 'text',
    content: 'Memory',
    photoLocalUri: null,
    photoSyncedLocalUri: null,
    photoRemoteBase64: null,
    isLivePhoto: false,
    pairedVideoLocalUri: null,
    pairedVideoSyncedLocalUri: null,
    pairedVideoRemotePath: null,
    locationName: 'Cafe',
    promptId: null,
    promptTextSnapshot: null,
    promptAnswer: null,
    moodEmoji: null,
    noteColor: null,
    latitude: 10.7,
    longitude: 106.6,
    radius: 150,
    isFavorite: false,
    hasDoodle: false,
    doodleStrokesJson: null,
    hasStickers: false,
    stickerPlacementsJson: null,
    createdAt: '2026-04-10T00:00:00.000Z',
    updatedAt: null,
    ...overrides,
  };
}

function buildStickerPlacementsJson(index: number) {
  return JSON.stringify([
    {
      id: `placement-${index}`,
      assetId: `asset-${index}`,
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
      zIndex: 1,
      opacity: 1,
      outlineEnabled: true,
      renderMode: index % 2 === 0 ? 'stamp' : 'default',
      asset: {
        id: `asset-${index}`,
        ownerUid: '__local__',
        localUri: `file:///sticker-${index}.png`,
        remotePath: null,
        uploadFingerprint: null,
        mimeType: 'image/png',
        width: 240,
        height: 180,
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: null,
        source: 'import',
      },
    },
  ]);
}

describe('useNotesRecapViewModel', () => {
  beforeEach(() => {
    mockLanguage = 'en';
    jest
      .spyOn(ReactNative, 'useWindowDimensions')
      .mockReturnValue({ width: 430, height: 932, scale: 3, fontScale: 1 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not cap month recap pile items at eight', async () => {
    const notes: Note[] = [
      ...Array.from({ length: 9 }, (_, index) =>
        buildNote({
          id: `photo-${index + 1}`,
          type: 'photo',
          content: `file:///photo-${index + 1}.jpg`,
          photoLocalUri: `file:///photo-${index + 1}.jpg`,
          createdAt: `2026-04-${String(index + 1).padStart(2, '0')}T08:00:00.000Z`,
        })
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        buildNote({
          id: `sticker-note-${index + 1}`,
          hasStickers: true,
          stickerPlacementsJson: buildStickerPlacementsJson(index + 1),
          createdAt: `2026-04-${String(index + 11).padStart(2, '0')}T08:00:00.000Z`,
        })
      ),
    ];

    const { result } = renderHook(() => useNotesRecapViewModel({ notes }));

    await waitFor(() => {
      expect(result.current.pileItems).toHaveLength(12);
    });

    expect(result.current.pileTitle).toBe('Saved this month');
    expect(result.current.pileItems.filter((item) => item.kind === 'photo')).toHaveLength(9);
    expect(result.current.pileItems.filter((item) => item.kind === 'sticker')).toHaveLength(3);
  });

  it('does not cap month recap sticker usage at six items', async () => {
    const notes: Note[] = [
      ...Array.from({ length: 3 }, (_, index) =>
        buildNote({
          id: `photo-mix-${index + 1}`,
          type: 'photo',
          content: `file:///mix-photo-${index + 1}.jpg`,
          photoLocalUri: `file:///mix-photo-${index + 1}.jpg`,
          createdAt: `2026-04-${String(index + 1).padStart(2, '0')}T08:00:00.000Z`,
        })
      ),
      ...Array.from({ length: 9 }, (_, index) =>
        buildNote({
          id: `sticker-mix-${index + 1}`,
          hasStickers: true,
          stickerPlacementsJson: buildStickerPlacementsJson(index + 1),
          createdAt: `2026-04-${String(index + 11).padStart(2, '0')}T08:00:00.000Z`,
        })
      ),
    ];

    const { result } = renderHook(() => useNotesRecapViewModel({ notes }));

    await waitFor(() => {
      expect(result.current.pileItems).toHaveLength(12);
    });

    expect(result.current.pileItems.filter((item) => item.kind === 'photo')).toHaveLength(3);
    expect(result.current.pileItems.filter((item) => item.kind === 'sticker')).toHaveLength(9);
  });

  it('uses a shorter month label in Vietnamese', async () => {
    mockLanguage = 'vi';

    const { result } = renderHook(() => useNotesRecapViewModel({ notes: [buildNote()] }));

    await waitFor(() => {
      expect(result.current.activeMonthLabel).toBe('4/2026');
    });
  });
});

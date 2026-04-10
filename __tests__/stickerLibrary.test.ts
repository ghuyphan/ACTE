import { buildCreatedStickerLibrary } from '../components/screens/notes/stickerLibrary';
import type { Note } from '../services/database';

function createPlacement({
  placementId,
  assetId,
  renderMode = 'default',
}: {
  placementId: string;
  assetId: string;
  renderMode?: 'default' | 'stamp';
}) {
  return {
    id: placementId,
    assetId,
    x: 0.5,
    y: 0.5,
    scale: 1,
    rotation: 0,
    zIndex: 1,
    opacity: 1,
    renderMode,
    asset: {
      id: assetId,
      ownerUid: '__local__',
      localUri: `file:///${assetId}.png`,
      remotePath: null,
      mimeType: 'image/png',
      width: 200,
      height: 200,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: null,
      source: 'import' as const,
    },
  };
}

function createNote(overrides: Partial<Note>): Note {
  return {
    id: overrides.id ?? 'note-1',
    type: 'text',
    content: '',
    caption: null,
    photoLocalUri: null,
    photoSyncedLocalUri: null,
    photoRemoteBase64: null,
    isLivePhoto: false,
    pairedVideoLocalUri: null,
    pairedVideoSyncedLocalUri: null,
    pairedVideoRemotePath: null,
    locationName: null,
    promptId: null,
    promptTextSnapshot: null,
    promptAnswer: null,
    moodEmoji: null,
    noteColor: null,
    latitude: 0,
    longitude: 0,
    radius: 150,
    isFavorite: false,
    hasDoodle: false,
    doodleStrokesJson: null,
    hasStickers: true,
    stickerPlacementsJson: null,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: null,
    ...overrides,
  };
}

describe('buildCreatedStickerLibrary', () => {
  it('groups repeated sticker usage from multiple notes', () => {
    const notes = [
      createNote({
        id: 'note-1',
        createdAt: '2026-04-01T00:00:00.000Z',
        stickerPlacementsJson: JSON.stringify([
          createPlacement({ placementId: 'placement-1', assetId: 'asset-1' }),
        ]),
      }),
      createNote({
        id: 'note-2',
        createdAt: '2026-04-03T00:00:00.000Z',
        stickerPlacementsJson: JSON.stringify([
          createPlacement({ placementId: 'placement-2', assetId: 'asset-1' }),
        ]),
      }),
    ];

    expect(buildCreatedStickerLibrary(notes)).toEqual([
      expect.objectContaining({
        id: 'asset-1:default',
        assetId: 'asset-1',
        renderMode: 'default',
        usageCount: 2,
        lastUsedAt: '2026-04-03T00:00:00.000Z',
      }),
    ]);
  });

  it('keeps sticker and stamp versions separate for the same imported asset', () => {
    const notes = [
      createNote({
        stickerPlacementsJson: JSON.stringify([
          createPlacement({ placementId: 'placement-1', assetId: 'asset-1', renderMode: 'default' }),
          createPlacement({ placementId: 'placement-2', assetId: 'asset-1', renderMode: 'stamp' }),
        ]),
      }),
    ];

    const items = buildCreatedStickerLibrary(notes);

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.id).sort()).toEqual([
      'asset-1:default',
      'asset-1:stamp',
    ]);
  });
});

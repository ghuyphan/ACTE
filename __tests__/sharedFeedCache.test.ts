import type { SharedPost } from '../services/sharedFeedService';

const mockRunAsync = jest.fn<Promise<void>, [string, ...unknown[]]>(async () => undefined);
const mockGetAllAsync = jest.fn<Promise<unknown[]>, [string, ...unknown[]]>(async () => []);
const mockGetFirstAsync = jest.fn<Promise<unknown | null>, [string, ...unknown[]]>(async () => null);
const mockTx = {
  runAsync: (sql: string, ...args: unknown[]) => mockRunAsync(sql, ...args),
  getAllAsync: (sql: string, ...args: unknown[]) => mockGetAllAsync(sql, ...args),
  getFirstAsync: (sql: string, ...args: unknown[]) => mockGetFirstAsync(sql, ...args),
};
const mockWithDatabaseTransaction = jest.fn(async (task: (tx: typeof mockTx) => Promise<unknown>) =>
  task(mockTx)
);

jest.mock('../services/database', () => ({
  getDB: async () => mockTx,
  withDatabaseTransaction: (task: (tx: typeof mockTx) => Promise<unknown>) =>
    mockWithDatabaseTransaction(task),
}));

jest.mock('../services/activeInviteStorage', () => ({
  clearStoredActiveInvite: jest.fn(async () => undefined),
  getStoredActiveInvite: jest.fn(async () => null),
  setStoredActiveInvite: jest.fn(async () => undefined),
}));

jest.mock('../services/noteStickers', () => ({
  hasStoredStickerPayload: (value: string | null | undefined) => Boolean(value),
}));

function countSqlPlaceholders(sql: string) {
  return (sql.match(/\?/g) ?? []).length;
}

describe('shared feed cache persistence', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('binds one value per placeholder when replacing cached shared posts', async () => {
    const { replaceCachedSharedPosts } =
      require('../services/sharedFeedCache') as typeof import('../services/sharedFeedCache');

    const post: SharedPost = {
      id: 'post-1',
      authorUid: 'friend-1',
      authorDisplayName: 'Friend',
      authorPhotoURLSnapshot: 'https://example.com/friend.png',
      audienceUserIds: ['owner-1', 'friend-2'],
      type: 'photo',
      text: 'A shared photo',
      photoPath: 'remote/photo.jpg',
      photoLocalUri: 'file:///mock-documents/photos/photo.jpg',
      captureVariant: 'dual',
      dualPrimaryPhotoPath: 'remote/primary.jpg',
      dualSecondaryPhotoPath: 'remote/secondary.jpg',
      dualPrimaryPhotoLocalUri: 'file:///mock-documents/photos/primary.jpg',
      dualSecondaryPhotoLocalUri: 'file:///mock-documents/photos/secondary.jpg',
      isLivePhoto: true,
      pairedVideoPath: 'remote/video.mov',
      pairedVideoLocalUri: 'file:///mock-documents/videos/video.mov',
      dualPrimaryFacing: 'front',
      dualSecondaryFacing: 'back',
      dualLayoutPreset: 'top-left',
      doodleStrokesJson: '{"strokes":[]}',
      hasStickers: true,
      stickerPlacementsJson: '{"stickers":[]}',
      noteColor: 'marigold-glow',
      placeName: 'District 3',
      sourceNoteId: 'note-1',
      latitude: 10.78,
      longitude: 106.68,
      createdAt: '2026-04-02T00:00:00.000Z',
      updatedAt: '2026-04-03T00:00:00.000Z',
    };

    await replaceCachedSharedPosts('owner-1', [post]);

    const insertCall = mockRunAsync.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO shared_posts_cache')
    );

    expect(insertCall).toBeDefined();
    expect(countSqlPlaceholders(insertCall![0])).toBe(insertCall!.length - 1);
    expect(insertCall!.slice(-2)).toEqual([post.createdAt, post.updatedAt]);
  });
});

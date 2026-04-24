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

  it('persists the complete owned shared note id index with the shared feed cache', async () => {
    const { cacheSharedFeedSnapshot, getCachedSharedFeedSnapshot } =
      require('../services/sharedFeedCache') as typeof import('../services/sharedFeedCache');

    await cacheSharedFeedSnapshot('owner-1', {
      friends: [],
      sharedPosts: [],
      activeInvite: null,
      ownedSharedNoteIds: ['note-25', 'note-1', 'note-25', ' '],
    });

    const metaInsertCall = mockRunAsync.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO shared_feed_cache_meta')
    );

    expect(metaInsertCall).toBeDefined();
    expect(metaInsertCall).toEqual(
      expect.arrayContaining(['owner-1', JSON.stringify(['note-1', 'note-25'])])
    );

    mockGetAllAsync.mockResolvedValue([]);
    mockGetFirstAsync.mockResolvedValue({
      last_updated_at: '2026-04-24T00:00:00.000Z',
      owned_shared_note_ids: JSON.stringify(['note-1', 'note-25']),
    });

    const snapshot = await getCachedSharedFeedSnapshot('owner-1');

    expect(snapshot.ownedSharedNoteIds).toEqual(['note-1', 'note-25']);
  });

  it('binds one value per placeholder when caching a full shared feed snapshot', async () => {
    const { cacheSharedFeedSnapshot } =
      require('../services/sharedFeedCache') as typeof import('../services/sharedFeedCache');

    const post: SharedPost = {
      id: 'post-1',
      authorUid: 'owner-1',
      authorDisplayName: 'Owner',
      authorPhotoURLSnapshot: null,
      audienceUserIds: ['owner-1', 'friend-1'],
      type: 'text',
      text: 'cached snapshot',
      photoPath: null,
      photoLocalUri: null,
      captureVariant: null,
      dualPrimaryPhotoPath: null,
      dualSecondaryPhotoPath: null,
      dualPrimaryPhotoLocalUri: null,
      dualSecondaryPhotoLocalUri: null,
      isLivePhoto: false,
      pairedVideoPath: null,
      pairedVideoLocalUri: null,
      dualPrimaryFacing: null,
      dualSecondaryFacing: null,
      dualLayoutPreset: null,
      doodleStrokesJson: null,
      hasStickers: false,
      stickerPlacementsJson: null,
      noteColor: null,
      placeName: 'District 1',
      sourceNoteId: 'note-1',
      latitude: 10.77,
      longitude: 106.69,
      createdAt: '2026-04-24T00:00:00.000Z',
      updatedAt: null,
    };

    await cacheSharedFeedSnapshot('owner-1', {
      friends: [],
      sharedPosts: [post],
      activeInvite: null,
      ownedSharedNoteIds: ['note-1'],
    });

    const insertCall = mockRunAsync.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO shared_posts_cache')
    );

    expect(insertCall).toBeDefined();
    expect(countSqlPlaceholders(insertCall![0])).toBe(insertCall!.length - 1);
    expect(insertCall!.slice(-2)).toEqual([post.createdAt, post.updatedAt]);
  });

  it('falls back to author-owned shared note ids when the persisted index is empty', async () => {
    const { getCachedSharedFeedSnapshot } =
      require('../services/sharedFeedCache') as typeof import('../services/sharedFeedCache');

    mockGetAllAsync
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'own-post',
          author_uid: 'owner-1',
          author_display_name: null,
          author_photo_url_snapshot: null,
          audience_user_ids: JSON.stringify(['owner-1', 'friend-1']),
          type: 'text',
          text: 'own',
          photo_path: null,
          photo_local_uri: null,
          capture_variant: null,
          dual_primary_photo_path: null,
          dual_secondary_photo_path: null,
          dual_primary_photo_local_uri: null,
          dual_secondary_photo_local_uri: null,
          is_live_photo: 0,
          paired_video_path: null,
          paired_video_local_uri: null,
          dual_primary_facing: null,
          dual_secondary_facing: null,
          dual_layout_preset: null,
          doodle_strokes_json: null,
          sticker_placements_json: null,
          note_color: null,
          place_name: null,
          source_note_id: 'own-note',
          latitude: null,
          longitude: null,
          created_at: '2026-04-24T00:00:00.000Z',
          updated_at: null,
        },
        {
          id: 'friend-post',
          author_uid: 'friend-1',
          author_display_name: null,
          author_photo_url_snapshot: null,
          audience_user_ids: JSON.stringify(['owner-1', 'friend-1']),
          type: 'text',
          text: 'friend',
          photo_path: null,
          photo_local_uri: null,
          capture_variant: null,
          dual_primary_photo_path: null,
          dual_secondary_photo_path: null,
          dual_primary_photo_local_uri: null,
          dual_secondary_photo_local_uri: null,
          is_live_photo: 0,
          paired_video_path: null,
          paired_video_local_uri: null,
          dual_primary_facing: null,
          dual_secondary_facing: null,
          dual_layout_preset: null,
          doodle_strokes_json: null,
          sticker_placements_json: null,
          note_color: null,
          place_name: null,
          source_note_id: 'friend-note',
          latitude: null,
          longitude: null,
          created_at: '2026-04-23T00:00:00.000Z',
          updated_at: null,
        },
      ]);
    mockGetFirstAsync.mockResolvedValue({
      last_updated_at: '2026-04-24T00:00:00.000Z',
      owned_shared_note_ids: JSON.stringify([]),
    });

    const snapshot = await getCachedSharedFeedSnapshot('owner-1');

    expect(snapshot.ownedSharedNoteIds).toEqual(['own-note']);
  });
});

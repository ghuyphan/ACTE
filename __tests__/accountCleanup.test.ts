import { purgeLocalAccountScope } from '../services/accountCleanup';

const mockGetInfoAsync = jest.fn();
const mockDeleteAsync = jest.fn();
const mockRemovePersistentItem = jest.fn();
const mockGetAllNotesForScope = jest.fn();
const mockDeleteAllNotesForScope = jest.fn();
const mockRunAsync = jest.fn();
const mockGetAllAsync = jest.fn();
const mockClearGeofenceRegions = jest.fn();
const mockClearSharedFeedCache = jest.fn();

jest.mock('../utils/fileSystem', () => ({
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
}));

jest.mock('../utils/appStorage', () => ({
  removePersistentItem: (...args: unknown[]) => mockRemovePersistentItem(...args),
}));

jest.mock('../services/database', () => ({
  LOCAL_NOTES_SCOPE: '__local__',
  getAllNotesForScope: (...args: unknown[]) => mockGetAllNotesForScope(...args),
  deleteAllNotesForScope: (...args: unknown[]) => mockDeleteAllNotesForScope(...args),
  getDB: async () => ({
    runAsync: (...args: unknown[]) => mockRunAsync(...args),
    getAllAsync: (...args: unknown[]) => mockGetAllAsync(...args),
  }),
}));

jest.mock('../services/geofenceService', () => ({
  clearGeofenceRegions: (...args: unknown[]) => mockClearGeofenceRegions(...args),
}));

jest.mock('../services/sharedFeedCache', () => ({
  clearSharedFeedCache: (...args: unknown[]) => mockClearSharedFeedCache(...args),
}));

jest.mock('../services/photoStorage', () => ({
  getNotePhotoUri: (note: { content?: string | null }) => note.content ?? null,
}));

jest.mock('../services/livePhotoStorage', () => ({
  getNotePairedVideoUri: (note: { pairedVideoLocalUri?: string | null }) => note.pairedVideoLocalUri ?? null,
}));

jest.mock('../services/noteStickers', () => ({
  parseNoteStickerPlacements: jest.fn(() => []),
}));

describe('purgeLocalAccountScope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInfoAsync.mockResolvedValue({ exists: false, isDirectory: false });
    mockDeleteAsync.mockResolvedValue(undefined);
    mockRemovePersistentItem.mockResolvedValue(undefined);
    mockGetAllNotesForScope.mockResolvedValue([]);
    mockDeleteAllNotesForScope.mockResolvedValue(undefined);
    mockRunAsync.mockResolvedValue(undefined);
    mockGetAllAsync.mockResolvedValue([]);
    mockClearGeofenceRegions.mockResolvedValue(undefined);
    mockClearSharedFeedCache.mockResolvedValue(undefined);
  });

  it('clears persisted sync metadata for the signed-out account', async () => {
    await purgeLocalAccountScope('user-1');

    expect(mockRunAsync).toHaveBeenCalledWith('DELETE FROM sync_queue WHERE owner_uid = ?', 'user-1');
    expect(mockRunAsync).toHaveBeenCalledWith('DELETE FROM sync_state WHERE owner_uid = ?', 'user-1');
    expect(mockRunAsync).toHaveBeenCalledWith('DELETE FROM sync_runs WHERE owner_uid = ?', 'user-1');
    expect(mockRemovePersistentItem).toHaveBeenCalledWith('sync.lastRemoteCursor.user-1');
    expect(mockRemovePersistentItem).toHaveBeenCalledWith('sync.syncedNoteIds.user-1');
    expect(mockRemovePersistentItem).toHaveBeenCalledWith('settings.initialSyncPending.user-1');
  });
});

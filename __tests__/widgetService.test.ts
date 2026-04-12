import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, waitFor } from '@testing-library/react-native';

const mockUpdateTimeline = jest.fn();
const mockGetAllNotes = jest.fn();
const mockGetAllNotesForScope = jest.fn();
const mockGetPersistedActiveNotesScope = jest.fn();
const mockGetForegroundPermissionsAsync = jest.fn();
const mockGetLastKnownPositionAsync = jest.fn();
const mockGetCurrentPositionAsync = jest.fn();
const mockMakeDirectoryAsync = jest.fn();
const mockDeleteAsync = jest.fn();
const mockCopyAsync = jest.fn();
const mockDownloadAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockGetInfoAsync = jest.fn();
const mockReadDirectoryAsync = jest.fn();
const mockGetCachedSharedFeedSnapshot = jest.fn();
const mockRefreshSharedFeed = jest.fn();
const mockDownloadPhotoFromStorage = jest.fn();
let mockCurrentUser: { id: string; uid: string } | null = null;

jest.mock('../constants/i18n', () => {
  let currentLanguage = 'en';
  const translate = jest.fn((key: string, options?: { count?: number }): string => {
    if (key === 'widget.countBadgeOne' || key === 'widget.countBadgeOther') {
      const count = options?.count ?? 0;
      if (currentLanguage === 'vi') {
        return `${count} ghi chú`;
      }
      return key === 'widget.countBadgeOne' ? `${count} note` : `${count} notes`;
    }
    if (key === 'widget.idleText') {
      return currentLanguage === 'vi'
        ? 'Noto se hien dung ghi chu khi ban o gan.'
        : "The right note will appear when you're nearby.";
    }
    if (key === 'widget.memoryReminder') {
      return currentLanguage === 'vi'
        ? 'Mot goi nhac nhe tu noi nay.'
        : 'A quiet reminder from here.';
    }
    if (key === 'widget.modeNearest') {
      return currentLanguage === 'vi'
        ? 'Ky niem gan ban nhat luc nay.'
        : 'Closest memory right now.';
    }
    if (key === 'widget.modePhoto') {
      return currentLanguage === 'vi'
        ? 'Mot ky uc hinh anh de nho lai.'
        : 'A photo memory to revisit.';
    }
    if (key === 'widget.modeShared') {
      return currentLanguage === 'vi'
        ? 'Mot ky uc duoc chia se.'
        : 'A shared memory from someone close.';
    }
    if (key === 'widget.nearbyPlaceOne' || key === 'widget.nearbyPlaceOther') {
      const count = options?.count ?? 0;
      if (currentLanguage === 'vi') {
        return `${count} dia diem gan day`;
      }
      return key === 'widget.nearbyPlaceOne' ? `${count} place nearby` : `${count} places nearby`;
    }
    if (key === 'widget.accessorySaveMemory') {
      return currentLanguage === 'vi' ? 'Luu mot ky niem' : 'Save a memory';
    }
    if (key === 'widget.accessoryAddFirstPlace') {
      return currentLanguage === 'vi' ? 'Them dia diem dau tien' : 'Add your first place';
    }
    if (key === 'widget.accessoryMemoryNearby') {
      return currentLanguage === 'vi' ? 'Goi nho gan day' : 'Memory nearby';
    }
    if (key === 'widget.accessoryOpenApp') {
      return currentLanguage === 'vi' ? 'Mo Noto' : 'Open Noto';
    }
    if (key === 'widget.accessoryAddLabel') {
      return currentLanguage === 'vi' ? 'Them' : 'Add';
    }
    if (key === 'widget.accessorySavedLabel') {
      return currentLanguage === 'vi' ? 'Da luu' : 'Saved';
    }
    if (key === 'widget.accessoryNearLabel') {
      return currentLanguage === 'vi' ? 'Gan' : 'Near';
    }
    if (key === 'widget.livePhotoBadge') {
      return 'Live';
    }
    if (key === 'capture.unknownPlace') {
      return currentLanguage === 'vi' ? 'Khong ro dia diem' : 'Unknown Place';
    }
    return key;
  });

  const mockedI18n = {
    get language() {
      return currentLanguage;
    },
    set language(value: string) {
      currentLanguage = value;
    },
    t: translate,
  };

  return {
    __esModule: true,
    default: mockedI18n,
  };
});

jest.mock('../widgets/LocketWidget', () => ({
  __esModule: true,
  default: {
    updateTimeline: (...args: unknown[]) => mockUpdateTimeline(...args),
  },
}));

jest.mock('../services/database', () => ({
  getAllNotes: (...args: unknown[]) => mockGetAllNotes(...args),
  getAllNotesForScope: (...args: unknown[]) => mockGetAllNotesForScope(...args),
  getPersistedActiveNotesScope: (...args: unknown[]) => mockGetPersistedActiveNotesScope(...args),
  LOCAL_NOTES_SCOPE: '__local__',
}));

jest.mock('../services/sharedFeedCache', () => ({
  getCachedSharedFeedSnapshot: (...args: unknown[]) => mockGetCachedSharedFeedSnapshot(...args),
}));

jest.mock('../services/sharedFeedService', () => ({
  refreshSharedFeed: (...args: unknown[]) => mockRefreshSharedFeed(...args),
}));

jest.mock('../services/remoteMedia', () => ({
  SHARED_POST_MEDIA_BUCKET: 'shared-post-media',
  downloadPhotoFromStorage: (...args: unknown[]) => mockDownloadPhotoFromStorage(...args),
}));

jest.mock('../utils/supabase', () => ({
  getSupabaseUser: async () => mockCurrentUser,
}));

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: (...args: unknown[]) => mockGetForegroundPermissionsAsync(...args),
  getLastKnownPositionAsync: (...args: unknown[]) => mockGetLastKnownPositionAsync(...args),
  getCurrentPositionAsync: (...args: unknown[]) => mockGetCurrentPositionAsync(...args),
  Accuracy: {
    Balanced: 'balanced',
  },
}));

jest.mock('expo-file-system', () => ({
  Paths: {
    appleSharedContainers: {
      'group.com.acte.app': { uri: 'file:///mock-group/' },
    },
  },
}));

jest.mock('../utils/fileSystem', () => ({
  documentDirectory: 'file:///mock-documents/',
  makeDirectoryAsync: (...args: unknown[]) => mockMakeDirectoryAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
  copyAsync: (...args: unknown[]) => mockCopyAsync(...args),
  downloadAsync: (...args: unknown[]) => mockDownloadAsync(...args),
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  readDirectoryAsync: (...args: unknown[]) => mockReadDirectoryAsync(...args),
  EncodingType: {
    Base64: 'base64',
  },
}));

import type { Note } from '../services/database';
import type { SharedPost } from '../services/sharedFeedService';
import {
  __resetWidgetServiceForTests,
  scheduleWidgetDataUpdate,
  selectWidgetNote,
  updateWidgetData,
} from '../services/widgetService';
import i18n from '../constants/i18n';

let warnSpy: jest.SpyInstance;

function buildNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    type: 'text',
    content: 'Remember the usual order',
    locationName: 'District 1',
    latitude: 10.77,
    longitude: 106.69,
    radius: 150,
    isFavorite: false,
    createdAt: '2026-03-10T10:00:00.000Z',
    updatedAt: null,
    ...overrides,
  };
}

function buildSharedPost(overrides: Partial<SharedPost> = {}): SharedPost {
  return {
    id: 'shared-1',
    authorUid: 'friend-1',
    authorDisplayName: 'Friend One',
    authorPhotoURLSnapshot: null,
    audienceUserIds: ['me'],
    type: 'text',
    text: 'Shared memory',
    photoPath: null,
    photoLocalUri: null,
    doodleStrokesJson: null,
    placeName: 'Friend Place',
    sourceNoteId: null,
    createdAt: '2026-03-10T11:00:00.000Z',
    updatedAt: null,
    ...overrides,
  };
}

function getLastTimelineEntries() {
  const call = mockUpdateTimeline.mock.calls.at(-1);
  return (call?.[0] ?? []) as Array<{ date: Date; props: { props: Record<string, unknown> } }>;
}

beforeEach(async () => {
  jest.useRealTimers();
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.clearAllMocks();
  __resetWidgetServiceForTests();
  await AsyncStorage.clear();
  mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
  mockGetLastKnownPositionAsync.mockResolvedValue(null);
  mockGetCurrentPositionAsync.mockResolvedValue(null);
  mockMakeDirectoryAsync.mockResolvedValue(undefined);
  mockDeleteAsync.mockResolvedValue(undefined);
  mockCopyAsync.mockResolvedValue(undefined);
  mockDownloadAsync.mockResolvedValue(undefined);
  mockReadAsStringAsync.mockResolvedValue('base64-image-data');
  mockReadDirectoryAsync.mockResolvedValue([]);
  mockCurrentUser = null;
  mockGetCachedSharedFeedSnapshot.mockResolvedValue({
    friends: [],
    sharedPosts: [],
    activeInvite: null,
    lastUpdatedAt: null,
  });
  mockRefreshSharedFeed.mockResolvedValue({
    friends: [],
    sharedPosts: [],
    activeInvite: null,
  });
  mockDownloadPhotoFromStorage.mockResolvedValue('file:///mock-documents/photos/shared-downloaded.jpg');
  mockGetInfoAsync.mockResolvedValue({
    exists: true,
    isDirectory: false,
    uri: 'file:///mock-documents/photos/latest.jpg',
    size: 1024,
    modificationTime: 0,
  });
  mockGetAllNotes.mockResolvedValue([
    buildNote({
      id: 'newest',
      content: 'Latest note',
      locationName: 'Latest place',
      latitude: 10.8,
      longitude: 106.7,
    }),
    buildNote({
      id: 'older',
      content: 'Older note',
      locationName: 'Old place',
      latitude: 10.7,
      longitude: 106.6,
      createdAt: '2026-03-09T10:00:00.000Z',
    }),
  ]);
  mockGetAllNotesForScope.mockImplementation(async () => mockGetAllNotes());
  mockGetPersistedActiveNotesScope.mockResolvedValue('user-1');
});

afterEach(() => {
  __resetWidgetServiceForTests();
  jest.useRealTimers();
  i18n.language = 'en';
  warnSpy.mockRestore();
});

describe('widgetService', () => {
  it('uses the preferred note when provided', () => {
    const result = selectWidgetNote({
      notes: [
        buildNote({
          id: 'older-note',
          content: 'Older note',
          createdAt: '2026-03-09T10:00:00.000Z',
        }),
        buildNote({
          id: 'preferred-note',
          content: 'Show this one',
          createdAt: '2026-03-10T10:00:00.000Z',
        }),
      ] as any,
      preferredNoteId: 'preferred-note',
    });

    expect(result.selectedNote?.id).toBe('preferred-note');
    expect(result.selectionMode).toBe('latest_memory');
  });

  it('uses the newest nearby personal note before older nearby notes', () => {
    const result = selectWidgetNote({
      notes: [
        buildNote({
          id: 'older-nearby',
          content: 'Older nearby memory',
          locationName: 'Cafe A',
          latitude: 10.0,
          longitude: 106.0,
          createdAt: '2026-03-09T08:00:00.000Z',
        }),
        buildNote({
          id: 'newer-nearby',
          content: 'Newer nearby memory',
          locationName: 'Cafe B',
          latitude: 10.0003,
          longitude: 106.0,
          createdAt: '2026-03-10T10:00:00.000Z',
        }),
        buildNote({
          id: 'far-note',
          content: 'Far away memory',
          locationName: 'Cafe C',
          latitude: 11.0,
          longitude: 107.0,
        }),
      ] as any,
      currentLocation: { latitude: 10.0, longitude: 106.0 },
    });

    expect(result.selectedNote?.id).toBe('newer-nearby');
    expect(result.selectionMode).toBe('nearest_memory');
    expect(result.nearbyPlacesCount).toBe(1);
  });

  it('uses the latest personal note when nothing is nearby', () => {
    const result = selectWidgetNote({
      notes: [
        buildNote({
          id: 'older-note',
          content: 'Older memory',
          locationName: 'Old Place',
          createdAt: '2026-03-09T10:00:00.000Z',
        }),
        buildNote({
          id: 'newest-note',
          content: 'Newest memory',
          locationName: 'Newest Place',
          createdAt: '2026-03-10T12:00:00.000Z',
        }),
      ] as any,
      currentLocation: { latitude: 0.0, longitude: 0.0 },
    });

    expect(result.selectedNote?.id).toBe('newest-note');
    expect(result.selectionMode).toBe('latest_memory');
  });

  it('uses shared content only when there are no eligible personal notes', () => {
    const result = selectWidgetNote({
      notes: [],
      sharedPosts: [
        buildSharedPost({
          id: 'shared-latest',
          text: 'Shared latest memory',
          createdAt: '2026-03-10T12:00:00.000Z',
        }),
      ] as any,
    });

    expect(result.selectedNote?.id).toBe('shared-latest');
    expect(result.selectionMode).toBe('shared_memory');
  });

  it('uses an explicit current location override when updating the widget timeline', async () => {
    mockGetAllNotes.mockResolvedValue([
      buildNote({
        id: 'near-note',
        content: 'She likes the iced tea here',
        locationName: 'Cafe A',
        latitude: 10.0,
        longitude: 106.0,
        createdAt: '2026-03-10T10:00:00.000Z',
      }),
      buildNote({
        id: 'also-near',
        content: 'Another nearby memory',
        locationName: 'Cafe B',
        latitude: 10.0002,
        longitude: 106.0,
        createdAt: '2026-03-09T10:00:00.000Z',
      }),
    ]);

    await updateWidgetData({
      currentLocation: { latitude: 10.0, longitude: 106.0 },
      includeLocationLookup: false,
      referenceDate: new Date('2026-03-10T00:00:00.000Z'),
    });

    const entries = getLastTimelineEntries();

    expect(mockGetForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(entries[0]?.props.props).toEqual(
      expect.objectContaining({
        locationName: 'Cafe A',
        nearbyPlacesCount: 1,
        primaryActionUrl: 'noto:///widget/note/near-note',
      })
    );
  });

  it('loads widget notes from the persisted active scope when no notes are provided', async () => {
    await updateWidgetData({ referenceDate: new Date('2026-03-10T00:00:00.000Z') });

    expect(mockGetPersistedActiveNotesScope).toHaveBeenCalledTimes(1);
    expect(mockGetAllNotesForScope).toHaveBeenCalledWith('user-1');
  });

  it('refreshes shared widget content from the network when asked', async () => {
    mockCurrentUser = { id: 'me', uid: 'me' };
    mockGetAllNotes.mockResolvedValue([]);
    mockRefreshSharedFeed.mockResolvedValue({
      friends: [],
      sharedPosts: [
        buildSharedPost({
          id: 'shared-text-1',
          authorUid: 'friend-2',
          authorDisplayName: 'Bao',
          text: 'Shared hello',
          placeName: 'Friend Cafe',
          createdAt: '2026-03-10T12:00:00.000Z',
        }),
      ],
      activeInvite: null,
    });

    await updateWidgetData({
      referenceDate: new Date('2026-03-10T12:00:00.000Z'),
      includeSharedRefresh: true,
    });

    expect(mockRefreshSharedFeed).toHaveBeenCalled();
    const entries = getLastTimelineEntries();
    expect(entries[0]?.props.props).toEqual(
      expect.objectContaining({
        isSharedContent: true,
        authorDisplayName: 'Bao',
        text: 'Shared hello',
      })
    );
  });

  it('creates a stable repeated timeline for the same payload across slots', async () => {
    await updateWidgetData({ referenceDate: new Date('2026-03-10T07:30:00.000Z') });

    const entries = getLastTimelineEntries();

    expect(entries).toHaveLength(4);
    expect(entries.every((entry) => entry.props.props.text === 'Latest note')).toBe(true);
  });

  it('coalesces scheduled widget refreshes into the latest payload', async () => {
    jest.useFakeTimers();

    scheduleWidgetDataUpdate(
      {
        notes: [
          buildNote({
            id: 'older-note',
            content: 'Older note',
          }),
        ],
        includeLocationLookup: false,
      },
      {
        debounceMs: 120,
      }
    );
    scheduleWidgetDataUpdate(
      {
        notes: [
          buildNote({
            id: 'newest-note',
            content: 'Newest note wins',
          }),
        ],
        includeLocationLookup: false,
        preferredNoteId: 'newest-note',
      },
      {
        debounceMs: 120,
      }
    );

    await act(async () => {
      jest.advanceTimersByTime(120);
    });

    await waitFor(() => {
      expect(mockUpdateTimeline).toHaveBeenCalledTimes(1);
    });

    const entries = getLastTimelineEntries();

    expect(entries[0]?.props.props).toEqual(
      expect.objectContaining({
        text: 'Newest note wins',
        primaryActionUrl: 'noto:///widget/note/newest-note',
      })
    );
  });

  it('throttles scheduled foreground refreshes while still enriching a pending request', async () => {
    jest.useFakeTimers();

    scheduleWidgetDataUpdate(
      {
        notes: [
          buildNote({
            id: 'foreground-note',
            content: 'Foreground note',
            locationName: 'Cafe A',
            latitude: 10.0,
            longitude: 106.0,
          }),
        ],
        includeLocationLookup: false,
      },
      {
        debounceMs: 120,
      }
    );
    scheduleWidgetDataUpdate(
      {
        includeLocationLookup: true,
        currentLocation: { latitude: 10.0, longitude: 106.0 },
      },
      {
        debounceMs: 120,
        throttleKey: 'foreground',
        throttleMs: 60_000,
      }
    );

    await act(async () => {
      jest.advanceTimersByTime(120);
    });

    await waitFor(() => {
      expect(mockUpdateTimeline).toHaveBeenCalledTimes(1);
    });
    expect(getLastTimelineEntries()[0]?.props.props).toEqual(
      expect.objectContaining({
        locationName: 'Cafe A',
        nearbyPlacesCount: 1,
      })
    );

    scheduleWidgetDataUpdate(
      {
        includeLocationLookup: true,
      },
      {
        debounceMs: 120,
        throttleKey: 'foreground',
        throttleMs: 60_000,
      }
    );

    await act(async () => {
      jest.advanceTimersByTime(120);
    });

    expect(mockUpdateTimeline).toHaveBeenCalledTimes(1);
  });

  it('uses a photo caption as widget text when the photo file is unreadable', async () => {
    mockGetAllNotes.mockResolvedValue([
      buildNote({
        id: 'caption-only-photo',
        type: 'photo',
        content: 'file:///mock-documents/photos/missing.jpg',
        caption: 'Caption fallback memory',
        locationName: 'Caption Place',
      }),
    ]);
    mockGetInfoAsync.mockImplementation(async (uri: string) => ({
      exists: uri !== 'file:///mock-documents/photos/missing.jpg',
      isDirectory: false,
      uri,
      size: 1024,
      modificationTime: 0,
    }));

    await updateWidgetData({ referenceDate: new Date('2026-03-10T00:00:00.000Z') });

    const entries = getLastTimelineEntries();

    expect(entries[0]?.props.props).toEqual(
      expect.objectContaining({
        noteType: 'text',
        text: 'Caption fallback memory',
        locationName: 'Caption Place',
        isIdleState: false,
        primaryActionUrl: 'noto:///widget/note/caption-only-photo',
      })
    );
  });

  it('uses the synced local photo path when the primary photo path is missing', async () => {
    mockGetAllNotes.mockResolvedValue([
      buildNote({
        id: 'synced-photo',
        type: 'photo',
        content: '',
        photoLocalUri: null,
        photoSyncedLocalUri: 'file:///mock-documents/photos/synced.jpg',
        locationName: 'Synced Place',
      }),
    ]);
    mockGetInfoAsync.mockImplementation(async (uri: string) => ({
      exists: uri === 'file:///mock-documents/photos/synced.jpg',
      isDirectory: false,
      uri,
      size: 1024,
      modificationTime: 0,
    }));

    await updateWidgetData({ referenceDate: new Date('2026-03-10T00:00:00.000Z') });

    const entries = getLastTimelineEntries();

    expect(entries[0]?.props.props).toEqual(
      expect.objectContaining({
        noteType: 'photo',
        locationName: 'Synced Place',
        isIdleState: false,
      })
    );
    expect(
      String(entries[0]?.props.props.backgroundImageUrl ?? entries[0]?.props.props.backgroundImageBase64 ?? '')
    ).toBeTruthy();
  });

  it('reuses the last delivered widget payload instead of overwriting it with idle content', async () => {
    mockGetAllNotes.mockResolvedValueOnce([
      buildNote({
        id: 'stable-note',
        content: 'Keep showing this',
        locationName: 'Stable Place',
      }),
    ]);

    await updateWidgetData({ referenceDate: new Date('2026-03-10T00:00:00.000Z') });

    mockGetAllNotes.mockResolvedValueOnce([
      buildNote({
        id: 'broken-photo',
        type: 'photo',
        content: 'file:///mock-documents/photos/missing.jpg',
        locationName: 'Broken Place',
      }),
    ]);
    mockGetInfoAsync.mockImplementation(async (uri: string) => ({
      exists: uri !== 'file:///mock-documents/photos/missing.jpg',
      isDirectory: false,
      uri,
      size: 1024,
      modificationTime: 0,
    }));

    await updateWidgetData({ referenceDate: new Date('2026-03-10T06:00:00.000Z') });

    const entries = getLastTimelineEntries();

    expect(entries[0]?.props.props).toEqual(
      expect.objectContaining({
        noteType: 'text',
        text: 'Keep showing this',
        locationName: 'Stable Place',
        isIdleState: false,
      })
    );
  });

  it('does not push the widget again when the resolved payload is unchanged', async () => {
    await updateWidgetData({ referenceDate: new Date('2026-03-10T00:00:00.000Z') });
    await updateWidgetData({ referenceDate: new Date('2026-03-10T06:00:00.000Z') });

    expect(mockUpdateTimeline).toHaveBeenCalledTimes(1);
  });

  it('includes doodle metadata for selected text notes', async () => {
    mockGetAllNotes.mockResolvedValue([
      buildNote({
        id: 'favorite-text',
        content: 'Morning coffee again',
        moodEmoji: '☕️',
        hasDoodle: true,
        doodleStrokesJson: JSON.stringify([
          {
            color: '#1C1C1E',
            points: [0.1, 0.2, 0.4, 0.6],
          },
        ]),
      }),
    ]);

    await updateWidgetData({ referenceDate: new Date('2026-03-10T00:00:00.000Z') });

    const entries = getLastTimelineEntries();

    expect(entries[0]?.props.props).toEqual(
      expect.objectContaining({
        noteType: 'text',
        text: 'Morning coffee again',
        hasDoodle: true,
        primaryActionUrl: 'noto:///widget/note/favorite-text',
        doodleStrokesJson: JSON.stringify([
          {
            color: '#1C1C1E',
            points: [0.1, 0.2, 0.4, 0.6],
          },
        ]),
      })
    );
    expect(entries[0]?.props.props.backgroundGradientStartColor).toEqual(expect.any(String));
    expect(entries[0]?.props.props.backgroundGradientEndColor).toEqual(expect.any(String));
  });

  it('includes sticker metadata for selected notes and prepares iOS-readable sticker files', async () => {
    mockGetInfoAsync.mockImplementation(async (uri: string) => ({
      exists: uri !== 'file:///mock-documents/stickers/asset-1.png',
      isDirectory: false,
      uri,
      size: 1024,
      modificationTime: 0,
    }));
    mockReadDirectoryAsync.mockResolvedValue([
      'sticker-sticker-text-asset-1-123.png',
    ]);

    mockGetAllNotes.mockResolvedValue([
      buildNote({
        id: 'sticker-text',
        content: 'Sticker memory',
        hasStickers: true,
        stickerPlacementsJson: JSON.stringify([
          {
            id: 'placement-1',
            assetId: 'asset-1',
            x: 0.4,
            y: 0.6,
            scale: 1.1,
            rotation: 8,
            zIndex: 1,
            opacity: 0.95,
            renderMode: 'stamp',
            outlineEnabled: false,
            asset: {
              id: 'asset-1',
              ownerUid: '__local__',
              localUri: 'file:///mock-documents/stickers/asset-1.png',
              remotePath: null,
              mimeType: 'image/png',
              width: 320,
              height: 240,
              createdAt: '2026-03-10T00:00:00.000Z',
              updatedAt: null,
              source: 'import',
            },
          },
        ]),
      }),
    ]);

    await updateWidgetData({ referenceDate: new Date('2026-03-10T00:00:00.000Z') });

    const entries = getLastTimelineEntries();
    const stickerPayload = JSON.parse(String(entries[0]?.props.props.stickerPlacementsJson ?? '[]'));

    expect(entries[0]?.props.props).toEqual(
      expect.objectContaining({
        noteType: 'text',
        hasStickers: true,
      })
    );
    expect(stickerPayload).toHaveLength(1);
    expect(stickerPayload[0]?.opacity).toBe(1);
    expect(stickerPayload[0]?.renderMode).toBe('stamp');
    expect(stickerPayload[0]?.outlineEnabled).toBe(false);
    expect(String(stickerPayload[0]?.asset?.localUri ?? '')).toContain('file:///mock-group/widget-stickers/');
  });

  it('creates usable widget image payloads for photo notes', async () => {
    mockGetAllNotes.mockResolvedValue([
      buildNote({
        id: 'latest-photo',
        type: 'photo',
        content: 'file:///mock-documents/photos/latest.jpg',
        isLivePhoto: true,
        pairedVideoLocalUri: 'file:///mock-documents/photos/latest.motion.mov',
        locationName: 'Photo Place',
      }),
    ]);

    await updateWidgetData({ referenceDate: new Date('2026-03-10T00:00:00.000Z') });

    const entries = getLastTimelineEntries();
    const firstImageUrl = String(entries[0]?.props.props.backgroundImageUrl ?? '');
    const firstImageBase64 = String(entries[0]?.props.props.backgroundImageBase64 ?? '');

    if (firstImageUrl) {
      expect(firstImageUrl).toContain('latest-photo');
      expect(entries[0]?.props.props).toEqual(
        expect.objectContaining({
          isLivePhoto: true,
          livePhotoBadgeText: 'Live',
        })
      );
      return;
    }

    expect(firstImageBase64).toBe('base64-image-data');
    expect(entries[0]?.props.props).toEqual(
      expect.objectContaining({
        isLivePhoto: true,
        livePhotoBadgeText: 'Live',
      })
    );
  });

  it('formats localized widget strings inside the payload', async () => {
    i18n.language = 'vi';

    await updateWidgetData({ referenceDate: new Date('2026-03-10T00:00:00.000Z') });

    const entries = getLastTimelineEntries();

    expect(entries[0]?.props.props).toEqual(
      expect.objectContaining({
        noteCount: 2,
        savedCountText: '2 ghi chú',
        accessorySaveMemoryText: 'Luu mot ky niem',
        accessorySavedLabelText: 'Da luu',
        accessoryOpenAppText: 'Mo Noto',
      })
    );
  });
});

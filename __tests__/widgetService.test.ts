import AsyncStorage from '@react-native-async-storage/async-storage';

const mockUpdateTimeline = jest.fn();
const mockGetAllNotes = jest.fn();
const mockGetForegroundPermissionsAsync = jest.fn();
const mockGetLastKnownPositionAsync = jest.fn();
const mockGetCurrentPositionAsync = jest.fn();
const mockMakeDirectoryAsync = jest.fn();
const mockDeleteAsync = jest.fn();
const mockCopyAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockGetInfoAsync = jest.fn();

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
    if (key === 'widget.modeFavorite') {
      return currentLanguage === 'vi'
        ? 'Mot noi ban tung yeu thich.'
        : 'A favorite to revisit.';
    }
    if (key === 'widget.modePhoto') {
      return currentLanguage === 'vi'
        ? 'Mot ky uc hinh anh de nho lai.'
        : 'A photo memory to revisit.';
    }
    if (key === 'widget.modeResurfaced') {
      return currentLanguage === 'vi'
        ? 'Mot dieu dang de nho lai lan nua.'
        : 'Something worth remembering again.';
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

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock-documents/',
  makeDirectoryAsync: (...args: unknown[]) => mockMakeDirectoryAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
  copyAsync: (...args: unknown[]) => mockCopyAsync(...args),
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  EncodingType: {
    Base64: 'base64',
  },
}));

import type { Note } from '../services/database';
import { selectWidgetNote, updateWidgetData } from '../services/widgetService';
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

function getLastTimelineEntries() {
  const call = mockUpdateTimeline.mock.calls.at(-1);
  return (call?.[0] ?? []) as Array<{ date: Date; props: { props: Record<string, unknown> } }>;
}

beforeEach(async () => {
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
  mockGetLastKnownPositionAsync.mockResolvedValue(null);
  mockGetCurrentPositionAsync.mockResolvedValue(null);
  mockMakeDirectoryAsync.mockResolvedValue(undefined);
  mockDeleteAsync.mockResolvedValue(undefined);
  mockCopyAsync.mockResolvedValue(undefined);
  mockReadAsStringAsync.mockResolvedValue('base64-image-data');
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
});

afterEach(() => {
  i18n.language = 'en';
  warnSpy.mockRestore();
});

describe('widgetService', () => {
  it('uses the nearest-memory mode when a note is inside its radius', () => {
    const result = selectWidgetNote({
      notes: [
        buildNote({
          id: 'near-note',
          content: 'She likes the iced tea here',
          locationName: 'Cafe A',
          latitude: 10.0,
          longitude: 106.0,
        }),
        buildNote({
          id: 'favorite-photo',
          type: 'photo',
          content: 'file:///mock-documents/photos/latest.jpg',
          isFavorite: true,
          locationName: 'Photo Place',
          latitude: 20.0,
          longitude: 116.0,
        }),
      ],
      currentLocation: { latitude: 10.0, longitude: 106.0 },
      referenceDate: new Date('2026-03-10T00:00:00'),
    });

    expect(result.selectedNote?.id).toBe('near-note');
    expect(result.selectionMode).toBe('nearest_memory');
  });

  it('prefers favorite photos over non-favorite text when nothing is nearby', () => {
    const result = selectWidgetNote({
      notes: [
        buildNote({
          id: 'photo-favorite',
          type: 'photo',
          content: 'file:///mock-documents/photos/latest.jpg',
          isFavorite: true,
          locationName: 'Photo Place',
          latitude: 20.0,
          longitude: 116.0,
        }),
        buildNote({
          id: 'plain-text',
          content: 'Just a regular note',
          locationName: 'Far away',
          latitude: 30.0,
          longitude: 126.0,
        }),
      ],
      currentLocation: { latitude: 10.0, longitude: 106.0 },
      referenceDate: new Date('2026-03-10T06:00:00'),
    });

    expect(result.selectedNote?.id).toBe('photo-favorite');
    expect(result.selectionMode).toBe('favorite_photo');
  });

  it('prefers favorite text over plain recent text when no photos are available', () => {
    const result = selectWidgetNote({
      notes: [
        buildNote({
          id: 'favorite-text',
          content: 'Keep the corner table',
          isFavorite: true,
          createdAt: '2026-03-08T10:00:00.000Z',
        }),
        buildNote({
          id: 'recent-text',
          content: 'Newest plain memory',
          createdAt: '2026-03-10T10:00:00.000Z',
        }),
      ],
      currentLocation: { latitude: 0.0, longitude: 0.0 },
      referenceDate: new Date('2026-03-10T12:00:00'),
    });

    expect(result.selectedNote?.id).toBe('favorite-text');
    expect(result.selectionMode).toBe('favorite_memory');
  });

  it('uses resurfaced memories before latest when older text is eligible', () => {
    const result = selectWidgetNote({
      notes: [
        buildNote({
          id: 'old-memory',
          content: 'An old but meaningful memory',
          createdAt: '2026-02-10T10:00:00.000Z',
        }),
        buildNote({
          id: 'new-memory',
          content: 'A newer memory',
          createdAt: '2026-03-09T10:00:00.000Z',
        }),
      ],
      currentLocation: { latitude: 0.0, longitude: 0.0 },
      referenceDate: new Date('2026-03-10T18:00:00'),
    });

    expect(result.selectedNote?.id).toBe('old-memory');
    expect(result.selectionMode).toBe('resurfaced_memory');
  });

  it('falls back to latest memory when no earlier bucket is available', () => {
    const result = selectWidgetNote({
      notes: [
        buildNote({
          id: 'newer-note',
          locationName: 'Far away',
          latitude: 11.0,
          longitude: 107.0,
          createdAt: '2026-03-11T10:00:00.000Z',
        }),
        buildNote({
          id: 'older-note',
          locationName: 'Older place',
          latitude: 12.0,
          longitude: 108.0,
          createdAt: '2026-03-09T10:00:00.000Z',
        }),
      ],
      currentLocation: { latitude: 0.0, longitude: 0.0 },
      referenceDate: new Date('2026-03-10T06:00:00'),
    });

    expect(result.selectedNote?.id).toBe('newer-note');
    expect(result.selectionMode).toBe('latest_memory');
  });

  it('creates four six-hour timeline entries aligned to slot boundaries', async () => {
    const referenceDate = new Date('2026-03-10T07:30:00.000Z');
    await updateWidgetData({ referenceDate });

    const entries = getLastTimelineEntries();

    expect(entries).toHaveLength(4);
    expect(entries[0]?.date.getTime()).toBeLessThanOrEqual(referenceDate.getTime());
    expect(referenceDate.getTime() - (entries[0]?.date.getTime() ?? 0)).toBeLessThan(6 * 60 * 60 * 1000);
    expect(entries.every((entry) => entry.date.getMinutes() === 0)).toBe(true);
    expect(entries.every((entry) => entry.date.getSeconds() === 0)).toBe(true);
    expect(entries[1]?.date.getTime()).toBe((entries[0]?.date.getTime() ?? 0) + 6 * 60 * 60 * 1000);
    expect(entries[2]?.date.getTime()).toBe((entries[1]?.date.getTime() ?? 0) + 6 * 60 * 60 * 1000);
    expect(entries[3]?.date.getTime()).toBe((entries[2]?.date.getTime() ?? 0) + 6 * 60 * 60 * 1000);
  });

  it('avoids repeating the same note in consecutive slots when alternatives exist', async () => {
    mockGetAllNotes.mockResolvedValue([
      buildNote({
        id: 'favorite-photo-a',
        type: 'photo',
        content: 'file:///mock-documents/photos/latest.jpg',
        isFavorite: true,
        locationName: 'Photo A',
        createdAt: '2026-03-10T10:00:00.000Z',
      }),
      buildNote({
        id: 'favorite-photo-b',
        type: 'photo',
        content: 'file:///mock-documents/photos/second.jpg',
        isFavorite: true,
        locationName: 'Photo B',
        createdAt: '2026-03-09T10:00:00.000Z',
      }),
    ]);
    mockGetInfoAsync.mockImplementation(async (uri: string) => ({
      exists: uri === 'file:///mock-documents/photos/latest.jpg' || uri === 'file:///mock-documents/photos/second.jpg',
      isDirectory: false,
      uri,
      size: 1024,
      modificationTime: 0,
    }));

    await updateWidgetData({ referenceDate: new Date('2026-03-10T00:00:00.000Z') });

    const entries = getLastTimelineEntries();
    const locationNames = entries.map((entry) => entry.props.props.locationName);

    expect(locationNames[0]).toBe('Photo A');
    expect(locationNames[1]).toBe('Photo B');
    expect(locationNames[2]).toBe('Photo A');
    expect(locationNames[3]).toBe('Photo B');
  });

  it('skips unreadable photo notes and uses the next eligible local memory', async () => {
    mockGetAllNotes.mockResolvedValue([
      buildNote({
        id: 'broken-photo',
        type: 'photo',
        content: 'file:///mock-documents/photos/missing.jpg',
        locationName: 'Broken Photo',
      }),
      buildNote({
        id: 'text-fallback',
        content: 'Readable text fallback',
        locationName: 'Fallback Place',
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

    expect(entries[0]?.props.props.noteType).toBe('text');
    expect(entries[0]?.props.props.locationName).toBe('Fallback Place');
  });

  it('includes doodle metadata for selected text notes', async () => {
    mockGetAllNotes.mockResolvedValue([
      buildNote({
        id: 'favorite-text',
        content: 'Morning coffee again',
        moodEmoji: '☕️',
        isFavorite: true,
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
        text: '☕️ Morning coffee again',
        hasDoodle: true,
        doodleStrokesJson: JSON.stringify([
          {
            color: '#1C1C1E',
            points: [0.1, 0.2, 0.4, 0.6],
          },
        ]),
      })
    );
  });

  it('creates unique widget image files for photo timeline entries', async () => {
    mockGetAllNotes.mockResolvedValue([
      buildNote({
        id: 'favorite-photo',
        type: 'photo',
        content: 'file:///mock-documents/photos/latest.jpg',
        isFavorite: true,
        locationName: 'Photo Place',
      }),
    ]);

    await updateWidgetData({ referenceDate: new Date('2026-03-10T00:00:00.000Z') });

    const entries = getLastTimelineEntries();
    const firstImageUrl = String(entries[0]?.props.props.backgroundImageUrl ?? '');
    const secondImageUrl = String(entries[1]?.props.props.backgroundImageUrl ?? '');

    expect(mockCopyAsync).toHaveBeenCalled();
    expect(firstImageUrl).toContain('note-favorite-photo');
    expect(secondImageUrl).toContain('note-favorite-photo');
    expect(firstImageUrl).not.toBe(secondImageUrl);
  });

  it('formats localized widget strings inside the timeline entry payload', async () => {
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

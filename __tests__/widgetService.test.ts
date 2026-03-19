const mockUpdateSnapshot = jest.fn();
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
    if (key === 'widget.modeArea') {
      return currentLanguage === 'vi'
        ? 'Mot dieu gi do quanh day.'
        : 'Something from around here.';
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
    updateSnapshot: (...args: unknown[]) => mockUpdateSnapshot(...args),
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

beforeEach(() => {
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.clearAllMocks();
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
  it('uses the nearest-memory mode when the slot rotates to it', () => {
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
          id: 'other-near',
          content: 'Another nearby place',
          locationName: 'Cafe B',
          latitude: 10.001,
          longitude: 106.001,
        }),
      ],
      currentLocation: { latitude: 10.0, longitude: 106.0 },
      referenceDate: new Date('2026-03-10T00:00:00'),
    });

    expect(result.selectedNote?.id).toBe('near-note');
    expect(result.nearbyPlacesCount).toBe(0);
    expect(result.isIdleState).toBe(false);
    expect(result.selectionMode).toBe('nearest_memory');
  });

  it('uses the random-favorite mode when the slot rotates to it', () => {
    const result = selectWidgetNote({
      notes: [
        buildNote({
          id: 'favorite-one',
          content: 'First favorite',
          locationName: 'Pho House',
          latitude: 20.0,
          longitude: 116.0,
          isFavorite: true,
        }),
        buildNote({
          id: 'favorite-two',
          content: 'Second favorite',
          locationName: 'Pho House',
          latitude: 21.0,
          longitude: 117.0,
          isFavorite: true,
        }),
      ],
      currentLocation: { latitude: 10.0, longitude: 106.0 },
      referenceDate: new Date('2026-03-10T06:00:00'),
    });

    expect(['favorite-one', 'favorite-two']).toContain(result.selectedNote?.id);
    expect(result.selectionMode).toBe('random_favorite');
  });

  it('uses the around-this-area mode when the slot rotates to it', () => {
    const result = selectWidgetNote({
      notes: [
        buildNote({
          id: 'farther-area',
          content: 'Quiet corner table',
          locationName: 'Bistro',
          latitude: 10.01,
          longitude: 106.01,
        }),
        buildNote({
          id: 'closer-area',
          content: 'Window seat',
          locationName: 'Bistro',
          latitude: 10.001,
          longitude: 106.001,
          radius: 50,
        }),
      ],
      currentLocation: { latitude: 10.0, longitude: 106.0 },
      referenceDate: new Date('2026-03-10T12:00:00'),
    });

    expect(result.selectedNote?.id).toBe('closer-area');
    expect(result.selectionMode).toBe('around_this_area');
  });

  it('falls back to the latest note when no rotated mode has a candidate', () => {
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
    expect(result.nearbyPlacesCount).toBe(0);
    expect(result.isIdleState).toBe(false);
    expect(result.selectionMode).toBe('latest_memory');
  });

  it('keeps a nearby photo reminder active when photo file preparation fails', async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetLastKnownPositionAsync.mockResolvedValue({
      coords: {
        latitude: 10.8,
        longitude: 106.7,
      },
    });
    mockGetAllNotes.mockResolvedValue([
      buildNote({
        id: 'photo-nearby',
        type: 'photo',
        content: 'file:///photos/latest.jpg',
        locationName: 'Photo Place',
        latitude: 10.8,
        longitude: 106.7,
      }),
    ]);
    mockCopyAsync.mockRejectedValue(new Error('copy failed'));
    mockReadAsStringAsync.mockRejectedValue(new Error('read failed'));

    await updateWidgetData({ referenceDate: new Date('2026-03-10T00:00:00') });

    expect(mockUpdateSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          text: '',
          locationName: 'Photo Place',
          isIdleState: false,
          noteCount: 1,
          memoryReminderText: 'Closest memory right now.',
          accessoryNearLabelText: 'Near',
          nearbyPlacesLabelText: '1 place nearby',
        }),
      })
    );
  });

  it('resolves stale app-container photo paths before copying into the widget container', async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetLastKnownPositionAsync.mockResolvedValue({
      coords: {
        latitude: 10.8,
        longitude: 106.7,
      },
    });
    mockGetAllNotes.mockResolvedValue([
      buildNote({
        id: 'photo-nearby',
        type: 'photo',
        content: 'file:///old-container/Documents/photos/latest.jpg',
        locationName: 'Photo Place',
        latitude: 10.8,
        longitude: 106.7,
      }),
    ]);
    mockGetInfoAsync.mockImplementation(async (uri: string) => ({
      exists: uri === 'file:///mock-documents/photos/latest.jpg',
      isDirectory: false,
      uri,
      size: uri === 'file:///mock-documents/photos/latest.jpg' ? 1024 : 0,
      modificationTime: 0,
    }));

    await updateWidgetData();

    expect(mockCopyAsync).toHaveBeenCalledWith({
      from: 'file:///mock-documents/photos/latest.jpg',
      to: 'file:///mock-group/widget-images/latest-photo.jpg',
    });
  });

  it('falls back to the latest note when no rotated mode can select a nearby memory', async () => {
    await updateWidgetData();

    expect(mockUpdateSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          text: 'Latest note',
          locationName: 'Latest place',
          isIdleState: false,
          noteCount: 2,
        }),
      })
    );
  });

  it('formats a compact count label for the widget badge', async () => {
    await updateWidgetData();

    expect(mockUpdateSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          noteCount: 2,
          savedCountText: '2 notes',
        }),
      })
    );
  });

  it('formats a singular English count label for the widget badge', async () => {
    mockGetAllNotes.mockResolvedValue([
      buildNote({
        id: 'only-note',
        content: 'Only note',
        locationName: 'Only place',
        latitude: 10.8,
        longitude: 106.7,
      }),
    ]);

    await updateWidgetData();

    expect(mockUpdateSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          noteCount: 1,
          savedCountText: '1 note',
        }),
      })
    );
  });

  it('formats a Vietnamese count label for the widget badge', async () => {
    i18n.language = 'vi';

    await updateWidgetData();

    expect(mockUpdateSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          noteCount: 2,
          savedCountText: '2 ghi chú',
          accessorySaveMemoryText: 'Luu mot ky niem',
          accessorySavedLabelText: 'Da luu',
          accessoryOpenAppText: 'Mo Noto',
        }),
      })
    );
  });
});

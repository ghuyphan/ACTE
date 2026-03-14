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
  it('selects the nearest nearby place and prefers the best text reminder within that place', () => {
    const result = selectWidgetNote({
      notes: [
        buildNote({
          id: 'near-photo',
          type: 'photo',
          content: 'file:///photos/near.jpg',
          locationName: 'Cafe A',
          latitude: 10.0,
          longitude: 106.0,
          createdAt: '2026-03-10T11:00:00.000Z',
        }),
        buildNote({
          id: 'near-preference',
          content: 'She likes the iced tea here',
          locationName: 'Cafe A',
          latitude: 10.0,
          longitude: 106.0,
          createdAt: '2026-03-10T09:00:00.000Z',
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
      nearbyRadiusMeters: 500,
    });

    expect(result.selectedNote?.id).toBe('near-preference');
    expect(result.nearbyPlacesCount).toBe(1);
    expect(result.isIdleState).toBe(false);
  });

  it('prefers keyword-matching reminder text over generic text at the same place', () => {
    const result = selectWidgetNote({
      notes: [
        buildNote({
          id: 'generic-text',
          content: 'Nice lighting and calm music',
          locationName: 'Pho House',
          latitude: 10.0,
          longitude: 106.0,
          createdAt: '2026-03-10T11:00:00.000Z',
        }),
        buildNote({
          id: 'preference-text',
          content: 'She prefers no onions here',
          locationName: 'Pho House',
          latitude: 10.0,
          longitude: 106.0,
          createdAt: '2026-03-10T09:00:00.000Z',
        }),
      ],
      currentLocation: { latitude: 10.0, longitude: 106.0 },
      nearbyRadiusMeters: 500,
    });

    expect(result.selectedNote?.id).toBe('preference-text');
  });

  it('uses favorite only as a tie breaker after recency', () => {
    const result = selectWidgetNote({
      notes: [
        buildNote({
          id: 'older-favorite',
          content: 'Quiet corner table',
          locationName: 'Bistro',
          latitude: 10.0,
          longitude: 106.0,
          isFavorite: true,
          createdAt: '2026-03-10T09:00:00.000Z',
        }),
        buildNote({
          id: 'newer-non-favorite',
          content: 'Quiet corner table',
          locationName: 'Bistro',
          latitude: 10.0,
          longitude: 106.0,
          isFavorite: false,
          createdAt: '2026-03-10T11:00:00.000Z',
        }),
      ],
      currentLocation: { latitude: 10.0, longitude: 106.0 },
      nearbyRadiusMeters: 500,
    });

    expect(result.selectedNote?.id).toBe('newer-non-favorite');
  });

  it('stays idle when there are no nearby matches', () => {
    const result = selectWidgetNote({
      notes: [
        buildNote({
          id: 'far-note',
          locationName: 'Far away',
          latitude: 11.0,
          longitude: 107.0,
        }),
      ],
      currentLocation: { latitude: 0.0, longitude: 0.0 },
      nearbyRadiusMeters: 500,
    });

    expect(result.selectedNote).toBeNull();
    expect(result.nearbyPlacesCount).toBe(0);
    expect(result.isIdleState).toBe(true);
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

    await updateWidgetData();

    expect(mockUpdateSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          text: '',
          locationName: 'Photo Place',
          isIdleState: false,
          noteCount: 1,
          memoryReminderText: 'A quiet reminder from here.',
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

  it('renders an idle widget when no nearby place is available', async () => {
    await updateWidgetData();

    expect(mockUpdateSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          text: '',
          locationName: '',
          isIdleState: true,
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
        }),
      })
    );
  });
});

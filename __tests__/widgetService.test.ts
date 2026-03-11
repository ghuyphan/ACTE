const mockUpdateSnapshot = jest.fn();
const mockGetAllNotes = jest.fn();
const mockGetForegroundPermissionsAsync = jest.fn();
const mockGetLastKnownPositionAsync = jest.fn();
const mockGetCurrentPositionAsync = jest.fn();
const mockMakeDirectoryAsync = jest.fn();
const mockDeleteAsync = jest.fn();
const mockCopyAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();

jest.mock('../constants/i18n', () => ({
  __esModule: true,
  default: {
    language: 'en',
    t: (key: string, options?: { count?: number }) => {
      if (key === 'widget.savedCount') {
        return `${options?.count ?? 0} saved`;
      }
      if (key === 'capture.unknownPlace') {
        return 'Unknown Place';
      }
      return key;
    },
  },
}));

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
  makeDirectoryAsync: (...args: unknown[]) => mockMakeDirectoryAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
  copyAsync: (...args: unknown[]) => mockCopyAsync(...args),
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
  EncodingType: {
    Base64: 'base64',
  },
}));

import { selectWidgetNote, updateWidgetData } from '../services/widgetService';

let warnSpy: jest.SpyInstance;

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
  mockGetAllNotes.mockResolvedValue([
    {
      id: 'newest',
      type: 'text',
      content: 'Latest note',
      locationName: 'Latest place',
      latitude: 10.8,
      longitude: 106.7,
      radius: 150,
      isFavorite: false,
      createdAt: '2026-03-10T10:00:00.000Z',
      updatedAt: null,
    },
    {
      id: 'older',
      type: 'text',
      content: 'Older note',
      locationName: 'Old place',
      latitude: 10.7,
      longitude: 106.6,
      radius: 150,
      isFavorite: false,
      createdAt: '2026-03-09T10:00:00.000Z',
      updatedAt: null,
    },
  ]);
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe('widgetService', () => {
  it('selects nearest note when current location has nearby notes', () => {
    const result = selectWidgetNote({
      notes: [
        {
          id: 'near-1',
          type: 'text',
          content: 'Nearest',
          locationName: 'A',
          latitude: 10.0,
          longitude: 106.0,
          radius: 150,
          isFavorite: false,
          createdAt: '2026-03-10T10:00:00.000Z',
          updatedAt: null,
        },
        {
          id: 'near-2',
          type: 'text',
          content: 'Also nearby',
          locationName: 'B',
          latitude: 10.001,
          longitude: 106.001,
          radius: 150,
          isFavorite: false,
          createdAt: '2026-03-10T09:00:00.000Z',
          updatedAt: null,
        },
        {
          id: 'far',
          type: 'text',
          content: 'Far away',
          locationName: 'Far',
          latitude: 11.0,
          longitude: 107.0,
          radius: 150,
          isFavorite: false,
          createdAt: '2026-03-10T11:00:00.000Z',
          updatedAt: null,
        },
      ],
      currentLocation: { latitude: 10.0, longitude: 106.0 },
      nearbyRadiusMeters: 500,
    });

    expect(result.selectedNote?.id).toBe('near-1');
    expect(result.nearbyPlacesCount).toBe(1);
  });

  it('falls back to latest note when there are no nearby matches', () => {
    const result = selectWidgetNote({
      notes: [
        {
          id: 'older',
          type: 'text',
          content: 'Older',
          locationName: 'Old',
          latitude: 10.0,
          longitude: 106.0,
          radius: 150,
          isFavorite: false,
          createdAt: '2026-03-09T10:00:00.000Z',
          updatedAt: null,
        },
        {
          id: 'latest',
          type: 'text',
          content: 'Latest',
          locationName: 'New',
          latitude: 10.2,
          longitude: 106.2,
          radius: 150,
          isFavorite: false,
          createdAt: '2026-03-10T10:00:00.000Z',
          updatedAt: null,
        },
      ],
      currentLocation: { latitude: 0.0, longitude: 0.0 },
      nearbyRadiusMeters: 500,
    });

    expect(result.selectedNote?.id).toBe('latest');
    expect(result.nearbyPlacesCount).toBe(0);
  });

  it('falls back to latest valid text note when photo file cannot be prepared', async () => {
    mockGetAllNotes.mockResolvedValue([
      {
        id: 'photo-latest',
        type: 'photo',
        content: 'file:///photos/latest.jpg',
        locationName: 'Photo Place',
        latitude: 10.8,
        longitude: 106.7,
        radius: 150,
        isFavorite: false,
        createdAt: '2026-03-10T12:00:00.000Z',
        updatedAt: null,
      },
      {
        id: 'text-older',
        type: 'text',
        content: 'Older text',
        locationName: 'Old Text Place',
        latitude: 10.7,
        longitude: 106.6,
        radius: 150,
        isFavorite: false,
        createdAt: '2026-03-09T12:00:00.000Z',
        updatedAt: null,
      },
      {
        id: 'text-latest',
        type: 'text',
        content: 'Latest text fallback',
        locationName: 'Latest Text Place',
        latitude: 10.9,
        longitude: 106.8,
        radius: 150,
        isFavorite: false,
        createdAt: '2026-03-10T11:00:00.000Z',
        updatedAt: null,
      },
    ]);
    mockCopyAsync.mockRejectedValue(new Error('copy failed'));
    mockReadAsStringAsync.mockRejectedValue(new Error('read failed'));

    await updateWidgetData();

    expect(mockUpdateSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          text: 'Latest text fallback',
          locationName: 'Latest Text Place',
          isIdleState: false,
          noteCount: 3,
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
});

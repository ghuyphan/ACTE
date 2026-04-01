const mockStorage = new Map<string, string>();

const mockGetForegroundPermissionsAsync = jest.fn();
const mockGetBackgroundPermissionsAsync = jest.fn();
const mockHasStartedGeofencingAsync = jest.fn();
const mockStartGeofencingAsync = jest.fn();
const mockStopGeofencingAsync = jest.fn();
const mockNotificationsGetPermissionsAsync = jest.fn();
const mockGetAllNotes = jest.fn();
const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

jest.mock('../constants/i18n', () => ({
  __esModule: true,
  default: {
    language: 'en',
    t: (key: string) => key,
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => mockStorage.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    mockStorage.set(key, value);
  },
  removeItem: async (key: string) => {
    mockStorage.delete(key);
  },
}));

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: (...args: unknown[]) => mockGetForegroundPermissionsAsync(...args),
  getBackgroundPermissionsAsync: (...args: unknown[]) => mockGetBackgroundPermissionsAsync(...args),
  hasStartedGeofencingAsync: (...args: unknown[]) => mockHasStartedGeofencingAsync(...args),
  startGeofencingAsync: (...args: unknown[]) => mockStartGeofencingAsync(...args),
  stopGeofencingAsync: (...args: unknown[]) => mockStopGeofencingAsync(...args),
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...args: unknown[]) => mockNotificationsGetPermissionsAsync(...args),
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
}));

jest.mock('../services/database', () => ({
  getAllNotes: (...args: unknown[]) => mockGetAllNotes(...args),
}));

import type { Note } from '../services/database';
import {
  clearGeofenceRegions,
  getMaxGeofenceRegionCount,
  prioritizeNotesForGeofencing,
  summarizeGeofenceSelection,
  syncGeofenceRegions,
} from '../services/geofenceService';

function buildNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    type: 'text',
    content: 'Remember the usual order',
    locationName: 'District 1',
    latitude: 10.7626,
    longitude: 106.6601,
    radius: 150,
    isFavorite: false,
    createdAt: '2026-03-10T10:00:00.000Z',
    updatedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockStorage.clear();
  jest.clearAllMocks();

  mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockGetBackgroundPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true });
  mockNotificationsGetPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true });
  mockHasStartedGeofencingAsync.mockResolvedValue(false);
  mockStartGeofencingAsync.mockResolvedValue(undefined);
  mockStopGeofencingAsync.mockResolvedValue(undefined);
  mockGetAllNotes.mockResolvedValue([
    buildNote({ id: 'note-1' }),
    buildNote({
      id: 'note-2',
      locationName: 'District 2',
      latitude: 10.765,
      longitude: 106.665,
      createdAt: '2026-03-10T09:00:00.000Z',
    }),
  ]);
});

afterAll(() => {
  consoleWarnSpy.mockRestore();
});

describe('geofenceService', () => {
  it('returns false when reminders are not enabled', async () => {
    mockGetBackgroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: true });

    const result = await syncGeofenceRegions();
    expect(result).toBe(false);
    expect(mockStartGeofencingAsync).not.toHaveBeenCalled();
  });

  it('starts geofencing and stores signature when enabled', async () => {
    const result = await syncGeofenceRegions();
    expect(result).toBe(true);
    expect(mockStartGeofencingAsync).toHaveBeenCalledWith(
      'BACKGROUND_GEOFENCE_TASK',
      expect.arrayContaining([
        expect.objectContaining({ identifier: 'note-1' }),
        expect.objectContaining({ identifier: 'note-2' }),
      ])
    );
    expect(mockStorage.get('geofence.signature')).toBeTruthy();
  });

  it('does not restart geofencing when signature is unchanged', async () => {
    await syncGeofenceRegions();
    mockStartGeofencingAsync.mockClear();
    mockHasStartedGeofencingAsync.mockResolvedValue(true);

    const result = await syncGeofenceRegions();
    expect(result).toBe(true);
    expect(mockStartGeofencingAsync).not.toHaveBeenCalled();
  });

  it('limits the number of registered regions to the platform maximum', async () => {
    const maxRegions = getMaxGeofenceRegionCount();
    mockGetAllNotes.mockResolvedValue(
      Array.from({ length: maxRegions + 5 }, (_, index) =>
        buildNote({
          id: `note-${index + 1}`,
          locationName: `Place ${index + 1}`,
          latitude: 10.7 + index * 0.001,
          longitude: 106.6 + index * 0.001,
          createdAt: `2026-03-${String(10 + Math.min(index, 18)).padStart(2, '0')}T10:00:00.000Z`,
        })
      )
    );

    const result = await syncGeofenceRegions();

    expect(result).toBe(true);
    expect(mockStartGeofencingAsync.mock.calls[0]?.[1]).toHaveLength(maxRegions);
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('does not warn when many notes collapse into a small number of places', async () => {
    const groupedNotes = Array.from({ length: 4 }, (_, index) =>
      buildNote({
        id: `district-1-${index + 1}`,
        locationName: 'District 1',
        latitude: 10.7626,
        longitude: 106.6601,
        createdAt: `2026-03-1${index}T10:00:00.000Z`,
      })
    );
    mockGetAllNotes.mockResolvedValue(groupedNotes);

    const summary = summarizeGeofenceSelection(groupedNotes, 1);
    await syncGeofenceRegions();

    expect(summary.totalNotes).toBe(4);
    expect(summary.totalPlaces).toBe(1);
    expect(summary.overflowPlaces).toBe(0);
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('registers one region per place using the best representative note', async () => {
    mockGetAllNotes.mockResolvedValue([
      buildNote({
        id: 'photo-note',
        type: 'photo',
        content: 'file:///photo.jpg',
        locationName: 'District 1',
        createdAt: '2026-03-10T11:00:00.000Z',
      }),
      buildNote({
        id: 'preference-note',
        type: 'text',
        content: 'She likes the iced tea here',
        locationName: 'District 1',
        createdAt: '2026-03-10T09:00:00.000Z',
      }),
      buildNote({
        id: 'district-2-note',
        locationName: 'District 2',
        latitude: 10.765,
        longitude: 106.665,
      }),
    ]);

    await syncGeofenceRegions();

    expect(mockStartGeofencingAsync).toHaveBeenCalledWith(
      'BACKGROUND_GEOFENCE_TASK',
      expect.arrayContaining([
        expect.objectContaining({ identifier: 'preference-note' }),
        expect.objectContaining({ identifier: 'district-2-note' }),
      ])
    );
    expect(mockStartGeofencingAsync.mock.calls[0]?.[1]).toHaveLength(2);
  });

  it('prioritizes a preference reminder over a photo memory for the same place', () => {
    const prioritized = prioritizeNotesForGeofencing(
      [
        buildNote({
          id: 'photo-note',
          type: 'photo',
          content: 'file:///photo.jpg',
          locationName: 'District 1',
          createdAt: '2026-03-10T11:00:00.000Z',
        }),
        buildNote({
          id: 'preference-note',
          type: 'text',
          content: 'She prefers no onions here',
          locationName: 'District 1',
          createdAt: '2026-03-10T09:00:00.000Z',
        }),
      ],
      1
    );

    expect(prioritized.map((note) => note.id)).toEqual(['preference-note']);
  });

  it('does not let blank text outrank a usable reminder for the same place', () => {
    const prioritized = prioritizeNotesForGeofencing(
      [
        buildNote({
          id: 'blank-text',
          content: '   ',
          locationName: 'District 1',
          createdAt: '2026-03-10T12:00:00.000Z',
        }),
        buildNote({
          id: 'useful-text',
          content: 'She likes the window seats here',
          locationName: 'District 1',
          createdAt: '2026-03-10T09:00:00.000Z',
        }),
      ],
      1
    );

    expect(prioritized.map((note) => note.id)).toEqual(['useful-text']);
  });

  it('uses favorite only as a tie breaker after recency', () => {
    const prioritized = prioritizeNotesForGeofencing(
      [
        buildNote({
          id: 'older-favorite',
          content: 'Quiet corner table',
          locationName: 'District 1',
          isFavorite: true,
          createdAt: '2026-03-10T09:00:00.000Z',
        }),
        buildNote({
          id: 'newer-non-favorite',
          content: 'Quiet corner table',
          locationName: 'District 2',
          latitude: 10.765,
          longitude: 106.665,
          isFavorite: false,
          createdAt: '2026-03-10T11:00:00.000Z',
        }),
      ],
      1
    );

    expect(prioritized.map((note) => note.id)).toEqual(['newer-non-favorite']);
  });

  it('clears started geofences and signature', async () => {
    mockStorage.set('geofence.signature', 'old');
    mockHasStartedGeofencingAsync.mockResolvedValue(true);

    await clearGeofenceRegions();
    expect(mockStopGeofencingAsync).toHaveBeenCalledWith('BACKGROUND_GEOFENCE_TASK');
    expect(mockStorage.has('geofence.signature')).toBe(false);
  });
});

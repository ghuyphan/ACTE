const mockUpdateSnapshot = jest.fn();
const mockGetAllNotes = jest.fn();
const mockGetForegroundPermissionsAsync = jest.fn();
const mockGetLastKnownPositionAsync = jest.fn();
const mockGetCurrentPositionAsync = jest.fn();

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

import { updateWidgetData } from '../services/widgetService';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
  mockGetLastKnownPositionAsync.mockResolvedValue(null);
  mockGetCurrentPositionAsync.mockResolvedValue(null);
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

describe('widgetService', () => {
  it('uses deterministic latest-note fallback when no nearby location is available', async () => {
    await updateWidgetData();

    expect(mockUpdateSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          text: 'Latest note',
          locationName: 'Latest place',
          isIdleState: true,
        }),
      })
    );
  });
});

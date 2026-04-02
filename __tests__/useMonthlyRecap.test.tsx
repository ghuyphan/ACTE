import { renderHook } from '@testing-library/react-native';
import type { Note } from '../services/database';
import { useMonthlyRecap } from '../hooks/state/useMonthlyRecap';

let mockNotes: Note[] = [];
let mockLoading = false;

jest.mock('../hooks/useNotes', () => ({
  useNotesStore: () => ({
    notes: mockNotes,
    loading: mockLoading,
  }),
}));

function buildNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    type: 'text',
    content: 'Memory',
    locationName: 'Cafe',
    latitude: 10.7,
    longitude: 106.6,
    radius: 150,
    isFavorite: false,
    hasDoodle: false,
    doodleStrokesJson: null,
    hasStickers: false,
    stickerPlacementsJson: null,
    createdAt: '2026-03-10T00:00:00.000Z',
    updatedAt: null,
    ...overrides,
  } as Note;
}

describe('useMonthlyRecap', () => {
  beforeEach(() => {
    mockNotes = [];
    mockLoading = false;
  });

  it('returns a memoized recap for the selected month', () => {
    mockNotes = [
      buildNote({
        id: 'march-note',
        createdAt: '2026-03-10T00:00:00.000Z',
      }),
      buildNote({
        id: 'april-note',
        createdAt: '2026-04-10T00:00:00.000Z',
      }),
    ];

    const { result } = renderHook(() =>
      useMonthlyRecap({
        referenceDate: new Date('2026-03-15T00:00:00.000Z'),
        timeZone: 'UTC',
      })
    );

    expect(result.current.monthKey).toBe('2026-03');
    expect(result.current.loading).toBe(false);
    expect(result.current.recap.stats.noteCount).toBe(1);
    expect(result.current.recap.days.find((day) => day.dateKey === '2026-03-10')?.noteCount).toBe(1);
  });

  it('recomputes when notes or the selected month changes', () => {
    mockNotes = [
      buildNote({
        id: 'march-note',
        createdAt: '2026-03-10T00:00:00.000Z',
      }),
      buildNote({
        id: 'april-note',
        createdAt: '2026-04-10T00:00:00.000Z',
      }),
    ];

    const { result, rerender } = renderHook<
      ReturnType<typeof useMonthlyRecap>,
      { referenceDate: Date }
    >(
      ({ referenceDate }) =>
        useMonthlyRecap({
          referenceDate,
          timeZone: 'UTC',
        }),
      {
        initialProps: {
          referenceDate: new Date('2026-03-15T00:00:00.000Z'),
        },
      }
    );

    expect(result.current.monthKey).toBe('2026-03');
    expect(result.current.recap.stats.noteCount).toBe(1);

    mockNotes = [
      ...mockNotes,
      buildNote({
        id: 'march-note-2',
        createdAt: '2026-03-11T00:00:00.000Z',
      }),
    ];

    rerender({
      referenceDate: new Date('2026-03-15T00:00:00.000Z'),
    });

    expect(result.current.recap.stats.noteCount).toBe(2);

    rerender({
      referenceDate: new Date('2026-04-15T00:00:00.000Z'),
    });

    expect(result.current.monthKey).toBe('2026-04');
    expect(result.current.recap.stats.noteCount).toBe(1);
    expect(result.current.recap.days.find((day) => day.dateKey === '2026-04-10')?.noteCount).toBe(1);
  });
});

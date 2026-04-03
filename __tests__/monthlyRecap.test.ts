import type { Note } from '../services/database';
import {
  buildMonthlyRecapDigest,
  buildMonthObjects,
  buildMonthlyRecap,
  buildMonthlyRecapFromScopedNotes,
  buildRecapMonthEntries,
  deserializeMonthlyRecap,
  getMonthPlaceGroups,
  getMonthRange,
  getNotesForMonth,
  getRecapMonthKeyForDate,
  serializeMonthlyRecap,
} from '../services/monthlyRecap';

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

describe('monthlyRecap', () => {
  it('builds a timezone-aware month range', () => {
    const range = getMonthRange(2026, 2, 'Asia/Ho_Chi_Minh');

    expect(range.monthKey).toBe('2026-03');
    expect(range.start.toISOString()).toBe('2026-02-28T17:00:00.000Z');
    expect(range.endExclusive.toISOString()).toBe('2026-03-31T17:00:00.000Z');
  });

  it('filters notes by createdAt and keeps updated notes in their original month', () => {
    const notes = [
      buildNote({
        id: 'cafe-1',
        content: 'Breakfast memory',
        locationName: 'Cafe One',
        createdAt: '2026-03-02T10:00:00.000Z',
        updatedAt: '2026-04-02T00:00:00.000Z',
        hasDoodle: true,
        hasStickers: true,
        stickerPlacementsJson: JSON.stringify([
          {
            id: 'placement-1',
            assetId: 'asset-1',
            x: 0.4,
            y: 0.4,
            scale: 1,
            rotation: 0,
            zIndex: 1,
            opacity: 1,
            asset: {
              id: 'asset-1',
              localUri: 'file:///sticker-1.png',
              mimeType: 'image/png',
            },
          },
        ]),
      }),
      buildNote({
        id: 'cafe-2',
        content: 'Breakfast again',
        locationName: 'Cafe One',
        createdAt: '2026-03-02T11:00:00.000Z',
      }),
      buildNote({
        id: 'cafe-3',
        content: 'Third visit',
        locationName: 'Cafe One',
        createdAt: '2026-03-02T12:00:00.000Z',
      }),
      buildNote({
        id: 'cafe-4',
        content: 'Another place',
        locationName: 'Cafe Two',
        createdAt: '2026-03-04T09:00:00.000Z',
        isFavorite: true,
      }),
      buildNote({
        id: 'beach-1',
        content: 'Photo memory',
        type: 'photo',
        locationName: 'Beach',
        createdAt: '2026-03-06T09:00:00.000Z',
      }),
      buildNote({
        id: 'april-note',
        content: 'April memory',
        locationName: 'New month',
        createdAt: '2026-04-01T00:00:00.000Z',
      }),
    ];

    const range = getMonthRange(2026, 2, 'UTC');
    const monthNotes = getNotesForMonth(notes, range);
    const recap = buildMonthlyRecap(notes, { year: 2026, month: 2, timeZone: 'UTC' });

    expect(monthNotes.map((note) => note.id)).toEqual([
      'cafe-1',
      'cafe-2',
      'cafe-3',
      'cafe-4',
      'beach-1',
    ]);
    expect(recap.stats.noteCount).toBe(5);
    expect(recap.stats.photoNoteCount).toBe(1);
    expect(recap.stats.favoriteCount).toBe(1);
    expect(recap.placeGroups).toHaveLength(3);
    expect(recap.placeGroups[0].notes).toHaveLength(3);
    expect(recap.placeGroups[0].postcard.kind).toBe('postcard');

    const dayTwo = recap.days.find((day) => day.dateKey === '2026-03-02');
    expect(dayTwo).toMatchObject({
      noteCount: 3,
      stampCount: 3,
      overflowCount: 0,
      markerKind: 'stamp',
      hasPhoto: false,
      hasDecorations: true,
    });

    const dayFour = recap.days.find((day) => day.dateKey === '2026-03-04');
    expect(dayFour).toMatchObject({
      noteCount: 1,
      stampCount: 1,
      overflowCount: 0,
      markerKind: 'stamp',
    });

    expect(recap.highlights.some((item) => item.kind === 'postcard')).toBe(true);
    expect(recap.heroPostcard?.kind).toBe('postcard');
    expect(recap.heroPostcard?.noteIds.length).toBeGreaterThan(0);
    expect(recap.stickerUsage).toEqual([
      {
        assetId: 'asset-1',
        count: 1,
        previewUri: 'file:///sticker-1.png',
        mimeType: 'image/png',
        assetWidth: 100,
        assetHeight: 100,
        outlineEnabled: true,
      },
    ]);
    expect(recap.objects.map((object) => object.kind)).toEqual([
      'postcard',
      'polaroid',
      'postcard',
      'postcard',
      'postcard',
    ]);
    expect(recap.objects.some((object) => object.kind === 'polaroid')).toBe(true);
  });

  it('builds lightweight object mappings for text and photo notes', () => {
    const objects = buildMonthObjects([
      buildNote({
        id: 'text-1',
        content: 'Text memory',
        createdAt: '2026-03-10T10:00:00.000Z',
      }),
      buildNote({
        id: 'photo-1',
        type: 'photo',
        content: 'file:///photo.jpg',
        locationName: 'Gallery',
        createdAt: '2026-03-10T11:00:00.000Z',
      }),
    ]);

    expect(objects.map((object) => object.kind)).toEqual(['polaroid', 'postcard']);
    expect(objects[0].subtitle).toBe('Polaroid');
    expect(objects[1].subtitle).toBe('Postcard');
  });

  it('groups place clusters deterministically', () => {
    const groups = getMonthPlaceGroups([
      buildNote({
        id: 'alpha-1',
        locationName: 'Alpha',
        createdAt: '2026-03-10T10:00:00.000Z',
      }),
      buildNote({
        id: 'alpha-2',
        locationName: 'Alpha',
        createdAt: '2026-03-10T11:00:00.000Z',
      }),
      buildNote({
        id: 'beta-1',
        locationName: 'Beta',
        createdAt: '2026-03-09T10:00:00.000Z',
      }),
    ]);

    expect(groups[0].key).toContain('alpha');
    expect(groups[0].notes).toHaveLength(2);
    expect(groups[1].key).toContain('beta');
  });

  it('builds recap month entries using the active timezone window', () => {
    const monthEntries = buildRecapMonthEntries(
      [
        buildNote({
          id: 'late-feb-utc',
          createdAt: '2026-02-28T18:30:00.000Z',
        }),
        buildNote({
          id: 'late-march-utc',
          createdAt: '2026-03-31T18:30:00.000Z',
        }),
      ],
      { timeZone: 'Asia/Ho_Chi_Minh', monthWindow: 2 }
    );

    expect(monthEntries.map((entry) => entry.monthKey)).toEqual(['2026-04', '2026-03']);
    expect(monthEntries[0].notes.map((note) => note.id)).toEqual(['late-march-utc']);
    expect(monthEntries[1].notes.map((note) => note.id)).toEqual(['late-feb-utc']);
  });

  it('reuses pre-scoped month notes without changing recap output', () => {
    const notes = [
      buildNote({
        id: 'march-note',
        createdAt: '2026-03-10T10:00:00.000Z',
        stickerPlacementsJson: JSON.stringify([
          {
            id: 'placement-1',
            assetId: 'asset-1',
            x: 0.5,
            y: 0.5,
            scale: 1,
            rotation: 0,
            zIndex: 1,
            opacity: 1,
            asset: {
              id: 'asset-1',
              localUri: 'file:///sticker-1.png',
              mimeType: 'image/png',
            },
          },
        ]),
      }),
      buildNote({
        id: 'april-note',
        createdAt: '2026-04-01T10:00:00.000Z',
      }),
    ];
    const month = getMonthRange(2026, 2, 'UTC');
    const scopedMarchNotes = getNotesForMonth(notes, month);
    const fullRecap = buildMonthlyRecap(notes, { year: 2026, month: 2, timeZone: 'UTC' });
    const scopedRecap = buildMonthlyRecapFromScopedNotes(scopedMarchNotes, {
      year: 2026,
      month: 2,
      timeZone: 'UTC',
    });

    expect(scopedRecap).toEqual(fullRecap);
  });

  it('builds a stable recap month key and digest', () => {
    const notes = [
      buildNote({
        id: 'note-a',
        createdAt: '2026-02-28T18:30:00.000Z',
        locationName: 'Cafe',
      }),
      buildNote({
        id: 'note-b',
        createdAt: '2026-02-28T18:40:00.000Z',
        isFavorite: true,
      }),
    ];

    expect(getRecapMonthKeyForDate(new Date('2026-02-28T18:30:00.000Z'), 'Asia/Ho_Chi_Minh')).toBe(
      '2026-03'
    );
    expect(buildMonthlyRecapDigest(notes)).toBe(buildMonthlyRecapDigest([...notes].reverse()));
  });

  it('serializes and deserializes a monthly recap payload', () => {
    const recap = buildMonthlyRecap(
      [
        buildNote({
          id: 'note-a',
          createdAt: '2026-03-10T10:00:00.000Z',
        }),
      ],
      { year: 2026, month: 2, timeZone: 'UTC' }
    );
    const restored = deserializeMonthlyRecap(serializeMonthlyRecap(recap));

    expect(restored).toEqual(recap);
    expect(restored?.month.start).toBeInstanceOf(Date);
    expect(restored?.month.endExclusive).toBeInstanceOf(Date);
  });
});

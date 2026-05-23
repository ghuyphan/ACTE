import { buildMemoryRemixItems } from '../services/memoryRemix';
import type { Note } from '../services/database';

function createNote(overrides: Partial<Note> = {}): Note {
  return {
    id: overrides.id ?? 'note-1',
    type: overrides.type ?? 'text',
    content: overrides.content ?? 'hello',
    caption: overrides.caption ?? null,
    locationName: overrides.locationName ?? 'Cafe',
    latitude: overrides.latitude ?? 10,
    longitude: overrides.longitude ?? 20,
    radius: overrides.radius ?? 100,
    isFavorite: overrides.isFavorite ?? false,
    createdAt: overrides.createdAt ?? '2026-05-01T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? null,
    promptId: overrides.promptId ?? null,
    promptTextSnapshot: overrides.promptTextSnapshot ?? null,
    promptAnswer: overrides.promptAnswer ?? null,
    moodEmoji: overrides.moodEmoji ?? null,
    noteColor: overrides.noteColor ?? null,
    hasDoodle: overrides.hasDoodle ?? false,
    hasStickers: overrides.hasStickers ?? false,
  };
}

describe('buildMemoryRemixItems', () => {
  it('prioritizes visually rich and favorite notes', () => {
    const items = buildMemoryRemixItems({
      source: 'search',
      notes: [
        createNote({ id: 'plain', createdAt: '2026-05-22T10:00:00.000Z' }),
        createNote({ id: 'favorite-photo', type: 'photo', isFavorite: true }),
        createNote({ id: 'sticker', hasStickers: true }),
      ],
    });

    expect(items.map((item) => item.id)).toEqual(['favorite-photo', 'sticker', 'plain']);
  });

  it('builds a place pack from matching place names', () => {
    const items = buildMemoryRemixItems({
      source: 'place',
      placeName: 'Cafe Noto',
      notes: [
        createNote({ id: 'match', locationName: 'Cafe Noto' }),
        createNote({ id: 'other', locationName: 'Park' }),
      ],
    });

    expect(items.map((item) => item.id)).toEqual(['match']);
  });
});

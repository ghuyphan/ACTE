import { filterNotesBySearchFilters } from '../services/noteSearchFilters';
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

describe('filterNotesBySearchFilters', () => {
  it('filters by multiple selected traits', () => {
    const notes = [
      createNote({ id: 'photo-sticker', type: 'photo', hasStickers: true }),
      createNote({ id: 'photo-plain', type: 'photo' }),
      createNote({ id: 'text-sticker', hasStickers: true }),
    ];

    expect(filterNotesBySearchFilters(notes, ['photo', 'stickers']).map((note) => note.id))
      .toEqual(['photo-sticker']);
  });

  it('filters prompted notes', () => {
    const notes = [
      createNote({ id: 'prompted', promptTextSnapshot: 'What changed?' }),
      createNote({ id: 'plain' }),
    ];

    expect(filterNotesBySearchFilters(notes, ['prompts']).map((note) => note.id))
      .toEqual(['prompted']);
  });

  it('filters notes from the current month', () => {
    const notes = [
      createNote({ id: 'current', createdAt: '2026-05-03T10:00:00.000Z' }),
      createNote({ id: 'older', createdAt: '2026-04-30T10:00:00.000Z' }),
    ];

    expect(
      filterNotesBySearchFilters(notes, ['this_month'], new Date('2026-05-22T12:00:00.000Z'))
        .map((note) => note.id)
    ).toEqual(['current']);
  });
});

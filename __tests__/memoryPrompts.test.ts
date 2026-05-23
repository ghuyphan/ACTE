import { buildMemoryPromptSuggestion } from '../services/memoryPrompts';
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

describe('buildMemoryPromptSuggestion', () => {
  it('suggests a new-place prompt when there are no nearby notes', () => {
    const prompt = buildMemoryPromptSuggestion({
      captureMode: 'text',
      location: { coords: { latitude: 10, longitude: 20 } },
      notes: [
        createNote({ latitude: 11, longitude: 21 }),
      ],
    });

    expect(prompt.reason).toBe('new_place');
  });

  it('prioritizes favorite nearby places', () => {
    const prompt = buildMemoryPromptSuggestion({
      captureMode: 'text',
      location: { coords: { latitude: 10, longitude: 20 } },
      notes: [
        createNote({ isFavorite: true }),
        createNote({ id: 'note-2' }),
      ],
    });

    expect(prompt.reason).toBe('favorite_place');
  });

  it('falls back to photo framing when there is no location', () => {
    const prompt = buildMemoryPromptSuggestion({
      captureMode: 'camera',
      location: null,
      notes: [],
    });

    expect(prompt.reason).toBe('photo');
  });
});
